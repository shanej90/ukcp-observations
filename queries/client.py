"""
Async-style UKCP job client.

Manages a queue of WPS jobs, submitting up to MAX_CONCURRENT at a time,
polling all in-flight jobs on a timer, and downloading CSV output on success.

Rate-limited or transiently-failed jobs are automatically re-queued with
exponential backoff (60s → 120s → 240s → 480s → 960s), up to MAX_RETRIES
attempts before being permanently marked failed.

Each job specifies its own destination path, following the convention:
    data/results/<location>/<variable>_<location>.csv

Usage:
    client = UKCPClient(api_key = key)
    client.add(
        job_id   = "london_rainfall",
        url      = daily_rainfall(key, 530168, 180509, 2000, 2020),
        dest_path = "data/results/london/rainfall_london.csv",
    )
    client.run()
"""

import logging
import os
import random
import time
import xml.etree.ElementTree as ET
from collections import deque
from dataclasses import dataclass

import requests

from queries.build import WPS_NS, status_url

logger = logging.getLogger(__name__)

MAX_CONCURRENT       = 2    # conservative limit; 3 caused too many simultaneous rate-limit hits
POLL_INTERVAL        = 20   # seconds between status checks
MAX_RETRIES          = 5    # max re-queue attempts per job before giving up
RETRY_BASE_SECS      = 60   # initial backoff; doubles each retry (60 → 120 → 240 → 480 → 960)
SUBMISSION_GAP       = 8    # seconds between consecutive job submissions within one fill cycle
GLOBAL_COOLDOWN_SECS = 90   # after any rate-limit, pause ALL new submissions for this long

# WPS error text substrings that indicate a transient rate-limit or server overload.
_RATE_LIMIT_PHRASES = ("limit", "quota", "exceeded", "too many", "throttl", "capacity")


@dataclass
class _Job:
    job_id:          str
    request_url:     str
    dest_path:       str
    status_location: str   = ""
    status:          str   = "queued"   # queued | active | succeeded | failed
    error:           str   = ""
    retries:         int   = 0
    retry_after:     float = 0.0  # time.time() value; 0 means ready immediately


class UKCPClient:
    def __init__(
        self,
        api_key:        str,
        poll_interval:  int = POLL_INTERVAL,
        max_concurrent: int = MAX_CONCURRENT,
    ):
        self.api_key        = api_key
        self.poll_interval  = poll_interval
        self.max_concurrent = max_concurrent
        self._queue:    deque[_Job]     = deque()
        self._active:   dict[str, _Job] = {}
        self._outcomes: dict[str, str]  = {}
        self._global_cooldown_until:  float = 0.0
        self._cooldown_logged:        bool  = False

    def add(self, job_id: str, url: str, dest_path: str) -> None:
        """
        Queue a job.

        Args:
            job_id:    Unique identifier used in log messages.
            url:       WPS Execute URL from one of the observations query builders.
            dest_path: Full path where the downloaded CSV will be saved,
                       e.g. 'data/results/london/rainfall_london.csv'.
        """
        self._queue.append(_Job(job_id = job_id, request_url = url, dest_path = dest_path))

    def run(self) -> dict[str, str]:
        """
        Process all queued jobs to completion.

        Returns a dict mapping job_id -> outcome ('succeeded' or 'failed').
        """
        self._outcomes = {}

        while self._queue or self._active:
            self._fill_slots()
            self._poll_active()

            if self._queue or self._active:
                pending_retry = [j for j in self._queue if j.retry_after > time.time()]
                if pending_retry:
                    next_ready = min(j.retry_after for j in pending_retry)
                    wait = max(self.poll_interval, int(next_ready - time.time()))
                    logger.info(
                        "Waiting %ds  [active: %d  queued: %d  in-backoff: %d]",
                        wait, len(self._active), len(self._queue), len(pending_retry),
                    )
                else:
                    wait = self.poll_interval
                    logger.info(
                        "Waiting %ds  [active: %d  queued: %d]",
                        wait, len(self._active), len(self._queue),
                    )
                time.sleep(wait)

        return self._outcomes

    # ------------------------------------------------------------------
    # Internal
    # ------------------------------------------------------------------

    def _fill_slots(self) -> None:
        """Submit queued jobs until MAX_CONCURRENT slots are filled, skipping those still in backoff."""
        now = time.time()
        if now < self._global_cooldown_until:
            if not self._cooldown_logged:
                logger.info(
                    "Global cooldown active — no new submissions for %ds  [active: %d  queued: %d]",
                    int(self._global_cooldown_until - now),
                    len(self._active),
                    len(self._queue),
                )
                self._cooldown_logged = True
            return
        self._cooldown_logged = False

        candidates = [j for j in self._queue if j.retry_after <= now]
        first = True
        for job in candidates:
            if len(self._active) >= self.max_concurrent:
                break
            if not first:
                time.sleep(SUBMISSION_GAP)
            self._queue.remove(job)
            self._submit(job)
            first = False
            if time.time() < self._global_cooldown_until:
                break  # rate-limit fired mid-fill; stop submitting immediately

    def _requeue(self, job: _Job, reason: str) -> None:
        """Re-queue with exponential backoff, or permanently fail after MAX_RETRIES."""
        job.retries += 1
        if job.retries > MAX_RETRIES:
            logger.error(
                "Giving up   [%s] after %d retries — last error: %s",
                job.job_id, MAX_RETRIES, reason,
            )
            job.status = "failed"
            job.error  = reason
            self._outcomes[job.job_id] = "failed"
            return

        # Global cooldown: stop all new submissions so the server can recover.
        new_cooldown = time.time() + GLOBAL_COOLDOWN_SECS
        if new_cooldown > self._global_cooldown_until:
            self._global_cooldown_until = new_cooldown
            self._cooldown_logged = False

        # Per-job backoff with ±25% jitter to break synchronised retry waves.
        base_delay = RETRY_BASE_SECS * (2 ** (job.retries - 1))
        jitter     = random.uniform(-0.25 * base_delay, 0.25 * base_delay)
        delay      = max(30, int(base_delay + jitter))
        job.retry_after = time.time() + delay
        job.status      = "queued"
        self._queue.append(job)
        logger.warning(
            "Rate-limited [%s] — retry %d/%d in %ds  (global cooldown %ds)",
            job.job_id, job.retries, MAX_RETRIES, delay,
            max(0, int(self._global_cooldown_until - time.time())),
        )

    def _submit(self, job: _Job) -> None:
        logger.info("Submitting  [%s]", job.job_id)
        try:
            resp = requests.get(job.request_url, timeout = 30)
        except requests.RequestException as exc:
            logger.warning("Submit error [%s]: %s — will retry", job.job_id, exc)
            self._requeue(job, str(exc))
            return

        if resp.status_code == 429 or resp.status_code >= 500:
            logger.warning("Submit HTTP %d [%s] — will retry", resp.status_code, job.job_id)
            self._requeue(job, f"HTTP {resp.status_code}")
            return

        try:
            resp.raise_for_status()
        except requests.HTTPError as exc:
            logger.error("Submit failed [%s]: %s", job.job_id, exc)
            job.status = "failed"
            job.error  = str(exc)
            self._outcomes[job.job_id] = "failed"
            return

        root = ET.fromstring(resp.text)
        job.status_location = root.attrib.get("statusLocation", "")
        status_tag = _status_tag(root)

        if status_tag == "ProcessSucceeded":
            self._download(job, root)
            self._outcomes[job.job_id] = "succeeded"
        elif status_tag == "ProcessFailed":
            error = _error_text(root)
            if any(phrase in error.lower() for phrase in _RATE_LIMIT_PHRASES):
                self._requeue(job, error)
            else:
                job.status = "failed"
                job.error  = error
                logger.error("Job failed on submit [%s]: %s", job.job_id, error)
                self._outcomes[job.job_id] = "failed"
        else:
            # ProcessAccepted / ProcessStarted — register for polling
            job.status = "active"
            self._active[job.job_id] = job
            logger.info("Accepted    [%s]  status: %s", job.job_id, status_tag)

    def _poll_active(self) -> None:
        """Poll every active job once and act on the result."""
        for job_id in list(self._active):
            job  = self._active[job_id]
            root = self._fetch_status(job)
            if root is None:
                continue

            status_tag = _status_tag(root)
            logger.info("Status      [%s]  %s", job_id, status_tag)

            if status_tag == "ProcessSucceeded":
                self._download(job, root)
                del self._active[job_id]
                self._outcomes[job_id] = "succeeded"

            elif status_tag == "ProcessFailed":
                error = _error_text(root)
                del self._active[job_id]
                if any(phrase in error.lower() for phrase in _RATE_LIMIT_PHRASES):
                    self._requeue(job, error)
                else:
                    job.status = "failed"
                    job.error  = error
                    logger.error("Job failed  [%s]: %s", job_id, error)
                    self._outcomes[job_id] = "failed"

    def _fetch_status(self, job: _Job) -> ET.Element | None:
        if not job.status_location:
            return None
        try:
            resp = requests.get(status_url(job.status_location, self.api_key), timeout = 30)
            resp.raise_for_status()
            return ET.fromstring(resp.text)
        except requests.RequestException as exc:
            logger.warning("Poll error  [%s]: %s", job.job_id, exc)
            return None

    def _download(self, job: _Job, root: ET.Element) -> None:
        """Download the CSV output file for a completed job to job.dest_path."""
        csv_urls = [
            el.text for el in root.iter()
            if el.text and el.text.strip().endswith(".csv")
        ]

        if not csv_urls:
            logger.warning("No CSV found in output for [%s]", job.job_id)
            job.status = "succeeded"
            return

        os.makedirs(os.path.dirname(job.dest_path), exist_ok = True)

        # The API returns one CSV per request; take the first if multiple appear.
        csv_url = csv_urls[0]
        try:
            resp = requests.get(
                f"{csv_url}?ApiKey={self.api_key}", timeout = 60, stream = True
            )
            resp.raise_for_status()
            with open(job.dest_path, "wb") as fh:
                for chunk in resp.iter_content(chunk_size = 8192):
                    fh.write(chunk)
            logger.info("Downloaded  [%s]  -> %s", job.job_id, job.dest_path)
        except requests.RequestException as exc:
            logger.error("Download failed [%s]: %s", job.job_id, exc)

        job.status = "succeeded"


# ------------------------------------------------------------------
# Helpers
# ------------------------------------------------------------------

def _status_tag(root: ET.Element) -> str:
    """Return the tag name of the first child of the <Status> element."""
    status_el = root.find(".//wps:Status", WPS_NS)
    if status_el is None or len(status_el) == 0:
        return "Unknown"
    return status_el[0].tag.split("}")[-1]


def _error_text(root: ET.Element) -> str:
    el = root.find(".//ows:ExceptionText", WPS_NS)
    return el.text.strip() if el is not None and el.text else "(no detail)"
