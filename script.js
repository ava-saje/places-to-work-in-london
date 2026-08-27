const MH_ICON = {
  wifi: '📶',
  plug_sockets: '🔌',
  food: '🍽️',
  coffee: '☕',
  greenery: '🌿',
  dog_friendly: '🐶',
};

// Step-flow question options — defined here (not in data.js) so this file owns the
// question copy independently of the generated PLACES data block.
const AREA_STEP_OPTIONS = [
  { value: 'Central', title: 'Central', sub: 'West End, City, Southbank' },
  { value: 'North', title: 'North', sub: 'Camden, Islington, Hampstead' },
  { value: 'South', title: 'South', sub: 'Brixton, Greenwich, Battersea' },
  { value: 'East', title: 'East', sub: 'Shoreditch, Hackney, Canary Wharf' },
  { value: 'West', title: 'West', sub: 'Notting Hill, Kensington, Chelsea' },
  { value: null, title: 'Anywhere', sub: "Don't mind travelling" },
];

const CATEGORY_SUB = {
  'Hotel lobbies': 'Plush lounges, free to sit',
  'Coffee shops': 'Laptop-friendly cafés',
  'Bistros & cafés': 'Sit-down, order food',
  'Pubs': 'Pints, wifi, all-day tables',
  'Paid coworking': 'Day passes, proper desks',
  'Bookshop cafés': 'Books plus coffee',
  'Public libraries / museums / galleries': 'Free, quiet, no pressure to order',
  'Garden squares / outdoor cafés': 'Fresh air, greenery',
};

const CATEGORY_STEP_OPTIONS = [
  ...CATEGORY_OPTIONS.map((label) => ({ value: label, title: label, sub: CATEGORY_SUB[label] || '' })),
  { value: null, title: 'Any category', sub: 'Show me everything' },
];

const STEP_IDS = ['area', 'category', 'vibe', 'musthaves'];
let currentStepIndex = 0;

const state = {
  view: 'landing',
  area: null,
  category: null,
  vibes: new Set(),
  mustHaves: { wifi: null, plug_sockets: null, food: null, coffee: null, greenery: null, dog_friendly: null },
  candidates: [],
  order: [],
  pointer: -1,
};

// ---------- Step rendering ----------

function renderChoiceStep(field, options, containerId) {
  const container = document.getElementById(containerId);
  container.innerHTML = '';
  options.forEach((opt) => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'option-card' + (state[field] === opt.value ? ' selected' : '');
    btn.innerHTML = `<span class="opt-title">${opt.title}</span>` +
      (opt.sub ? `<span class="opt-sub">${opt.sub}</span>` : '');
    btn.addEventListener('click', () => {
      state[field] = opt.value;
      advanceStep();
    });
    container.appendChild(btn);
  });
}

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

function renderMustHaveOptions() {
  const container = document.getElementById('options-musthave');
  container.innerHTML = '';
  MUST_HAVE_OPTIONS.forEach((opt) => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'opt-toggle' + (state.mustHaves[opt.value] === true ? ' selected' : '');
    btn.textContent = `${MH_ICON[opt.value]} ${opt.label}`;
    btn.addEventListener('click', () => {
      state.mustHaves[opt.value] = state.mustHaves[opt.value] === true ? null : true;
      renderMustHaveOptions();
    });
    container.appendChild(btn);
  });
}

function renderStepScreen() {
  document.querySelectorAll('.screen').forEach((s) => s.classList.remove('active'));
  const field = STEP_IDS[currentStepIndex];
  document.getElementById('screen-' + field).classList.add('active');

  if (field === 'area') renderChoiceStep('area', AREA_STEP_OPTIONS, 'options-area');
  if (field === 'category') renderChoiceStep('category', CATEGORY_STEP_OPTIONS, 'options-category');
  if (field === 'vibe') renderVibeOptions();
  if (field === 'musthaves') renderMustHaveOptions();

  setProgressVisible(true);
  updateProgress();
}

function setProgressVisible(visible) {
  document.getElementById('progress').style.visibility = visible ? 'visible' : 'hidden';
}

function updateProgress() {
  const dots = document.querySelectorAll('#progress .dot');
  dots.forEach((dot, i) => {
    dot.classList.toggle('filled', i < currentStepIndex);
    dot.classList.toggle('current', i === currentStepIndex);
  });
}

function advanceStep() {
  if (currentStepIndex < STEP_IDS.length - 1) {
    currentStepIndex++;
    renderStepScreen();
  }
}

function handleBack() {
  if (currentStepIndex > 0) {
    currentStepIndex--;
    renderStepScreen();
  } else {
    goLanding();
  }
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
// This happens silently — no on-screen explanation of what got relaxed.
function findCandidates() {
  const { vibes, area, category, mustHaves } = state;
  const noMustHaves = Object.fromEntries(Object.keys(mustHaves).map((k) => [k, null]));

  // Category and area were each a deliberate, single dedicated question — relax those
  // last. Vibes and must-haves are the "soft" preferences, so those give way first.
  const stages = [
    { vibes, area, category, mustHaves },
    { vibes, area, category, mustHaves: noMustHaves },
    { vibes: new Set(), area, category, mustHaves: noMustHaves },
    { vibes: new Set(), area: null, category, mustHaves: noMustHaves },
    { vibes: new Set(), area: null, category: null, mustHaves: noMustHaves },
  ];

  for (const filters of stages) {
    const matches = PLACES.filter((p) => matchesFilters(p, filters));
    if (matches.length) return rankByVibeOverlap(matches, filters.vibes);
  }
  return [];
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
  setProgressVisible(false);
  showScreen('screen-landing');
}

function goFindResult() {
  const candidates = findCandidates();
  state.candidates = candidates;
  if (candidates.length === 0) {
    state.order = [];
    state.pointer = -1;
    renderStepScreen();
    return;
  }
  state.order = shuffle(candidates.map((_, i) => i));
  state.pointer = 0;
  state.view = 'result';
  setProgressVisible(false);
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
  renderResult();
}

// From the result screen, currentStepIndex is still sitting on the last step (musthaves) —
// we never advance past it before calling goFindResult(). So "Back" just re-shows that step.
function backFromResult() {
  renderStepScreen();
}

function restart() {
  currentStepIndex = 0;
  state.area = null;
  state.category = null;
  state.vibes = new Set();
  state.mustHaves = { wifi: null, plug_sockets: null, food: null, coffee: null, greenery: null, dog_friendly: null };
  state.candidates = [];
  state.order = [];
  state.pointer = -1;
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

function currentPlace() {
  return state.candidates[state.order[state.pointer]];
}

// Turns the free-text price field into a quick £ tier when it's just a vague
// category label ("Cafe prices", "Restaurant prices", ...) — keeps genuinely
// specific info (real numbers, "Free", explicit day rates) exactly as-is.
function priceDisplay(rawPrice) {
  const text = rawPrice || '';
  const lower = text.toLowerCase();

  if (/£\d/.test(text)) return text; // has a real number — don't flatten it
  if (lower.startsWith('free')) return text; // already short and specific enough

  if (lower.includes('not listed') || (lower.includes('verify') && !/£/.test(text))) {
    return 'Price not listed — worth checking';
  }

  if (/price|pricing/.test(lower)) {
    if (/(fine dining|champagne|premium|luxury|seafood|department-store)/.test(lower)) return '£££ · upscale';
    if (/(restaurant|bistro|cocktail|wine bar|food hall|tearoom|pub)/.test(lower)) return '££ · mid-range';
    if (/(cafe|coffee)/.test(lower)) return '£ · casual';
  }

  return text;
}

function renderResult() {
  const place = currentPlace();

  document.getElementById('result-category').textContent = CATEGORY_DISPLAY[place.category] + ' · ' + place.area;
  document.getElementById('result-name').textContent = place.name;

  const addressEl = document.getElementById('result-address');
  addressEl.textContent = isPlaceholder(place.address, ['check address'])
    ? `Exact address not listed — it's in ${place.neighbourhood}.`
    : place.address;
  document.getElementById('result-maps').href = `https://www.google.com/maps/search/?api=1&query=${buildMapsQuery(place)}`;

  const hoursEl = document.getElementById('result-hours');
  hoursEl.textContent = isPlaceholder(place.hours, ['check hours', 'check current hours'])
    ? 'Hours vary — worth checking ahead.'
    : place.hours;

  document.getElementById('result-price').textContent = priceDisplay(place.price);

  document.getElementById('result-notes').textContent = place.notes;

  document.getElementById('result-vibes').innerHTML = place.vibes
    .map((v) => `<span class="chip">${VIBE_LABELS[v]}</span>`)
    .join('');
}

// ---------- Init ----------

function init() {
  document.getElementById('btn-start').addEventListener('click', () => {
    currentStepIndex = 0;
    renderStepScreen();
  });
  document.querySelectorAll('[data-back]').forEach((btn) => btn.addEventListener('click', handleBack));
  document.getElementById('btn-vibe-next').addEventListener('click', advanceStep);
  document.getElementById('btn-find').addEventListener('click', goFindResult);
  document.getElementById('btn-alternative').addEventListener('click', showAlternative);
  document.getElementById('btn-result-back').addEventListener('click', backFromResult);
  document.getElementById('btn-restart').addEventListener('click', restart);

  setProgressVisible(false);
}

init();
