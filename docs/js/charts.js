// Renders all Chart.js charts. Destroys previous instances before re-rendering.
const Charts = (() => {

  const LABELS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

  const COL = {
    blue:        '#2563eb',
    orange:      '#f97316',
    blueA:   (a) => `rgba(37,99,235,${a})`,
    orangeA: (a) => `rgba(249,115,22,${a})`,
  };

  const _instances = {};

  function _make(id, config) {
    if (_instances[id]) { _instances[id].destroy(); }
    const ctx = document.getElementById(id);
    if (!ctx) return;
    _instances[id] = new Chart(ctx, config);
    return _instances[id];
  }

  function _baseOpts(extra = {}) {
    return {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { display: false }, tooltip: { mode: 'index', intersect: false } },
      ...extra,
    };
  }

  function _monthAxis() {
    return { type: 'category', labels: LABELS, grid: { display: false } };
  }

  function _yearAxis(years) {
    return {
      type: 'category',
      labels: years.map(String),
      grid: { display: false },
      ticks: { maxTicksLimit: 15, maxRotation: 0 },
    };
  }

  function _tempY(label = 'Temperature (°C)') {
    return { title: { display: true, text: label, font: { size: 11 } }, grid: { color: '#f1f5f9' } };
  }

  function _mmY() {
    return { title: { display: true, text: 'mm', font: { size: 11 } }, min: 0, grid: { color: '#f1f5f9' } };
  }

  function _daysY() {
    return { title: { display: true, text: 'Days', font: { size: 11 } }, min: 0, grid: { color: '#f1f5f9' } };
  }

  // ── Temperature range (monthly) ────────────────────────────────────────────

  function renderTempRange(pm, cm, pName, cName) {
    const datasets = [];

    function addSeries(m, color, colorA, name) {
      datasets.push({
        label: `${name} avg range`,
        data: m.monthly.map(mo => [mo.avgLow, mo.avgHigh]),
        backgroundColor: colorA(0.25),
        borderColor: colorA(0.6),
        borderWidth: 1,
        borderSkipped: false,
        barPercentage: 0.55,
        categoryPercentage: cm ? 0.42 : 0.65,
        order: 3,
      });
      datasets.push({
        label: `${name} avg extremes`,
        data: m.monthly.map(mo => [mo.avgYearlyLow, mo.avgYearlyHigh]),
        backgroundColor: 'transparent',
        borderColor: color,
        borderWidth: 2,
        borderSkipped: false,
        barPercentage: 0.10,
        categoryPercentage: cm ? 0.42 : 0.65,
        order: 2,
      });
      datasets.push({
        label: `${name} mean`,
        type: 'line',
        data: m.monthly.map(mo => mo.mean),
        borderColor: color,
        borderWidth: 2,
        pointRadius: 3,
        pointBackgroundColor: color,
        fill: false,
        tension: 0.3,
        order: 1,
      });
      datasets.push({
        label: `${name} record high`,
        type: 'line',
        data: m.monthly.map(mo => mo.recordHigh),
        borderColor: 'transparent',
        backgroundColor: color,
        pointRadius: 4,
        pointStyle: 'triangle',
        showLine: false,
        order: 0,
      });
      datasets.push({
        label: `${name} record low`,
        type: 'line',
        data: m.monthly.map(mo => mo.recordLow),
        borderColor: 'transparent',
        backgroundColor: color,
        pointRadius: 4,
        pointStyle: 'triangle',
        pointRotation: 180,
        showLine: false,
        order: 0,
      });
    }

    addSeries(pm, COL.blue, COL.blueA, pName);
    if (cm) addSeries(cm, COL.orange, COL.orangeA, cName);

    _make('chart-temp-range', {
      type: 'bar',
      data: { labels: LABELS, datasets },
      options: _baseOpts({
        scales: { x: _monthAxis(), y: _tempY() },
        plugins: {
          legend: { display: false },
          tooltip: {
            mode: 'index',
            intersect: false,
            callbacks: {
              label: ctx => {
                const v = ctx.raw;
                if (Array.isArray(v)) return `${ctx.dataset.label}: ${v[0]}°C – ${v[1]}°C`;
                return v != null ? `${ctx.dataset.label}: ${v}°C` : null;
              },
            },
          },
        },
      }),
    });
  }

  // ── Threshold days — grouped (not stacked) ─────────────────────────────────

  function renderTempCold(pm, cm, pName, cName) {
    const thresholds = ['10°C', '5°C', '0°C'];
    const keys       = ['coldBelow10', 'coldBelow5', 'coldBelow0'];
    const datasets   = [];

    keys.forEach((k, i) => {
      datasets.push({
        label: `${pName} < ${thresholds[i]}`,
        data: pm.monthly.map(mo => mo[k]),
        backgroundColor: COL.blueA(0.85 - i * 0.2),
        borderColor: COL.blue,
        borderWidth: 1,
      });
    });
    if (cm) {
      keys.forEach((k, i) => {
        datasets.push({
          label: `${cName} < ${thresholds[i]}`,
          data: cm.monthly.map(mo => mo[k]),
          backgroundColor: COL.orangeA(0.85 - i * 0.2),
          borderColor: COL.orange,
          borderWidth: 1,
        });
      });
    }

    _make('chart-temp-cold', {
      type: 'bar',
      data: { labels: LABELS, datasets },
      options: _baseOpts({ scales: { x: _monthAxis(), y: _daysY() } }),
    });
  }

  function renderTempHot(pm, cm, pName, cName) {
    const thresholds = ['15°C', '20°C', '25°C', '30°C'];
    const keys       = ['warm15', 'warm20', 'warm25', 'warm30'];
    const datasets   = [];

    keys.forEach((k, i) => {
      datasets.push({
        label: `${pName} ≥ ${thresholds[i]}`,
        data: pm.monthly.map(mo => mo[k]),
        backgroundColor: COL.blueA(0.85 - i * 0.15),
        borderColor: COL.blue,
        borderWidth: 1,
      });
    });
    if (cm) {
      keys.forEach((k, i) => {
        datasets.push({
          label: `${cName} ≥ ${thresholds[i]}`,
          data: cm.monthly.map(mo => mo[k]),
          backgroundColor: COL.orangeA(0.85 - i * 0.15),
          borderColor: COL.orange,
          borderWidth: 1,
        });
      });
    }

    _make('chart-temp-hot', {
      type: 'bar',
      data: { labels: LABELS, datasets },
      options: _baseOpts({ scales: { x: _monthAxis(), y: _daysY() } }),
    });
  }

  // ── Temperature annual ─────────────────────────────────────────────────────

  function renderTempAnnual(pm, cm, pName, cName) {
    const datasets = [{
      label: pName,
      data: pm.annual.map(a => a.meanTemp),
      borderColor: COL.blue,
      backgroundColor: COL.blueA(0.1),
      borderWidth: 2,
      pointRadius: 2,
      fill: true,
      tension: 0.3,
    }];
    if (cm) datasets.push({
      label: cName,
      data: cm.annual.map(a => a.meanTemp),
      borderColor: COL.orange,
      backgroundColor: COL.orangeA(0.1),
      borderWidth: 2,
      pointRadius: 2,
      fill: true,
      tension: 0.3,
    });

    _make('chart-temp-annual', {
      type: 'line',
      data: { labels: pm.years.map(String), datasets },
      options: _baseOpts({ scales: { x: _yearAxis(pm.years), y: _tempY() } }),
    });
  }

  function _avgAnnual(metrics, key) {
    const vals = metrics.annual.map(a => a[key]).filter(v => v != null);
    return vals.length ? Math.round((vals.reduce((a, b) => a + b, 0) / vals.length) * 10) / 10 : null;
  }

  function _renderAvgAnnualThreshold(canvasId, pm, cm, pName, cName, keys, labels) {
    const datasets = [{
      label: pName,
      data: keys.map(k => _avgAnnual(pm, k)),
      backgroundColor: COL.blueA(0.7),
      borderColor: COL.blue,
      borderWidth: 1,
    }];
    if (cm) datasets.push({
      label: cName,
      data: keys.map(k => _avgAnnual(cm, k)),
      backgroundColor: COL.orangeA(0.7),
      borderColor: COL.orange,
      borderWidth: 1,
    });
    _make(canvasId, {
      type: 'bar',
      data: { labels, datasets },
      options: _baseOpts({ scales: { x: { grid: { display: false } }, y: _daysY() } }),
    });
  }

  function renderTempFrostAnnual(pm, cm, pName, cName) {
    _renderAvgAnnualThreshold(
      'chart-temp-cold-annual', pm, cm, pName, cName,
      ['coldBelow10', 'coldBelow5', 'coldBelow0'],
      ['< 10°C', '< 5°C', '< 0°C']
    );
  }

  function renderTempHotAnnual(pm, cm, pName, cName) {
    _renderAvgAnnualThreshold(
      'chart-temp-hot-annual', pm, cm, pName, cName,
      ['warm15', 'warm20', 'warm25', 'warm30'],
      ['≥ 15°C', '≥ 20°C', '≥ 25°C', '≥ 30°C']
    );
  }

  // ── Rainfall monthly ── grouped (not stacked) ──────────────────────────────

  function renderRainTotal(pm, cm, pName, cName) {
    const datasets = [{
      label: pName,
      data: pm.monthly.map(mo => mo.avgRainTotal),
      backgroundColor: COL.blueA(0.7),
      borderColor: COL.blue,
      borderWidth: 1,
    }];
    if (cm) datasets.push({
      label: cName,
      data: cm.monthly.map(mo => mo.avgRainTotal),
      backgroundColor: COL.orangeA(0.7),
      borderColor: COL.orange,
      borderWidth: 1,
    });

    _make('chart-rain-total', {
      type: 'bar',
      data: { labels: LABELS, datasets },
      options: _baseOpts({ scales: { x: _monthAxis(), y: _mmY() } }),
    });
  }

  function renderRainDays(pm, cm, pName, cName) {
    const thresholds = ['0.25 mm', '1 mm', '10 mm'];
    const keys       = ['rainyDays025', 'rainyDays1', 'rainyDays10'];
    const datasets   = [];

    keys.forEach((k, i) => {
      datasets.push({
        label: `${pName} ≥ ${thresholds[i]}`,
        data: pm.monthly.map(mo => mo[k]),
        backgroundColor: COL.blueA(0.8 - i * 0.2),
        borderColor: COL.blue,
        borderWidth: 1,
      });
    });
    if (cm) {
      keys.forEach((k, i) => {
        datasets.push({
          label: `${cName} ≥ ${thresholds[i]}`,
          data: cm.monthly.map(mo => mo[k]),
          backgroundColor: COL.orangeA(0.8 - i * 0.2),
          borderColor: COL.orange,
          borderWidth: 1,
        });
      });
    }

    _make('chart-rain-days', {
      type: 'bar',
      data: { labels: LABELS, datasets },
      options: _baseOpts({ scales: { x: _monthAxis(), y: _daysY() } }),
    });
  }

  function renderRainMaxDay(pm, cm, pName, cName) {
    const datasets = [{
      label: pName,
      data: pm.monthly.map(mo => mo.avgMaxRainDay),
      backgroundColor: COL.blueA(0.7),
      borderColor: COL.blue,
      borderWidth: 1,
    }];
    if (cm) datasets.push({
      label: cName,
      data: cm.monthly.map(mo => mo.avgMaxRainDay),
      backgroundColor: COL.orangeA(0.7),
      borderColor: COL.orange,
      borderWidth: 1,
    });

    _make('chart-rain-maxday', {
      type: 'bar',
      data: { labels: LABELS, datasets },
      options: _baseOpts({ scales: { x: _monthAxis(), y: _mmY() } }),
    });
  }

  // ── Rainfall annual ────────────────────────────────────────────────────────

  function _lineChart(canvasId, pm, cm, pName, cName, yearKey, yAxis) {
    const datasets = [{
      label: pName,
      data: pm.annual.map(a => a[yearKey]),
      borderColor: COL.blue,
      backgroundColor: COL.blueA(0.1),
      borderWidth: 2,
      pointRadius: 2,
      fill: true,
      tension: 0.3,
      spanGaps: true,
    }];
    if (cm) datasets.push({
      label: cName,
      data: cm.annual.map(a => a[yearKey]),
      borderColor: COL.orange,
      backgroundColor: COL.orangeA(0.1),
      borderWidth: 2,
      pointRadius: 2,
      fill: true,
      tension: 0.3,
      spanGaps: true,
    });
    _make(canvasId, {
      type: 'line',
      data: { labels: pm.years.map(String), datasets },
      options: _baseOpts({ scales: { x: _yearAxis(pm.years), y: yAxis } }),
    });
  }

  function renderRainAnnual(pm, cm, pName, cName) {
    _lineChart('chart-rain-annual', pm, cm, pName, cName, 'rainTotal', _mmY());
  }

  function renderRainAnnualMaxDay(pm, cm, pName, cName) {
    _lineChart('chart-rain-annual-maxday', pm, cm, pName, cName, 'maxRainDay', _mmY());
  }

  function renderRainAnnualDays(pm, cm, pName, cName) {
    _renderAvgAnnualThreshold(
      'chart-rain-annual-days', pm, cm, pName, cName,
      ['rainyDays025', 'rainyDays1', 'rainyDays10'],
      ['≥ 0.25 mm', '≥ 1 mm', '≥ 10 mm']
    );
  }

  // ── Sunshine monthly — split into two charts ───────────────────────────────

  function renderSunMonthlyHours(pm, cm, pName, cName) {
    const datasets = [{
      label: pName,
      data: pm.monthly.map(mo => mo.avgSunHours),
      backgroundColor: COL.blueA(0.55),
      borderColor: COL.blue,
      borderWidth: 1,
    }];
    if (cm) datasets.push({
      label: cName,
      data: cm.monthly.map(mo => mo.avgSunHours),
      backgroundColor: COL.orangeA(0.55),
      borderColor: COL.orange,
      borderWidth: 1,
    });

    _make('chart-sun-monthly-hours', {
      type: 'bar',
      data: { labels: LABELS, datasets },
      options: _baseOpts({
        scales: {
          x: _monthAxis(),
          y: { title: { display: true, text: 'Hours', font: { size: 11 } }, min: 0, grid: { color: '#f1f5f9' } },
        },
      }),
    });
  }

  function renderSunMonthlyPct(pm, cm, pName, cName) {
    const datasets = [{
      label: pName,
      data: pm.monthly.map(mo => mo.pctDaylight),
      borderColor: COL.blue,
      borderWidth: 2,
      pointRadius: 3,
      pointBackgroundColor: COL.blue,
      fill: false,
      tension: 0.3,
    }];
    if (cm) datasets.push({
      label: cName,
      data: cm.monthly.map(mo => mo.pctDaylight),
      borderColor: COL.orange,
      borderWidth: 2,
      pointRadius: 3,
      pointBackgroundColor: COL.orange,
      fill: false,
      tension: 0.3,
    });

    _make('chart-sun-monthly-pct', {
      type: 'line',
      data: { labels: LABELS, datasets },
      options: _baseOpts({
        scales: {
          x: _monthAxis(),
          y: { title: { display: true, text: '% of daylight', font: { size: 11 } }, min: 0, max: 100, grid: { color: '#f1f5f9' } },
        },
      }),
    });
  }

  // ── Sunshine annual ────────────────────────────────────────────────────────

  function renderSunAnnual(pm, cm, pName, cName) {
    _lineChart('chart-sun-annual', pm, cm, pName, cName, 'sunTotal', {
      title: { display: true, text: 'Hours', font: { size: 11 } }, min: 0, grid: { color: '#f1f5f9' },
    });
  }

  // ── Rolling trends ─────────────────────────────────────────────────────────

  function renderRolling(pRolling, cRolling, pName, cName, unit) {
    const allYears = [...new Set([
      ...pRolling.map(r => r.year),
      ...(cRolling || []).map(r => r.year),
    ])].sort((a, b) => a - b);

    const pMap = Object.fromEntries(pRolling.map(r => [r.year, r.avg]));
    const cMap = cRolling ? Object.fromEntries(cRolling.map(r => [r.year, r.avg])) : {};

    const datasets = [{
      label: pName,
      data: allYears.map(y => pMap[y] ?? null),
      borderColor: COL.blue,
      borderWidth: 2.5,
      pointRadius: 0,
      fill: false,
      tension: 0.3,
      spanGaps: false,
    }];
    if (cRolling) datasets.push({
      label: cName,
      data: allYears.map(y => cMap[y] ?? null),
      borderColor: COL.orange,
      borderWidth: 2.5,
      pointRadius: 0,
      fill: false,
      tension: 0.3,
      spanGaps: false,
    });

    _make('chart-rolling', {
      type: 'line',
      data: { labels: allYears.map(String), datasets },
      options: _baseOpts({
        scales: {
          x: _yearAxis(allYears),
          y: { title: { display: true, text: unit, font: { size: 11 } }, grid: { color: '#f1f5f9' } },
        },
      }),
    });
  }

  return {
    renderTempRange,
    renderTempCold, renderTempHot,
    renderTempAnnual, renderTempFrostAnnual, renderTempHotAnnual,
    renderRainTotal, renderRainDays, renderRainMaxDay,
    renderRainAnnual, renderRainAnnualMaxDay, renderRainAnnualDays,
    renderSunMonthlyHours, renderSunMonthlyPct, renderSunAnnual,
    renderRolling,
  };
})();
