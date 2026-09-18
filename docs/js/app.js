// Orchestrates state, events, and rendering for the dashboard.
(() => {

  // ── State ──────────────────────────────────────────────────────────────────

  const ROLLING_METRICS = [
    { key: 'meanTemp',    label: 'Mean Temperature',  unit: '°C'  },
    { key: 'maxTmaxYear', label: 'Hottest Day',       unit: '°C'  },
    { key: 'minTminYear', label: 'Coldest Day',       unit: '°C'  },
    { key: 'maxTminYear', label: 'Warmest Night',     unit: '°C'  },
    { key: 'minTmaxYear', label: 'Coldest Afternoon', unit: '°C'  },
    { key: 'rainTotal',   label: 'Annual Rainfall',   unit: 'mm'  },
    { key: 'maxRainDay',  label: 'Wettest Day',       unit: 'mm'  },
    { key: 'rainyDays1',  label: 'Rainy Days (≥1mm)', unit: 'days'},
    { key: 'coldBelow0',  label: 'Frost Days (<0°C)', unit: 'days'},
    { key: 'warm20',      label: 'Warm Days (≥20°C)', unit: 'days'},
    { key: 'sunTotal',    label: 'Sunshine Hours',    unit: 'hrs' },
  ];

  const state = {
    primaryData:    null,
    compareData:    null,
    primaryMetrics: null,
    compareMetrics: null,
    yearMin: 1960,
    yearMax: 2024,
    // active tab per section: 'monthly' | 'annual'
    tabs: { temp: 'monthly', rain: 'monthly', sun: 'monthly' },
    rollingMetric: 'meanTemp',
  };

  // ── DOM refs ───────────────────────────────────────────────────────────────

  const $selPrimary    = document.getElementById('select-primary');
  const $selCompare    = document.getElementById('select-compare');
  const $yearMin       = document.getElementById('year-min');
  const $yearMax       = document.getElementById('year-max');
  const $legend        = document.getElementById('legend');
  const $legendPN      = document.getElementById('legend-primary-name');
  const $legendCN      = document.getElementById('legend-compare-name');
  const $loading       = document.getElementById('loading');
  const $content       = document.getElementById('content');
  const $rollingMetric = document.getElementById('rolling-metric');

  // ── Helpers ────────────────────────────────────────────────────────────────

  function fmt(v, unit = '', decimals = 1) {
    if (v == null) return '–';
    const num = Number(v);
    if (!isFinite(num)) return '–';
    const str = Math.abs(num) >= 1000
      ? num.toLocaleString('en-GB', { minimumFractionDigits: decimals, maximumFractionDigits: decimals })
      : num.toFixed(decimals);
    return str + unit;
  }

  function showSection(sectionId, viewId) {
    const section = document.getElementById(sectionId);
    section.querySelectorAll('[id]').forEach(el => {
      const isView = el.id === viewId;
      el.classList.toggle('hidden', !isView);
    });
  }

  // ── Stat grids ─────────────────────────────────────────────────────────────

  function _statCard(label, pVal, cVal, unit = '', dec = 1) {
    const pStr = pVal != null ? Number(pVal).toFixed(dec) + unit : '–';
    const cStr = (cVal != null && state.compareData) ? Number(cVal).toFixed(dec) + unit : null;
    return `<div class="stat-card">
      <div class="stat-label">${label}</div>
      <div class="stat-value primary">${pStr}</div>
      ${cStr ? `<div class="stat-compare">${cStr}</div>` : ''}
    </div>`;
  }

  function renderTempStats() {
    const p = state.primaryMetrics?.stats;
    const c = state.compareMetrics?.stats;
    document.getElementById('temp-annual-stats').innerHTML = [
      _statCard('Record high',    p?.recordHigh,    c?.recordHigh,    '°C', 1),
      _statCard('Warmest low',    p?.recordWarmestLow, c?.recordWarmestLow, '°C', 1),
      _statCard('Avg yearly max', p?.avgYearlyHigh, c?.avgYearlyHigh, '°C', 1),
      _statCard('Avg yearly warmest low', p?.avgYearlyWarmestLow, c?.avgYearlyWarmestLow, '°C', 1),
      _statCard('Avg high',       p?.avgHighTemp,   c?.avgHighTemp,   '°C', 1),
      _statCard('Avg mean',       p?.avgMeanTemp,   c?.avgMeanTemp,   '°C', 1),
      _statCard('Avg low',        p?.avgLowTemp,    c?.avgLowTemp,    '°C', 1),
      _statCard('Avg yearly min', p?.avgYearlyLow,  c?.avgYearlyLow,  '°C', 1),
      _statCard('Avg yearly coldest high', p?.avgYearlyColdestHigh, c?.avgYearlyColdestHigh, '°C', 1),
      _statCard('Coldest high',   p?.recordColdestHigh, c?.recordColdestHigh, '°C', 1),
      _statCard('Record low',     p?.recordLow,     c?.recordLow,     '°C', 1),
    ].join('');
  }

  function renderRainMonthlyStats() {
    const p = state.primaryMetrics?.stats;
    const c = state.compareMetrics?.stats;
    document.getElementById('rain-monthly-stats').innerHTML = [
      _statCard('Avg annual total', p?.avgAnnualRain, c?.avgAnnualRain, ' mm', 0),
    ].join('');
  }

  function renderRainAnnualStats() {
    const p = state.primaryMetrics?.stats;
    const c = state.compareMetrics?.stats;
    document.getElementById('rain-annual-stats').innerHTML = [
      _statCard('Avg annual total',   p?.avgAnnualRain,     c?.avgAnnualRain,     ' mm', 0),
      _statCard('Wettest year',       p?.wettestYear,       c?.wettestYear,       ' mm', 0),
      _statCard('Driest year',        p?.driestYear,        c?.driestYear,        ' mm', 0),
      _statCard('Avg wettest day',    p?.avgWettestDayYear, c?.avgWettestDayYear, ' mm', 1),
    ].join('');
  }

  function renderSunAnnualStats() {
    const p = state.primaryMetrics?.stats;
    const c = state.compareMetrics?.stats;
    document.getElementById('sun-annual-stats').innerHTML = [
      _statCard('Avg annual hours', p?.avgAnnualSun,    c?.avgAnnualSun,    ' hrs', 0),
      _statCard('% of daylight',    p?.avgPctDaylight,  c?.avgPctDaylight,  '%',    1),
    ].join('');
  }

  // ── Location cards ─────────────────────────────────────────────────────────

  function renderLocationCards() {
    const cards = [];

    function card(locData, cls) {
      if (!locData) return '';
      const { name, lat, lon, country } = locData.meta;
      const latStr  = `${Math.abs(lat).toFixed(2)}°${lat >= 0 ? 'N' : 'S'}`;
      const lonStr  = `${Math.abs(lon).toFixed(2)}°${lon >= 0 ? 'E' : 'W'}`;
      return `<div class="location-card ${cls}">
        <h3>${name}</h3>
        <div class="meta-row">
          <span>${country}</span>
          <span>${latStr}, ${lonStr}</span>
          <span>${locData.year_min}–${locData.year_max}</span>
        </div>
      </div>`;
    }

    document.getElementById('location-cards').innerHTML =
      card(state.primaryData, 'primary') + card(state.compareData, 'compare');
  }

  // ── Chart rendering ────────────────────────────────────────────────────────

  function pName() { return state.primaryData?.meta?.name ?? ''; }
  function cName() { return state.compareData?.meta?.name ?? ''; }
  const pm = () => state.primaryMetrics;
  const cm = () => state.compareMetrics;

  function renderTemp() {
    renderTempStats();
    if (state.tabs.temp === 'monthly') {
      Charts.renderTempRange(pm(), cm(), pName(), cName());
      Charts.renderTempExtremes(pm(), cm(), pName(), cName());
      Charts.renderTempCold(pm(), cm(), pName(), cName());
      Charts.renderTempHot(pm(), cm(), pName(), cName());
    } else {
      Charts.renderTempAnnual(pm(), cm(), pName(), cName());
      Charts.renderTempFrostAnnual(pm(), cm(), pName(), cName());
      Charts.renderTempHotAnnual(pm(), cm(), pName(), cName());
    }
  }

  function renderRain() {
    renderRainMonthlyStats();
    renderRainAnnualStats();
    if (state.tabs.rain === 'monthly') {
      Charts.renderRainTotal(pm(), cm(), pName(), cName());
      Charts.renderRainDays(pm(), cm(), pName(), cName());
      Charts.renderRainMaxDay(pm(), cm(), pName(), cName());
    } else {
      Charts.renderRainAnnual(pm(), cm(), pName(), cName());
      Charts.renderRainAnnualDays(pm(), cm(), pName(), cName());
      Charts.renderRainAnnualMaxDay(pm(), cm(), pName(), cName());
    }
  }

  function renderSun() {
    renderSunAnnualStats();
    if (state.tabs.sun === 'monthly') {
      Charts.renderSunMonthlyHours(pm(), cm(), pName(), cName());
      Charts.renderSunMonthlyPct(pm(), cm(), pName(), cName());
    } else {
      Charts.renderSunAnnual(pm(), cm(), pName(), cName());
    }
  }

  function renderRollingSection() {
    if (!state.primaryData) return;
    const m = ROLLING_METRICS.find(m => m.key === state.rollingMetric) || ROLLING_METRICS[0];
    const pRolling = Metrics.computeRolling(state.primaryData, m.key);
    const cRolling = state.compareData ? Metrics.computeRolling(state.compareData, m.key) : null;
    Charts.renderRolling(pRolling, cRolling, pName(), cName(), m.unit);
  }

  function renderAll() {
    renderLocationCards();
    MapView.update(state.primaryData, state.compareData);
    renderTemp();
    renderRain();
    renderSun();
    renderRollingSection();
  }

  // ── Update pipeline ────────────────────────────────────────────────────────

  async function update() {
    const primarySlug  = $selPrimary.value;
    const compareSlug  = $selCompare.value;
    const yearMin      = parseInt($yearMin.value, 10);
    const yearMax      = parseInt($yearMax.value, 10);

    if (!primarySlug || yearMin > yearMax) return;

    state.yearMin = yearMin;
    state.yearMax = yearMax;

    try {
      state.primaryData = await DataStore.loadLocation(primarySlug);
      state.compareData = compareSlug ? await DataStore.loadLocation(compareSlug) : null;
    } catch (e) {
      console.error('Failed to load location data', e);
      return;
    }

    state.primaryMetrics = Metrics.compute(state.primaryData, yearMin, yearMax);
    state.compareMetrics = state.compareData
      ? Metrics.compute(state.compareData, yearMin, yearMax)
      : null;

    // Legend
    if (state.compareData) {
      $legendPN.textContent = pName();
      $legendCN.textContent = cName();
      $legend.classList.remove('hidden');
    } else {
      $legend.classList.add('hidden');
    }

    renderAll();
  }

  // ── Tab switching ──────────────────────────────────────────────────────────

  document.querySelectorAll('.tab').forEach(btn => {
    btn.addEventListener('click', () => {
      const section = btn.dataset.section;
      const view    = btn.dataset.view;

      btn.closest('.tab-group').querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
      btn.classList.add('active');

      state.tabs[section] = view;

      // Show/hide view panels
      const viewMap = {
        temp: { monthly: 'temp-monthly', annual: 'temp-annual' },
        rain: { monthly: 'rain-monthly', annual: 'rain-annual' },
        sun:  { monthly: 'sun-monthly',  annual:  'sun-annual' },
      };
      const showId = viewMap[section][view];
      const hideId = viewMap[section][view === 'monthly' ? 'annual' : 'monthly'];
      document.getElementById(showId).classList.remove('hidden');
      document.getElementById(hideId).classList.add('hidden');

      // Re-render the relevant section
      if (state.primaryMetrics) {
        if (section === 'temp') renderTemp();
        if (section === 'rain') renderRain();
        if (section === 'sun')  renderSun();
      }
    });
  });

  // ── Event listeners ────────────────────────────────────────────────────────

  $selPrimary.addEventListener('change', update);
  $selCompare.addEventListener('change', update);

  $rollingMetric.addEventListener('change', () => {
    state.rollingMetric = $rollingMetric.value;
    renderRollingSection();
  });

  let _yearTimer = null;
  function deferUpdate() {
    clearTimeout(_yearTimer);
    _yearTimer = setTimeout(update, 400);
  }
  $yearMin.addEventListener('input', deferUpdate);
  $yearMax.addEventListener('input', deferUpdate);

  // ── Init ───────────────────────────────────────────────────────────────────

  async function init() {
    let locations;
    try {
      locations = await DataStore.loadIndex();
    } catch (e) {
      $loading.innerHTML = '<p style="color:#ef4444">Failed to load location index. Are you serving from a web server?</p>';
      return;
    }

    // Populate primary select
    locations.forEach(loc => {
      const opt = document.createElement('option');
      opt.value = loc.slug;
      opt.textContent = `${loc.name} (${loc.country})`;
      $selPrimary.appendChild(opt);
    });

    // Populate compare select (with blank option first)
    const blankOpt = document.createElement('option');
    blankOpt.value = '';
    blankOpt.textContent = 'None';
    $selCompare.appendChild(blankOpt);
    locations.forEach(loc => {
      const opt = document.createElement('option');
      opt.value = loc.slug;
      opt.textContent = `${loc.name} (${loc.country})`;
      $selCompare.appendChild(opt);
    });

    // Populate rolling metric select
    ROLLING_METRICS.forEach(m => {
      const opt = document.createElement('option');
      opt.value = m.key;
      opt.textContent = m.label;
      $rollingMetric.appendChild(opt);
    });
    $rollingMetric.value = state.rollingMetric;

    // Default to London
    const londonOpt = [...$selPrimary.options].find(o => o.value === 'london');
    if (londonOpt) $selPrimary.value = 'london';

    // Searchable dropdowns
    new TomSelect('#select-primary', { maxOptions: 200, selectOnTab: true });
    new TomSelect('#select-compare', { maxOptions: 200, selectOnTab: true, allowEmptyOption: true });

    $loading.classList.add('hidden');
    $content.classList.remove('hidden');
    MapView.init();

    await update();
  }

  init();
})();
