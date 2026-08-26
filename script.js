const MH_ICON = {
  wifi: '📶',
  plug_sockets: '🔌',
  food: '🍽️',
  coffee: '☕',
  greenery: '🌿',
  dog_friendly: '🐶',
};

const state = {
  view: 'landing',
  vibes: new Set(),
  area: null,
  category: null,
  mustHaves: { wifi: null, plug_sockets: null, food: null, coffee: null, greenery: null, dog_friendly: null },
  candidates: [],
  order: [],
  pointer: -1,
  relaxedNotice: null,
};

// ---------- Filter option rendering (vibe / area / category / must-have) ----------

function renderVibeOptions() {
  const container = document.getElementById('options-vibe');
  container.innerHTML = '';
  VIBE_OPTIONS.forEach((opt) => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'opt-toggle' + (state.vibes.has(opt.value) ? ' selected' : '');
    btn.textContent = opt.label;
    btn.addEventListener('click', () => {
      if (state.vibes.has(opt.value)) state.vibes.delete(opt.value);
      else state.vibes.add(opt.value);
      renderVibeOptions();
    });
    container.appendChild(btn);
  });
}

function renderAreaOptions() {
  const container = document.getElementById('options-area');
  container.innerHTML = '';
  const all = [{ value: null, label: 'Any area' }, ...AREA_OPTIONS.map((a) => ({ value: a, label: a }))];
  all.forEach((opt) => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'opt-toggle' + (state.area === opt.value ? ' selected' : '');
    btn.textContent = opt.label;
    btn.addEventListener('click', () => {
      state.area = opt.value;
      renderAreaOptions();
    });
    container.appendChild(btn);
  });
}

function renderCategoryOptions() {
  const container = document.getElementById('options-category');
  container.innerHTML = '';
  const all = [{ value: null, label: 'Any category' }, ...CATEGORY_OPTIONS.map((c) => ({ value: c, label: c }))];
  all.forEach((opt) => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'opt-toggle' + (state.category === opt.value ? ' selected' : '');
    btn.textContent = opt.label;
    btn.addEventListener('click', () => {
      state.category = opt.value;
      renderCategoryOptions();
    });
    container.appendChild(btn);
  });
}

function renderMustHaveOptions() {
  const container = document.getElementById('options-musthave');
  container.innerHTML = '';
  MUST_HAVE_OPTIONS.forEach((opt) => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'opt-toggle' + (state.mustHaves[opt.value] === true ? ' selected' : '');
    btn.innerHTML = `${MH_ICON[opt.value]} ${opt.label}` + (opt.caveat ? `<span class="caveat">${opt.caveat}</span>` : '');
    btn.addEventListener('click', () => {
      state.mustHaves[opt.value] = state.mustHaves[opt.value] === true ? null : true;
      renderMustHaveOptions();
    });
    container.appendChild(btn);
  });
}

function renderFilterOptions() {
  renderVibeOptions();
  renderAreaOptions();
  renderCategoryOptions();
  renderMustHaveOptions();
}

// ---------- Matching ----------

function matchesFilters(place, { vibes, area, category, mustHaves }) {
  if (vibes.size > 0 && !place.vibes.some((v) => vibes.has(v))) return false;
  if (area && place.area !== area) return false;
  if (category && CATEGORY_DISPLAY[place.category] !== category) return false;
  for (const key of Object.keys(mustHaves)) {
    if (mustHaves[key] === true && place.must_haves[key] !== true) return false;
  }
  return true;
}

function rankByVibeOverlap(list, vibes) {
  return list
    .map((place) => ({ place, overlap: place.vibes.filter((v) => vibes.has(v)).length }))
    .sort((a, b) => b.overlap - a.overlap)
    .map((entry) => entry.place);
}

// Progressively relax the most restrictive filters first (must-haves, then category,
// then area) so an overly narrow combination never produces a dead-end empty screen.
function findCandidates() {
  const { vibes, area, category, mustHaves } = state;
  const noMustHaves = Object.fromEntries(Object.keys(mustHaves).map((k) => [k, null]));

  const stages = [
    { filters: { vibes, area, category, mustHaves }, notice: null },
    { filters: { vibes, area, category, mustHaves: noMustHaves }, notice: 'No exact matches — showing results with your must-have filters turned off.' },
    { filters: { vibes, area, category: null, mustHaves: noMustHaves }, notice: 'No exact matches — showing results from any category, with must-have filters turned off.' },
    { filters: { vibes, area: null, category: null, mustHaves: noMustHaves }, notice: 'No exact matches — showing results from any area or category, with must-have filters turned off.' },
    { filters: { vibes, area: null, category: null, mustHaves: noMustHaves }, notice: 'No exact matches for these vibes — showing all vibes instead.', vibesOverride: new Set() },
    { filters: { vibes: new Set(), area: null, category: null, mustHaves: noMustHaves }, notice: 'No exact matches — showing the full list of places.' },
  ];

  for (const stage of stages) {
    const f = stage.vibesOverride ? { ...stage.filters, vibes: stage.vibesOverride } : stage.filters;
    const matches = PLACES.filter((p) => matchesFilters(p, f));
    if (matches.length) {
      return { candidates: rankByVibeOverlap(matches, f.vibes), notice: stage.notice };
    }
  }
  return { candidates: [], notice: null };
}

function shuffle(array) {
  const a = array.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// ---------- Navigation ----------

function showScreen(id) {
  document.querySelectorAll('.screen').forEach((s) => s.classList.remove('active'));
  document.getElementById(id).classList.add('active');
}

function goLanding() {
  state.view = 'landing';
  showScreen('screen-landing');
}

function goFilters() {
  state.view = 'filters';
  renderFilterOptions();
  showScreen('screen-filters');
}

function goFindResult() {
  const { candidates, notice } = findCandidates();
  state.candidates = candidates;
  state.relaxedNotice = notice;
  if (candidates.length === 0) {
    // Should not happen (the final relaxation stage is the unfiltered catalog), but guard anyway.
    state.order = [];
    state.pointer = -1;
    goFilters();
    return;
  }
  state.order = shuffle(candidates.map((_, i) => i));
  state.pointer = 0;
  state.view = 'result';
  renderResult();
  showScreen('screen-result');
}

function showAlternative() {
  if (state.candidates.length <= 1) return;
  const lastShownIndex = state.order[state.pointer];
  state.pointer++;
  if (state.pointer >= state.order.length) {
    // Exhausted this pass through the candidate pool — reshuffle and start again,
    // just making sure the new first pick isn't the same place we're already looking at.
    let reshuffled = shuffle(state.candidates.map((_, i) => i));
    if (reshuffled[0] === lastShownIndex && reshuffled.length > 1) {
      [reshuffled[0], reshuffled[1]] = [reshuffled[1], reshuffled[0]];
    }
    state.order = reshuffled;
    state.pointer = 0;
  }
  // Only the first result screen after a filter submit shows the relaxation banner —
  // subsequent alternatives are all drawn from that same (possibly relaxed) candidate pool.
  state.relaxedNotice = null;
  renderResult();
}

function backFromResult() {
  goFilters();
}

function restart() {
  state.vibes = new Set();
  state.area = null;
  state.category = null;
  state.mustHaves = { wifi: null, plug_sockets: null, food: null, coffee: null, greenery: null, dog_friendly: null };
  state.candidates = [];
  state.order = [];
  state.pointer = -1;
  state.relaxedNotice = null;
  goLanding();
}

// ---------- Result rendering ----------

function isPlaceholder(text, needles) {
  const lower = (text || '').toLowerCase();
  return needles.some((n) => lower.includes(n));
}

function buildMapsQuery(place) {
  const addressPart = isPlaceholder(place.address, ['check address'])
    ? place.neighbourhood
    : place.address;
  return encodeURIComponent(`${place.name}, ${addressPart}, London`);
}

function fitText(place) {
  const matched = place.vibes.filter((v) => state.vibes.has(v));
  const labels = matched.map((v) => VIBE_LABELS[v]);
  if (labels.length === 1) return `Great for: ${labels[0]}`;
  if (labels.length > 1) return `Matches: ${labels.join(', ')}`;
  return `Tagged: ${VIBE_LABELS[place.vibes[0]] || 'a good all-rounder'}`;
}

function renderMustHaveChip(place, key, label) {
  const value = place.must_haves[key];
  const icon = MH_ICON[key];
  if (value === true) return `<span class="mh-chip mh-yes">${icon} ${label}</span>`;
  if (value === false) return `<span class="mh-chip mh-no">${icon} ${label} — not available</span>`;
  return `<span class="mh-chip mh-unknown">${icon} ${label} — not confirmed</span>`;
}

function currentPlace() {
  return state.candidates[state.order[state.pointer]];
}

function renderResult() {
  const place = currentPlace();

  const banner = document.getElementById('result-banner');
  if (state.relaxedNotice) {
    banner.textContent = state.relaxedNotice;
    banner.hidden = false;
  } else {
    banner.hidden = true;
  }

  document.getElementById('result-category').textContent = CATEGORY_DISPLAY[place.category] + ' · ' + place.area;
  document.getElementById('result-name').textContent = place.name;
  document.getElementById('result-fit').textContent = fitText(place);

  const addressEl = document.getElementById('result-address');
  if (isPlaceholder(place.address, ['check address'])) {
    addressEl.textContent = `Address not confirmed — check before visiting (near ${place.neighbourhood}).`;
    addressEl.classList.add('unconfirmed');
  } else {
    addressEl.textContent = place.address;
    addressEl.classList.remove('unconfirmed');
  }
  document.getElementById('result-maps').href = `https://www.google.com/maps/search/?api=1&query=${buildMapsQuery(place)}`;

  const hoursEl = document.getElementById('result-hours');
  if (isPlaceholder(place.hours, ['check hours', 'check current hours'])) {
    hoursEl.textContent = 'Hours not confirmed — check ahead.';
    hoursEl.classList.add('unconfirmed');
  } else {
    hoursEl.textContent = place.hours;
    hoursEl.classList.remove('unconfirmed');
  }

  const priceEl = document.getElementById('result-price');
  if (isPlaceholder(place.price, ['verify'])) {
    priceEl.textContent = `${place.price} (price unverified — confirm before visiting)`;
    priceEl.classList.add('unconfirmed');
  } else {
    priceEl.textContent = place.price;
    priceEl.classList.remove('unconfirmed');
  }

  document.getElementById('result-notes').textContent = place.notes;

  document.getElementById('result-musthaves').innerHTML = MUST_HAVE_OPTIONS
    .map((opt) => renderMustHaveChip(place, opt.value, opt.label))
    .join('');

  document.getElementById('result-vibes').innerHTML = place.vibes
    .map((v) => `<span class="chip">${VIBE_LABELS[v]}</span>`)
    .join('');
}

// ---------- Init ----------

function init() {
  document.getElementById('btn-start').addEventListener('click', goFilters);
  document.querySelectorAll('[data-back]').forEach((btn) => btn.addEventListener('click', goLanding));
  document.getElementById('btn-find').addEventListener('click', goFindResult);
  document.getElementById('btn-alternative').addEventListener('click', showAlternative);
  document.getElementById('btn-result-back').addEventListener('click', backFromResult);
  document.getElementById('btn-restart').addEventListener('click', restart);
}

init();
