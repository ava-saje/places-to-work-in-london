# Where to Work From in London

A tiny, free web app: pick a vibe (and optionally an area, category, or must-haves like wifi/plugs/dog-friendly), and get shown one real London spot to work from — with address, a Google Maps link, hours, price, and honest notes on anything unverified. Tap "Show alternative" for another match, "Back" to change filters, or "Restart" to start over.

## Running it

No build step, no dependencies. Either:

- Double-click `index.html` to open it directly in a browser, or
- Serve the folder (optional, not required): `python3 -m http.server 8000` then visit `http://localhost:8000`

## Files

- `index.html` — markup for the three screens (landing, vibe & filters, result)
- `style.css` — all styling (custom properties for the color palette, mobile-first with a desktop "card" breakpoint at 640px)
- `data.js` — the 179 places (inlined from `london_wfh_places.json`) plus lookup tables (`CATEGORY_DISPLAY`, `VIBE_LABELS`, etc.)
- `script.js` — state, filtering/matching logic, and rendering
- `london_wfh_places.json` — the original source data, kept alongside as the source of truth

## Refreshing the data

If `london_wfh_places.json` is updated, regenerate the `PLACES` array in `data.js` by re-running this from the project folder (this only replaces the generated block, so re-add the lookup tables below `PLACES` again if you regenerate from scratch):

```bash
node -e "
const fs = require('fs');
const places = JSON.parse(fs.readFileSync('london_wfh_places.json', 'utf8'));
console.log('const PLACES = ' + JSON.stringify(places, null, 2) + ';');
" > /tmp/places-block.txt
```

Then paste the output over the `const PLACES = [...]` block at the top of `data.js`, leaving the `CATEGORY_DISPLAY` / `AREA_OPTIONS` / `VIBE_OPTIONS` / `MUST_HAVE_OPTIONS` tables below it untouched.

## Known data gaps (surfaced in the app, not hidden)

- Some places only have a neighbourhood, not a full street address — the app shows an honest "address not confirmed" notice for these and builds the Google Maps link from the neighbourhood instead.
- Some hours are marked as unconfirmed in the source data — shown the same way.
- A few coworking day-pass prices are marked "verify" (pricing changes) — the app appends an "unverified" note rather than presenting them as guaranteed.
- `wifi` and `plug_sockets` are the two least-verified must-haves in the dataset (most places are tagged "not confirmed" rather than a hard yes/no) — the app never shows "not confirmed" as if it were a hard no, and the filter toggles for these two are labeled accordingly.
- Bookshop café and department-store-derived bistro categories have fewer entries than the others — fine for now, worth growing first if more data is added later.

## Open items not yet decided

- Final branding/landing-page wording — current copy is a placeholder, easy to swap in `index.html`.
- No email collection in this version.
