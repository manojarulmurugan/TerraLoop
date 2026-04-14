# TerraLoop 🌍
**Walk to Own the World** — UW-Madison · Claude Builder Club Hackathon

---

## Folder structure

```
terraloop/
├── index.html        ← open this in the browser
├── config.js         ← ⚠️  PUT YOUR API KEY HERE
├── css/
│   └── style.css     ← all styles
├── js/
│   ├── game.js       ← territory logic (no DOM)
│   ├── claude.js     ← Claude API calls
│   ├── ui.js         ← cards / toasts / DOM
│   └── map.js        ← Leaflet + app boot
└── README.md
```

---

## Start in 60 seconds

**Step 1 — Get API key**
Go to https://console.anthropic.com → API Keys → Create Key

**Step 2 — Paste key**
Open `config.js`, replace `YOUR_KEY_HERE` with your key

**Step 3 — Serve and open**
```bash
# in the terraloop/ folder:
npx serve .
# then open:  http://localhost:3000
```
> ⚠️  Must use `npx serve` — NOT `file://` (tiles won't load)

---

## Demo script (2 minutes)

| | Say | Do |
|--|-----|-----|
| 1 | "This is UW-Madison. Every building is claimable." | Point at map |
| 2 | "I'll walk around Memorial Union." | Click Start Loop → 5 clicks around Union |
| 3 | "Claude is naming my territory right now." | Click Close Loop, wait 2s |
| 4 | "I own Memorial Union." | Show territory card |
| 5 | "Now watch what happens with a squad." | Toggle Squad ON → draw overlapping loop |
| 6 | "Two people walking together — 2.2x stronger." | Show green territory |
| 7 | "Walk more, own more." | Draw bigger loop over first → takeover |

---

## Scaling roadmap (one feature at a time)

| Phase | What to add | File to change |
|-------|-------------|----------------|
| 2 | Real GPS tracking | `js/map.js` — uncomment `startGPS()` |
| 3 | Firebase realtime sync | `js/game.js` — swap array for DB |
| 4 | Lobby codes (real squad) | Add `js/session.js` |
| 5 | Backend (hide API key) | Change `ENDPOINT` in `js/claude.js` |
| 6 | Decay + push notifications | Use `Claude.generateDecayMessage()` |
| 7 | Precise overlap detection | Replace `overlaps()` with Turf.js |

---

## Who owns what

| Person | Files | Job |
|--------|-------|-----|
| P1 | `js/map.js`, `index.html` | Map, drawing, rendering |
| P2 | `js/game.js`, `config.js` | Logic, strength, takeover |
| P3 | `js/claude.js`, `js/ui.js` | Claude API, cards, toasts |
