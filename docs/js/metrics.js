// Computes all dashboard metrics from raw summary.json data.
const Metrics = (() => {

  function mean(arr) {
    const vals = arr.filter(v => v != null && isFinite(v));
    if (!vals.length) return null;
    return vals.reduce((a, b) => a + b, 0) / vals.length;
  }

  function sum(arr) {
    return arr.filter(v => v != null && isFinite(v)).reduce((a, b) => a + b, 0);
  }

  function countBelow(arr, threshold) {
    return arr.filter(v => v < threshold).length;
  }

  function countAtLeast(arr, threshold) {
    return arr.filter(v => v >= threshold).length;
  }

  function r1(v) { return v == null ? null : Math.round(v * 10)  / 10;  }
  function r2(v) { return v == null ? null : Math.round(v * 100) / 100; }

  function _annualForYear(y, yd) {
    const allTmax = [], allTmin = [], allRain = [];
    let totalSun = 0, sunCount = 0, maxDayRain = 0;
    for (let m = 1; m <= 12; m++) {
      const mo = yd[String(m)];
      if (!mo) continue;
      allTmax.push(...mo.tmax);
      allTmin.push(...mo.tmin);
      allRain.push(...mo.rain);
      if (mo.rain.length) maxDayRain = Math.max(maxDayRain, Math.max(...mo.rain));
      if (mo.sun != null) { totalSun += mo.sun; sunCount++; }
    }
    const avgHigh = mean(allTmax);
    const avgLow  = mean(allTmin);
    return {
      year:        y,
      meanTemp:    r1((avgHigh != null && avgLow != null) ? (avgHigh + avgLow) / 2 : null),
      maxTmaxYear: allTmax.length ? r1(Math.max(...allTmax)) : null,
      minTminYear: allTmin.length ? r1(Math.min(...allTmin)) : null,
      maxTminYear: allTmin.length ? r1(Math.max(...allTmin)) : null,
      minTmaxYear: allTmax.length ? r1(Math.min(...allTmax)) : null,
      coldBelow10: countBelow(allTmin, 10),
      coldBelow5:  countBelow(allTmin,  5),
      coldBelow0:  countBelow(allTmin,  0),
      warm15:      countAtLeast(allTmax, 15),
      warm20:      countAtLeast(allTmax, 20),
      warm25:      countAtLeast(allTmax, 25),
      warm30:      countAtLeast(allTmax, 30),
      rainTotal:    r2(sum(allRain)),
      maxRainDay:   r2(maxDayRain),
      rainyDays025: countAtLeast(allRain, 0.25),
      rainyDays1:   countAtLeast(allRain, 1.0),
      rainyDays10:  countAtLeast(allRain, 10.0),
      sunTotal:     sunCount === 12 ? r2(totalSun) : null,
    };
  }

  /**
   * Returns a 30-year right-aligned rolling average of metricKey across all
   * years in locData (ignores the year filter).
   * Each result point { year, avg } is labelled by the last year in its window.
   */
  function computeRolling(locData, metricKey, windowSize = 30) {
    const { data } = locData;
    const allYears = Object.keys(data).map(Number).sort((a, b) => a - b);
    const annualData = allYears
      .map(y => { const yd = data[String(y)]; return yd ? _annualForYear(y, yd) : null; })
      .filter(Boolean);

    return annualData.slice(windowSize - 1).map((_, idx) => {
      const i = idx + windowSize - 1;
      const window = annualData.slice(i - windowSize + 1, i + 1);
      const vals = window.map(a => a[metricKey]).filter(v => v != null);
      return { year: annualData[i].year, avg: vals.length ? mean(vals) : null };
    });
  }

  /**
   * Computes monthly and annual metrics from a location's summary.json data,
   * filtered to [yearMin, yearMax].
   *
   * Returns { monthly, annual, stats, years }
   *   monthly: array [0..11] of per-month stats
   *   annual:  array of per-year stats
   *   stats:   overall summary numbers for stat cards
   *   years:   sorted array of included years
   */
  function compute(locData, yearMin, yearMax) {
    const { data, daylight } = locData;

    const years = Object.keys(data)
      .map(Number)
      .filter(y => y >= yearMin && y <= yearMax)
      .sort((a, b) => a - b);

    if (!years.length) return null;

    // ── Monthly ─────────────────────────────────────────────────────────────
    const monthly = [];

    for (let m = 1; m <= 12; m++) {
      const ms = String(m);
      const allTmax = [], allTmin = [], allRain = [];
      const yearlyMaxTmax = [], yearlyMinTmin = [];
      const yearlyMaxTmin = [], yearlyMinTmax = [];
      const yearlyRainTotal = [], yearlyMaxRainDay = [];
      const sunVals = [];

      for (const y of years) {
        const mo = data[String(y)]?.[ms];
        if (!mo) continue;

        allTmax.push(...mo.tmax);
        allTmin.push(...mo.tmin);
        allRain.push(...mo.rain);

        if (mo.tmax.length) yearlyMaxTmax.push(Math.max(...mo.tmax));
        if (mo.tmin.length) yearlyMinTmin.push(Math.min(...mo.tmin));
        if (mo.tmin.length) yearlyMaxTmin.push(Math.max(...mo.tmin));
        if (mo.tmax.length) yearlyMinTmax.push(Math.min(...mo.tmax));

        yearlyRainTotal.push(sum(mo.rain));
        if (mo.rain.length) yearlyMaxRainDay.push(Math.max(...mo.rain));

        if (mo.sun != null) sunVals.push(mo.sun);
      }

      const avgHigh = mean(allTmax);
      const avgLow  = mean(allTmin);
      const avgMean = (avgHigh != null && avgLow != null) ? (avgHigh + avgLow) / 2 : null;

      const avgSun    = mean(sunVals);
      const daylightH = daylight[ms] || null;
      const pctDay    = (avgSun != null && daylightH) ? (avgSun / daylightH * 100) : null;

      monthly.push({
        // Temperature (1 dp)
        avgHigh:       r1(avgHigh),
        avgLow:        r1(avgLow),
        mean:          r1(avgMean),
        avgYearlyHigh: r1(mean(yearlyMaxTmax)),
        avgYearlyLow:  r1(mean(yearlyMinTmin)),
        recordHigh:    allTmax.length ? r1(Math.max(...allTmax)) : null,
        recordLow:     allTmin.length ? r1(Math.min(...allTmin)) : null,

        avgYearlyWarmestLow:  r1(mean(yearlyMaxTmin)),
        avgYearlyColdestHigh: r1(mean(yearlyMinTmax)),
        recordWarmestLow:     allTmin.length ? r1(Math.max(...allTmin)) : null,
        recordColdestHigh:    allTmax.length ? r1(Math.min(...allTmax)) : null,

        // Threshold days — averaged over years
        coldBelow10: r2(countBelow(allTmin, 10) / years.length),
        coldBelow5:  r2(countBelow(allTmin,  5) / years.length),
        coldBelow0:  r2(countBelow(allTmin,  0) / years.length),
        warm15:       r2(countAtLeast(allTmax, 15) / years.length),
        warm20:       r2(countAtLeast(allTmax, 20) / years.length),
        warm25:       r2(countAtLeast(allTmax, 25) / years.length),
        warm30:       r2(countAtLeast(allTmax, 30) / years.length),

        // Rainfall (2 dp)
        avgRainTotal:  r2(mean(yearlyRainTotal)),
        avgMaxRainDay: r2(mean(yearlyMaxRainDay)),
        rainyDays025:  r2(countAtLeast(allRain, 0.25) / years.length),
        rainyDays1:    r2(countAtLeast(allRain, 1.0)  / years.length),
        rainyDays10:   r2(countAtLeast(allRain, 10.0) / years.length),

        // Sunshine
        avgSunHours:  r2(avgSun),
        pctDaylight:  r1(pctDay),
        daylightHours: daylightH,
      });
    }

    // ── Annual ───────────────────────────────────────────────────────────────
    const annual = years.map(y => {
      const yd = data[String(y)];
      return yd ? _annualForYear(y, yd) : null;
    }).filter(Boolean);

    // ── Overall stats ────────────────────────────────────────────────────────
    const allTmaxOverall = [], allTminOverall = [];
    for (const y of years) {
      for (let m = 1; m <= 12; m++) {
        const mo = data[String(y)]?.[String(m)];
        if (!mo) continue;
        allTmaxOverall.push(...mo.tmax);
        allTminOverall.push(...mo.tmin);
      }
    }

    const annualRains      = annual.map(a => a.rainTotal).filter(v => v != null);
    const annualSuns       = annual.map(a => a.sunTotal).filter(v => v != null);
    const annualTemps      = annual.map(a => a.meanTemp).filter(v => v != null);
    const annualMaxRainDay = annual.map(a => a.maxRainDay).filter(v => v != null);

    const wettestIdx = annualRains.indexOf(Math.max(...annualRains));
    const driestIdx  = annualRains.indexOf(Math.min(...annualRains));

    const totalDaylight = Object.values(locData.daylight).reduce((a, b) => a + b, 0);

    const stats = {
      recordHigh:   allTmaxOverall.length ? r1(Math.max(...allTmaxOverall)) : null,
      avgYearlyHigh: r1(mean(annual.map(a => a.maxTmaxYear).filter(v => v != null))),
      avgHighTemp:  r1(mean(allTmaxOverall)),
      avgMeanTemp:  r1(mean(annualTemps)),
      avgLowTemp:   r1(mean(allTminOverall)),
      avgYearlyLow:  r1(mean(annual.map(a => a.minTminYear).filter(v => v != null))),
      recordLow:    allTminOverall.length ? r1(Math.min(...allTminOverall)) : null,

      recordWarmestLow:     allTminOverall.length ? r1(Math.max(...allTminOverall)) : null,
      avgYearlyWarmestLow:  r1(mean(annual.map(a => a.maxTminYear).filter(v => v != null))),
      recordColdestHigh:    allTmaxOverall.length ? r1(Math.min(...allTmaxOverall)) : null,
      avgYearlyColdestHigh: r1(mean(annual.map(a => a.minTmaxYear).filter(v => v != null))),

      avgAnnualRain:     r2(mean(annualRains)),
      wettestYear:       annualRains.length ? r2(Math.max(...annualRains)) : null,
      wettestYearNum:    annual[wettestIdx]?.year ?? null,
      driestYear:        annualRains.length ? r2(Math.min(...annualRains)) : null,
      driestYearNum:     annual[driestIdx]?.year ?? null,
      avgWettestDayYear: r2(mean(annualMaxRainDay)),

      avgAnnualSun:   r2(mean(annualSuns)),
      avgPctDaylight: (totalDaylight && mean(annualSuns) != null)
        ? r1(mean(annualSuns) / totalDaylight * 100)
        : null,
    };

    return { monthly, annual, stats, years };
  }

  return { compute, computeRolling };
})();
