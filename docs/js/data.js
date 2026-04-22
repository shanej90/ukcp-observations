// Fetches and caches location index + summary JSON files.
const DataStore = (() => {
  const BASE = 'data/';
  const cache = {};

  async function loadIndex() {
    if (cache.__index) return cache.__index;
    const r = await fetch(BASE + 'index.json');
    if (!r.ok) throw new Error('Failed to load index.json');
    cache.__index = await r.json();
    return cache.__index;
  }

  async function loadLocation(slug) {
    if (cache[slug]) return cache[slug];
    const r = await fetch(`${BASE}${slug}/summary.json`);
    if (!r.ok) throw new Error(`Failed to load ${slug}/summary.json`);
    cache[slug] = await r.json();
    return cache[slug];
  }

  return { loadIndex, loadLocation };
})();
