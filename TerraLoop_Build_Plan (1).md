# TerraLoop — Complete Build Plan
### UW-Madison Hackathon · 3-Hour Execution Guide

---

## Table of Contents

1. [What Is TerraLoop](#1-what-is-terraloop)
2. [How the Game Works](#2-how-the-game-works)
3. [The Base MVP](#3-the-base-mvp)
4. [What We Are Building On Top](#4-what-we-are-building-on-top)
5. [Role Assignment](#5-role-assignment)
6. [Pre-Hackathon Setup — Do This Tonight](#6-pre-hackathon-setup--do-this-tonight)
7. [Firebase Setup](#7-firebase-setup)
8. [File Change Summary](#8-file-change-summary)
9. [HOUR 1 — Foundation (T+0 to T+60)](#9-hour-1--foundation-t0-to-t60)
10. [Checkpoint 1 — T+60](#10-checkpoint-1--t60)
11. [HOUR 2 — Integration (T+60 to T+120)](#11-hour-2--integration-t60-to-t120)
12. [Checkpoint 2 — T+105](#12-checkpoint-2--t105)
13. [HOUR 3 — Decay, Polish, Demo (T+120 to T+180)](#13-hour-3--decay-polish-demo-t120-to-t180)
14. [Checkpoint 3 — T+150](#14-checkpoint-3--t150)
15. [Deployment](#15-deployment)
16. [Demo Sequence — 3 People, 3 Phones](#16-demo-sequence--3-people-3-phones)
17. [Recording the Demo](#17-recording-the-demo)
18. [Troubleshooting](#18-troubleshooting)

---

## 1. What Is TerraLoop

TerraLoop is a real-world territory strategy game built as a mobile web app. Players physically walk GPS loops around real locations on the UW-Madison campus. The area enclosed by each walk becomes a territory on a live map. Claude AI names every territory and writes lore for it. Territories decay over time and can be challenged, taken over, or refreshed by patrolling.

**The demo tagline: Walk to Own the World.**

---

## 2. How the Game Works

### Loops

You open the app on your phone outside. You walk a route that returns close to where you started. The app traces your path using GPS. When you return within 15 meters of your starting point after collecting 20+ GPS coordinates, the loop auto-closes. The enclosed area becomes a shaded polygon on the map. Claude names it and generates lore.

Bigger loop = more area = higher strength score.

### Strength

```
strength = Math.min(99, Math.round((area_m2 / 40) * multiplier))
```

Solo multiplier: `1.0`. Squad multiplier: `2.2`.

A small loop around a building entrance scores ~25. A loop around a city block scores ~70. Camp Randall scores 99.

### Squads

A squad forms when two or more phones enter the same 4-letter lobby code and both complete their loops. No button press — the app detects it automatically via Firebase. Squad territory gets a 2.2x strength multiplier. A solo player with a large territory can still be beaten by two people walking a modest loop together. Squad always beats comparable solo.

### Takeover

When someone walks a loop overlapping an existing territory, the app compares strength scores. Higher strength wins. The defeated territory flashes red and disappears. If the attacker is weaker, they are blocked. Takeovers compare against the current decayed strength, not the original.

### Decay

Every territory loses strength continuously over time. A territory claimed and never revisited will fade to near zero. Current strength is calculated live from the original claim timestamp — nothing extra is written to Firebase.

```
currentStrength = max(1, originalStrength - floor(hoursElapsed * DECAY_RATE_PER_HOUR))
```

`DECAY_RATE_PER_HOUR` is set to `60` during the demo (1 strength per minute, visible in real time). In real gameplay it is set to `1` (1 strength per hour). **Change this constant before shipping to real players.**

### Patrolling

If you walk a new loop over your own territory, instead of a takeover, the app detects a patrol and resets the timestamp to now — fully restoring strength. This gives players a reason to return to territories they already own.

### Objective

Claim as much of UW-Madison as you can. Defend territories by patrolling them. Use squad mode to create territories that solo players cannot break. Let decayed territories become opportunities for others.

---

## 3. The Base MVP

A teammate already built a working MVP. This is the foundation everything below layers on top of.

```
terraloop/
├── index.html           App shell
├── config.js            UW-Madison landmarks, colors, game constants
├── css/style.css        Dark theme
├── js/game.js           Territory logic: area, strength, overlap, takeover
├── js/claude.js         Direct browser-to-Claude API calls
├── js/ui.js             Territory cards, toasts, loading overlay
└── js/map.js            Leaflet map, click-to-draw, app boot
```

**What it already does:**
- Full-screen Leaflet map centered on UW-Madison Memorial Union
- 9 hardcoded UW-Madison landmarks as subtle pins
- Shoelace formula for area calculation
- Centroid-radius overlap detection for takeover checks
- Takeover logic with strength comparison and red flash animation
- Claude API calls with separate solo and squad prompts returning `name`, `lore`, `energy`, `battle`, `reward`
- Territory card UI with strength bar, owner badge, reward
- Toast notifications for claims, blocks, and takeovers
- Loading overlay while Claude generates

**What it does NOT have yet:**
- Real GPS (click-to-draw only right now)
- Firebase multi-device sync
- Lobby codes for squad formation
- Two phones seeing each other on the map
- Territory decay
- Patrolling

---

## 4. What We Are Building On Top

We keep everything the MVP built and add four capabilities:

1. **Real GPS** — `watchPosition()` replaces click-to-draw entirely
2. **Firebase sync** — phones share a session, see each other as dots, territories persist across devices
3. **Lobby codes** — 4-letter codes let phones join the same session before walking
4. **Decay + patrolling** — territories weaken over time, patrolling restores them

---

## 5. Role Assignment

| Role | Files owned |
|---|---|
| Friend | `js/map.js` |
| Person 2 | `js/session.js` (new), `js/game.js`, `config.js` |
| Person 3 | `index.html`, `css/style.css`, `js/ui.js` |

---

## 6. Pre-Hackathon Setup — Do This Tonight

Do every item below before the hackathon. Walking in without this done costs 45 minutes.

### All three people
- [ ] Node.js 18+ installed — confirm with `node --version`
- [ ] Vercel CLI installed: `npm install -g vercel`
- [ ] Vercel account created at vercel.com (free)
- [ ] Cursor installed and signed in
- [ ] Clone the MVP repo — confirm you can open `index.html` via `npx serve .`

### Friend (map.js)
- [ ] Read through `js/map.js` fully — find the commented-out `startGPS()` block near the bottom and understand what it does
- [ ] Read through `js/game.js` fully — understand `checkTakeover()` because you will need to wire patrol detection into `closeLoop()`

### Person 2 (Firebase + Logic)
- [ ] Go to firebase.google.com → Create a new project called TerraLoop
- [ ] In the project: Build → Realtime Database → Create Database → US region → Start in test mode
- [ ] In Realtime Database → Rules tab, replace all content with:
  ```json
  {
    "rules": {
      ".read": true,
      ".write": true
    }
  }
  ```
  Click Publish.
- [ ] Go to Project Settings → Your apps → Add app → Web → copy the config object
- [ ] Share the Firebase config object in the group chat tonight
- [ ] Confirm the `databaseURL` field is present and ends in `.firebaseio.com`

### Person 3 (Deploy + UI)
- [ ] Run `vercel login` in terminal and confirm it works
- [ ] Test deploying any static folder to confirm your account works
- [ ] Get the Anthropic API key from console.anthropic.com and confirm it works:
  ```bash
  curl https://api.anthropic.com/v1/messages \
    -H "x-api-key: YOUR_KEY" \
    -H "anthropic-version: 2023-06-01" \
    -H "content-type: application/json" \
    -d '{"model":"claude-sonnet-4-6","max_tokens":50,"messages":[{"role":"user","content":"say ok"}]}'
  ```
  Must return a response with content. If 401, the key is wrong. If 429, generate a new key.

---

## 7. Firebase Setup

The Firebase config you paste into `config.js` comes from:
**Firebase Console → Project Settings → Your apps → SDK setup → Config**

It looks like this:

```javascript
{
  apiKey: "AIzaSy...",
  authDomain: "your-project.firebaseapp.com",
  databaseURL: "https://your-project-default-rtdb.firebaseio.com",
  projectId: "your-project",
  storageBucket: "your-project.appspot.com",
  messagingSenderId: "123456789",
  appId: "1:123456789:web:abc123"
}
```

The `databaseURL` field is the most commonly missed. Get it from the Realtime Database page in the console — the URL appears at the top of the Data tab. It always ends in `.firebaseio.com`. Without it, Firebase initializes silently and writes nothing.

### Firebase data schema

Agree on this before writing any code. All three people reference it.

```
/sessions/{code}/
  players/{phoneId}/
    pos:        { lat, lng, t }   <- latest GPS position only, not full path
    completed:  boolean            <- true when loop closes
    joinedAt:   timestamp
  squad:        boolean            <- auto-set when 2+ players complete

/territories/{id}/
  id, owner, session, isSquad, area,
  strength,    <- original strength at time of claim
  timestamp,   <- claim time; used to calculate current strength live
  lore         <- Claude output object
```

Only the latest GPS position is written to Firebase per tick. Loop detection runs locally on each phone. This keeps Firebase writes minimal and sync fast.

---

## 8. File Change Summary

| File | Change | Who |
|---|---|---|
| `js/session.js` | New file — all Firebase logic | Person 2 |
| `config.js` | Add Firebase config, PHONE_ID, C_TEAM, DECAY_RATE_PER_HOUR | Person 2 |
| `js/game.js` | Add patrol detection in `checkTakeover()`, add `getCurrentStrength()` | Person 2 |
| `js/map.js` | Replace click-to-draw with real GPS, wire session, add teammate dots, handle patrol return value | Friend |
| `index.html` | Add Firebase CDN scripts, add session.js to load order, add lobby HTML, remove click-draw buttons | Person 3 |
| `css/style.css` | Add lobby screen CSS, add teammate indicator styles | Person 3 |
| `js/ui.js` | Add lobby helpers, teammate indicator, decay-aware strength bar | Person 3 |
| `js/claude.js` | No changes | — |

---

## 9. HOUR 1 — Foundation (T+0 to T+60)

All three people work in parallel. No integration yet. Each person completes their Hour 1 tasks independently and waits at Checkpoint 1.

---

### FRIEND — Hour 1 — map.js GPS setup

**Goal:** Get real GPS working so a dot moves on the map when you walk. No Firebase yet.

**Step 1 — Open js/map.js in Cursor. Paste this exact prompt:**

```
I have a working Leaflet map app called TerraLoop. Modify js/map.js with
the following changes. Do NOT remove any existing functions except where
explicitly told to delete.

DELETIONS — remove these entirely:
- The onMapClick(e) function
- The line: map.on('click', onMapClick)
- The startDraw() function
- The cancelDraw() function
- Remove window.startDraw and window.cancelDraw from the window exports

ADDITIONS:

1. Add this variable at the top of the MapCtrl IIFE after existing declarations:
   let teammateLayers = {};

2. Replace the commented-out startGPS() block with this working version:
   function startGPS() {
     drawing = true;
     pts = [];
     markers = [];
     UI.setDrawState(true, 0);
     UI.toast('GPS active — walk your loop', 't-info');
     navigator.geolocation.watchPosition(
       pos => {
         const pt = { lat: pos.coords.latitude, lng: pos.coords.longitude };
         pts.push(pt);
         map.setView([pt.lat, pt.lng], map.getZoom());
         markers.push(
           L.circleMarker([pt.lat, pt.lng], {
             radius: 4,
             color: CONFIG.C_DRAW,
             fillColor: CONFIG.C_DRAW,
             fillOpacity: 1,
             weight: 2,
           }).addTo(map)
         );
         if (polyline) map.removeLayer(polyline);
         if (pts.length > 1) {
           polyline = L.polyline(
             [...pts, pts[0]].map(p => [p.lat, p.lng]),
             { color: CONFIG.C_DRAW, weight: 2.5, dashArray: '6 4', opacity: 0.85 }
           ).addTo(map);
         }
         UI.setDrawState(true, pts.length);
         if (pts.length > 20) {
           const d = Math.hypot(pt.lat - pts[0].lat, pt.lng - pts[0].lng) * 111000;
           if (d < 15) closeLoop();
         }
       },
       err => UI.toast('GPS error: ' + err.message, 't-err'),
       { enableHighAccuracy: true, maximumAge: 0 }
     );
   }

3. Add a placeholder startSession() function for now — wired to Firebase in Hour 2:
   async function startSession() {
     document.getElementById('lobby').classList.add('hidden');
     UI.toast('GPS starting...', 't-info');
     startGPS();
   }

4. In the existing init() function, add at the very end:
   const myCode = 'DEMO';
   document.getElementById('my-code').textContent = myCode;

5. Add to window exports at the bottom:
   window.startSession = startSession;

After changes verify that closeLoop(), renderTerritory(), removeLayer(),
and toggleSquad() are all still present and complete.
```

**Step 2 — Test on laptop:**

Run `npx serve .` in the project folder. Open `http://localhost:3000`. The lobby screen should appear showing the code "DEMO". Tap Start Run. The map loads. Open browser console — confirm no JavaScript errors.

---

### PERSON 2 — Hour 1 — session.js and config.js

**Goal:** Create `session.js` and patch `config.js` and `game.js`. No wiring yet.

**Step 1 — Patch config.js**

Open `config.js`. Add these four blocks inside the existing `CONFIG` object, after the `LANDMARKS` array:

```javascript
  // ── Firebase ──────────────────────────────────────────────
  FIREBASE: {
    apiKey:            "PASTE_FROM_FIREBASE_CONSOLE",
    authDomain:        "YOUR_PROJECT.firebaseapp.com",
    databaseURL:       "https://YOUR_PROJECT-default-rtdb.firebaseio.com",
    projectId:         "YOUR_PROJECT",
    storageBucket:     "YOUR_PROJECT.appspot.com",
    messagingSenderId: "000000000000",
    appId:             "1:000000000000:web:xxxxxxxxxxxxxxxx",
  },

  // ── Phone ID — stable per device, stored in localStorage ──
  PHONE_ID: (() => {
    const key = 'tl_pid';
    let id = localStorage.getItem(key);
    if (!id) {
      id = Math.random().toString(36).slice(2, 8).toUpperCase();
      localStorage.setItem(key, id);
    }
    return id;
  })(),

  // ── Teammate dot color (amber — distinct from blue self) ──
  C_TEAM: "#EF9F27",

  // ── Decay rate ────────────────────────────────────────────
  // Set to 60 for demo (1 strength per minute — visible in real time)
  // Set to 1 for real gameplay (1 strength per hour)
  // IMPORTANT: change this to 1 before shipping to real players
  DECAY_RATE_PER_HOUR: 60,
```

**Step 2 — Create js/session.js**

Create a new file `js/session.js`. Copy this entire file exactly:

```javascript
// ============================================================
//  js/session.js — Firebase sync layer
//  Handles: lobby codes, GPS position sync, squad detection,
//  territory persistence across devices
// ============================================================

const Session = (() => {

  let db, sessionCode;
  const phoneId = CONFIG.PHONE_ID;

  function init() {
    if (!firebase.apps.length) {
      firebase.initializeApp(CONFIG.FIREBASE);
    }
    db = firebase.database();
    console.log('[TerraLoop] Firebase ready. Phone ID:', phoneId);
  }

  function generateCode() {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
    return Array.from({ length: 4 }, () =>
      chars[Math.floor(Math.random() * chars.length)]
    ).join('');
  }

  async function join(code) {
    sessionCode = code.toUpperCase().trim();
    await db.ref(`/sessions/${sessionCode}/players/${phoneId}`).set({
      pos: null,
      completed: false,
      joinedAt: Date.now(),
    });
    console.log('[TerraLoop] Joined session:', sessionCode);
    return sessionCode;
  }

  // Lightweight set() — overwrites previous position only, never appends
  function pushPos(lat, lng) {
    if (!sessionCode || !db) return;
    db.ref(`/sessions/${sessionCode}/players/${phoneId}/pos`)
      .set({ lat, lng, t: Date.now() });
  }

  function markComplete() {
    if (!sessionCode || !db) return;
    db.ref(`/sessions/${sessionCode}/players/${phoneId}/completed`).set(true);
    db.ref(`/sessions/${sessionCode}/players`).once('value', snap => {
      const players = snap.val() || {};
      const done = Object.values(players).filter(p => p.completed).length;
      if (done >= 2) {
        db.ref(`/sessions/${sessionCode}/squad`).set(true);
        console.log('[TerraLoop] Squad auto-activated!');
      }
    });
  }

  function subscribe(onUpdate) {
    if (!sessionCode || !db) return;
    db.ref(`/sessions/${sessionCode}`).on('value', snap => {
      const session = snap.val() || {};
      const players = session.players || {};
      const teammates = Object.entries(players)
        .filter(([id]) => id !== phoneId)
        .map(([id, data]) => ({ id, pos: data.pos, completed: data.completed }))
        .filter(t => t.pos !== null && t.pos !== undefined);
      onUpdate({
        teammates,
        squad: session.squad || false,
        playerCount: Object.keys(players).length,
      });
    });
  }

  function saveTerritory(t) {
    if (!db) return;
    db.ref(`/territories/${t.id}`).set(t);
  }

  // Update timestamp on patrol — restores strength by resetting decay clock
  function refreshTerritory(id) {
    if (!db) return;
    db.ref(`/territories/${id}/timestamp`).set(Date.now());
  }

  // child_added fires for ALL existing territories on subscribe,
  // then again for each new one created afterward
  function subscribeToTerritories(onAdded) {
    if (!db) return;
    db.ref('/territories').on('child_added', snap => {
      onAdded(snap.val());
    });
  }

  function getPhoneId() { return phoneId; }
  function getCode()    { return sessionCode; }

  return {
    init, generateCode, join, pushPos,
    markComplete, subscribe,
    saveTerritory, refreshTerritory,
    subscribeToTerritories,
    getPhoneId, getCode,
  };

})();
```

**Step 3 — Patch game.js**

Open `js/game.js` in Cursor. Paste this exact prompt:

```
I have a working game.js file for TerraLoop. Make the following additions.
Do NOT modify or remove any existing functions.

ADDITION 1 — Add getCurrentStrength() as a new function after calcStr():

  // Live strength accounting for decay since claim time
  function getCurrentStrength(t) {
    const hoursElapsed = (Date.now() - t.timestamp) / 3600000;
    const decayed = t.str - Math.floor(hoursElapsed * CONFIG.DECAY_RATE_PER_HOUR);
    return Math.max(1, decayed);
  }

ADDITION 2 — In the existing checkTakeover() function, add a patrol check
at the very start of the function body, before any existing code:

    // Patrol check: attacker owns the overlapping territory
    for (const t of territories) {
      if (overlaps(newPts, t) && t.owner === (typeof Session !== 'undefined'
          ? Session.getPhoneId() : null)) {
        t.timestamp = Date.now();
        return { patrolled: true, id: t.id, name: t.lore.name };
      }
    }

ADDITION 3 — Still in checkTakeover(), change the strength comparison line:

  Change this:
    if (newStr > t.str) return { ...t, _action: 'takeover' };

  To this:
    if (newStr > getCurrentStrength(t)) return { ...t, _action: 'takeover' };

This ensures takeovers compare against live decayed strength, not original.

ADDITION 4 — Add getCurrentStrength to the return statement at the bottom
alongside the existing exports.
```

**Step 4 — Test decay math in browser console:**

Run `npx serve .`. Open `http://localhost:3000`. Open browser console. Paste:

```javascript
const fake = { str: 50, timestamp: Date.now() - 3600000, owner: 'X' };
console.log('Decayed strength:', Game.getCurrentStrength(fake));
// With DECAY_RATE_PER_HOUR = 60, after 1 hour: 50 - 60 = max(1, -10) = 1
// Expected output: 1
```

If you see `1` in the console — decay math is working correctly.

---

### PERSON 3 — Hour 1 — index.html, style.css, ui.js

**Goal:** Build the lobby screen and update the script load order.

**Step 1 — Update index.html**

Open `index.html`. Make four changes:

**Change 1** — Add Firebase SDK scripts just before the existing `<!-- Leaflet JS -->` comment:

```html
  <!-- Firebase v9 compat SDK — must load before session.js -->
  <script src="https://www.gstatic.com/firebasejs/9.23.0/firebase-app-compat.js"></script>
  <script src="https://www.gstatic.com/firebasejs/9.23.0/firebase-database-compat.js"></script>
```

**Change 2** — Replace the existing app script block with this updated load order:

```html
  <script src="config.js"></script>      <!-- 1. constants + API key   -->
  <script src="js/session.js"></script>   <!-- 2. Firebase (NEW)        -->
  <script src="js/game.js"></script>      <!-- 3. territory logic       -->
  <script src="js/claude.js"></script>    <!-- 4. Claude API calls      -->
  <script src="js/ui.js"></script>        <!-- 5. cards / toasts / DOM  -->
  <script src="js/map.js"></script>       <!-- 6. Leaflet + boot        -->
```

**Change 3** — Add lobby screen HTML as the first element inside `<body>`, before `<div id="map">`:

```html
  <!-- Lobby screen — hidden after session starts -->
  <div id="lobby">
    <div id="lobby-box">
      <div id="lobby-logo">Terra<span>Loop</span></div>
      <div id="lobby-sub">UW-Madison · Walk to Own the World</div>
      <div id="my-code-label">Your lobby code</div>
      <div id="my-code"></div>
      <div id="lobby-or">— or join a friend —</div>
      <input id="join-input" maxlength="4" placeholder="ABCD"
             autocomplete="off" oninput="this.value=this.value.toUpperCase()"/>
      <button id="lobby-btn" onclick="MapCtrl.startSession()">Start Run</button>
      <div id="lobby-status"></div>
    </div>
  </div>
```

**Change 4** — In the topbar, remove these two buttons (click-to-draw is gone):

```html
<!-- DELETE THIS LINE -->
<button id="start-btn"  onclick="startDraw()">Start Loop</button>

<!-- DELETE THIS LINE -->
<button id="cancel-btn" onclick="cancelDraw()">Cancel</button>
```

The `Close Loop` button stays — it is the GPS fallback for the demo.

**Step 2 — Add lobby CSS to style.css**

Paste this at the bottom of `css/style.css`:

```css
/* ── Lobby screen ─────────────────────────────────────── */
#lobby {
  position: fixed; inset: 0; z-index: 9999;
  background: #0f1117;
  display: flex; align-items: center; justify-content: center;
}
#lobby.hidden { display: none; }
#lobby-box {
  text-align: center; padding: 2rem 1.5rem;
  max-width: 320px; width: 100%;
}
#lobby-logo {
  font-size: 32px; font-weight: 700;
  color: #e8e6df; letter-spacing: -1px;
}
#lobby-logo span { color: #378ADD; }
#lobby-sub { font-size: 13px; color: #666; margin: 4px 0 28px; }
#my-code-label {
  font-size: 11px; color: #555;
  text-transform: uppercase; letter-spacing: 0.08em;
}
#my-code {
  font-size: 52px; font-weight: 800; letter-spacing: 8px;
  color: #378ADD; font-family: monospace; margin: 6px 0 20px;
}
#lobby-or { font-size: 12px; color: #555; margin-bottom: 10px; }
#join-input {
  width: 140px; text-align: center; font-size: 22px;
  font-weight: 700; letter-spacing: 4px; font-family: monospace;
  background: #1a1d26; border: 1px solid #333; color: #e8e6df;
  border-radius: 8px; padding: 10px;
  display: block; margin: 0 auto 16px;
}
#lobby-btn {
  background: #378ADD; color: #fff; border: none;
  padding: 12px 36px; border-radius: 8px;
  font-size: 15px; font-weight: 600; cursor: pointer; width: 100%;
}
#lobby-btn:active { opacity: 0.85; }
#lobby-status {
  font-size: 12px; color: #888;
  margin-top: 12px; min-height: 18px;
}

/* ── Teammate indicator (bottom-left of map) ─────────── */
#teammate-indicator {
  position: fixed; bottom: 16px; left: 16px; z-index: 500;
  background: rgba(15,17,23,0.88);
  color: #EF9F27; border: 1px solid #EF9F27;
  border-radius: 8px; padding: 6px 12px;
  font-size: 12px; font-weight: 600;
}
```

**Step 3 — Patch ui.js**

Open `js/ui.js` in Cursor. Paste this exact prompt:

```
I have a working ui.js file for TerraLoop. Add the following new functions
inside the UI IIFE before the return statement. Do NOT modify or remove
any existing functions.

ADDITION 1 — showLobbyStatus(msg):
  function showLobbyStatus(msg) {
    const el = document.getElementById('lobby-status');
    if (el) el.textContent = msg;
  }

ADDITION 2 — hideLobby():
  function hideLobby() {
    const el = document.getElementById('lobby');
    if (el) el.classList.add('hidden');
  }

ADDITION 3 — showTeammateIndicator(count):
  function showTeammateIndicator(count) {
    let el = document.getElementById('teammate-indicator');
    if (!el) {
      el = document.createElement('div');
      el.id = 'teammate-indicator';
      document.body.appendChild(el);
    }
    el.textContent = count > 0
      ? count + ' teammate' + (count > 1 ? 's' : '') + ' on map'
      : '';
    el.style.display = count > 0 ? 'block' : 'none';
  }

ADDITION 4 — showPatrolToast(name):
  function showPatrolToast(name) {
    toast(name + ' patrolled — strength fully restored', 't-ok');
  }

ADDITION 5 — In the existing showCard(t) function, find the strength bar
fill width line. It currently uses t.str. Change it to use
Game.getCurrentStrength(t) instead:

  Find:    width:${t.str}%
  Replace: width:${Game.getCurrentStrength(t)}%

Also find the strength number display (class c-str-n). Change t.str to
Game.getCurrentStrength(t):

  Find:    <span class="c-str-n">${t.str}</span>
  Replace: <span class="c-str-n">${Game.getCurrentStrength(t)}</span>

ADDITION 6 — Export all new functions in the existing return statement:
  showLobbyStatus, hideLobby, showTeammateIndicator, showPatrolToast
```

**Step 4 — Test lobby screen:**

Run `npx serve .`. Open `http://localhost:3000`. The lobby screen should appear. Typing in the join input should auto-uppercase. Tapping Start Run should hide the lobby and show the map. Confirm no console errors.

---

## 10. Checkpoint 1 — T+60

All three people stop individual work. Run every test below. **Do not proceed to Hour 2 until all pass.**

| # | Test | How to run | Expected result |
|---|---|---|---|
| 1 | Lobby screen appears | Open `http://localhost:3000` | Lobby screen visible with code "DEMO" |
| 2 | Map loads | Tap Start Run on lobby | Lobby hides, full-screen map appears, no console errors |
| 3 | Decay math correct | Console: `console.log(Game.getCurrentStrength({str:50, timestamp:Date.now()-3600000, owner:'X'}))` | Returns `1` |
| 4 | getCurrentStrength exported | Console: `typeof Game.getCurrentStrength` | Returns `"function"` |
| 5 | checkTakeover still exists | Console: `typeof Game.checkTakeover` | Returns `"function"` |
| 6 | Session object loaded | Console: `typeof Session` | Returns `"object"` |
| 7 | Close Loop button visible | Look at topbar | "Close Loop" button present |
| 8 | Start Loop and Cancel buttons gone | Look at topbar | Neither button present |

**If test 3 fails:** Person 2's game.js Cursor prompt did not apply correctly. Re-paste the game.js Cursor prompt.

**If test 5 fails:** Friend's map.js rewrite accidentally deleted `checkTakeover`. Re-paste the map.js Cursor prompt and ensure DELETIONS list only removes the four click-draw functions.

**If test 6 fails:** session.js is not loading. Check that `<script src="js/session.js">` is present in index.html between config.js and game.js.

---

## 11. HOUR 2 — Integration (T+60 to T+120)

This hour wires everything together. Person 2 must share the confirmed Firebase config before anyone else proceeds.

---

### PERSON 2 — Hour 2 — Confirm Firebase writes

**Step 1** — Confirm the Firebase config is pasted correctly in `config.js`. All fields populated, no placeholder strings remaining. Share the complete config in the group chat so Person 3 can deploy.

**Step 2** — Test Firebase writes in browser console:

```javascript
Session.init();
// Expected log: "[TerraLoop] Firebase ready. Phone ID: XXXXXX"

await Session.join('TEST');
// Expected log: "[TerraLoop] Joined session: TEST"

Session.pushPos(43.0762, -89.4009);
// Check Firebase Console → Realtime Database → Data
// Expected: /sessions/TEST/players/XXXXXX/pos: { lat: 43.0762, lng: ... }
```

If the path appears in Firebase Console — writes are working. Share confirmation in the group chat before the other two proceed.

---

### FRIEND — Hour 2 — Wire session.js into map.js

Wait for Person 2 to confirm Firebase writes are working before starting this step.

**Step 1 — Open js/map.js in Cursor. Paste this exact prompt:**

```
I have a working map.js that already has startGPS() implemented and a
placeholder startSession() function. Wire in the Session object
(already loaded from js/session.js). Make only the changes listed below.
Do not touch any other existing logic.

CHANGE 1 — Replace the placeholder startSession() with this full version:
  async function startSession() {
    const inputCode = document.getElementById('join-input').value.trim();
    const myCode = document.getElementById('my-code').textContent;
    const code = inputCode.length === 4 ? inputCode : myCode;
    UI.showLobbyStatus('Connecting...');
    Session.init();
    await Session.join(code);
    document.getElementById('lobby').classList.add('hidden');
    UI.toast('Session ' + Session.getCode() + ' — GPS starting', 't-info');
    Session.subscribe(onSessionUpdate);
    Session.subscribeToTerritories(t => {
      if (!layers[t.id]) renderTerritory(t);
    });
    startGPS();
  }

CHANGE 2 — Add onSessionUpdate() after startSession():
  function onSessionUpdate({ teammates, squad, playerCount }) {
    renderTeammates(teammates);
    UI.showTeammateIndicator(teammates.length);
    if (squad && !isSquad) {
      isSquad = true;
      UI.setSquadBtn(true);
      UI.toast('Squad activated — 2.2x stronger!', 't-ok');
    }
    if (playerCount > 1) {
      UI.setTerrCount(
        Game.getAll().length + ' territories · ' +
        playerCount + ' players in ' + Session.getCode()
      );
    }
  }

CHANGE 3 — Add renderTeammates(teammates) after onSessionUpdate():
  function renderTeammates(teammates) {
    const seen = new Set();
    teammates.forEach(t => {
      seen.add(t.id);
      if (!t.pos) return;
      if (teammateLayers[t.id]) {
        teammateLayers[t.id].setLatLng([t.pos.lat, t.pos.lng]);
      } else {
        teammateLayers[t.id] = L.circleMarker([t.pos.lat, t.pos.lng], {
          radius: 10,
          color: CONFIG.C_TEAM,
          fillColor: CONFIG.C_TEAM,
          fillOpacity: 0.9,
          weight: 2.5,
        })
        .bindTooltip('Teammate', { permanent: false })
        .addTo(map);
      }
    });
    Object.keys(teammateLayers).forEach(id => {
      if (!seen.has(id)) {
        map.removeLayer(teammateLayers[id]);
        delete teammateLayers[id];
      }
    });
  }

CHANGE 4 — In startGPS(), inside the watchPosition success callback, add
this line immediately after "const pt = { lat: ..., lng: ... };":
  Session.pushPos(pt.lat, pt.lng);

CHANGE 5 — In closeLoop(), replace the existing result handling block
(everything from "const result = Game.checkTakeover" through "cancelDraw()")
with this version that handles patrol detection:

  const result = Game.checkTakeover(pts, isSquad);

  if (result?.blocked) {
    UI.toast('Held firm (str ' + result.str + '). Walk a bigger loop!', 't-warn');
    cancelDraw();
    return;
  }

  if (result?.patrolled) {
    Session.refreshTerritory(result.id);
    UI.showPatrolToast(result.name);
    cancelDraw();
    return;
  }

  const savedPts   = [...pts];
  const savedSquad = isSquad;
  const prevName   = result?.lore?.name || null;
  const overtook   = !!result;
  cancelDraw();

CHANGE 6 — Still in closeLoop(), add these two lines immediately after
"const t = Game.create({ pts: savedPts, squad: savedSquad, lore });":
  Session.markComplete();
  Session.saveTerritory(t);

CHANGE 7 — In init(), replace the placeholder line:
  const myCode = 'DEMO';
with:
  const myCode = Session.generateCode();

After all changes confirm that renderTerritory(), removeLayer(),
toggleSquad(), and closeLoop() are all still present and complete.
```

**Step 2** — Reload `http://localhost:3000`. The lobby should now show a random 4-letter code instead of "DEMO". Confirm no console errors.

---

### PERSON 3 — Hour 2 — Deploy to Vercel

Wait for Person 2 to confirm Firebase config is in `config.js` before deploying.

**Step 1** — From the project root:

```bash
vercel
```

Follow prompts: new project, no framework override, deploy. Copy the `.vercel.app` URL. Share it in the group chat immediately. This is the only URL anyone opens from now on.

**Step 2** — Open the Vercel URL on your phone. Confirm:
- Lobby screen appears
- Location permission prompt fires when Start Run is tapped
- No JavaScript errors in browser console

**Step 3** — For every code change going forward:

```bash
vercel --prod
```

This takes about 20 seconds. Do it after every meaningful change. The plain `vercel` command deploys to a preview URL — always use `--prod`.

---

## 12. Checkpoint 2 — T+105

Both phones must be on the **Vercel HTTPS URL** — not localhost. GPS does not work on HTTP.

| # | Test | How to run | Expected result |
|---|---|---|---|
| 1 | Both phones open Vercel URL | Open URL on two phones | Lobby screen visible on both |
| 2 | Phone B enters Phone A's code | Type code in join input, tap Start Run | Both show "Session XXXX — GPS starting" toast |
| 3 | Firebase has two players | Firebase Console → /sessions/{code}/players | Two phoneId entries with pos data |
| 4 | Phone A moves 10 steps | Walk outside | Phone B sees amber dot move on their map |
| 5 | Phone A taps Close Loop | Tap button | Territory appears on both phones |
| 6 | Territory in Firebase | Firebase Console → /territories | Territory object present |
| 7 | Claude lore on card | Look at territory card | Name, lore, strength bar visible |
| 8 | Both phones close loops | Both tap Close Loop | Territory turns green, squad toast fires on both |

**If test 4 fails (amber dot not appearing):** Open Firebase /sessions/{code}/players. If only one phoneId entry exists, both phones joined different codes. Run `localStorage.clear()` in browser console on both phones, reload, and rejoin with the same code.

**If test 5 fails (territory not syncing):** Check that `Session.subscribeToTerritories()` is called in `startSession()`. If the territory appears in Firebase but not on the second phone, the `child_added` listener is not attaching.

**If test 8 fails (squad not firing):** Check Firebase /sessions/{code}/players. Both `completed` fields must be `true`. Have the slower phone tap Close Loop manually. Squad detection reads all completions on each `markComplete()` call.

---

## 13. HOUR 3 — Decay, Polish, Demo (T+120 to T+180)

---

### FRIEND — Hour 3 — Decay visual on map polygons

**Step 1 — Open js/map.js in Cursor. Paste this exact prompt:**

```
In the existing renderTerritory(t) function in map.js, add a decay opacity
updater. Make only these two additions. Do not change anything else.

ADDITION 1 — After the existing pulse animation interval ends (after the
setInterval that does the pulse flash completes), add this block:

  function updateDecayOpacity() {
    const currentStr = Game.getCurrentStrength(t);
    const fraction = Math.max(0.05, currentStr / t.str);
    polygon.setStyle({ fillOpacity: CONFIG.FILL_OP * fraction });
  }
  updateDecayOpacity();
  const decayInterval = setInterval(updateDecayOpacity, 30000);

ADDITION 2 — Add a new function refreshPolygon(id) after renderTerritory():
  function refreshPolygon(id) {
    if (!layers[id]) return;
    layers[id].polygon.setStyle({ fillOpacity: CONFIG.FILL_OP });
    clearInterval(decayInterval);
  }
  window.refreshPolygon = refreshPolygon;

Do not change any other existing function.
```

**Step 2 — Coordinate the three-phone outdoor test at T+130.**

---

### PERSON 2 — Hour 3 — Verify patrol and decay takeover

**Test 1 — Patrol flow:**

On a phone, claim a territory. Wait 1 minute (strength drops ~60 with demo rate). Walk the same approximate loop again. Close Loop fires. The "patrolled — strength fully restored" toast should appear. The territory card strength bar should reset to full.

If the toast fires and the bar resets — patrol is working.

**Test 2 — Decay enables takeover:**

Claim a territory with strength 20. Wait 1 minute. Have a second phone attempt a loop with strength 15 over the same area. Normally 15 < 20 = blocked. After 1 minute at DECAY_RATE 60, the territory is at max(1, 20-60) = 1. Strength 15 > 1, so the takeover should succeed.

If the takeover succeeds when it previously would have been blocked — decay comparison is working correctly.

---

### PERSON 3 — Hour 3 — Three-phone test and pitch slides

**Step 1 — Three-phone outdoor test at T+130:**

All three phones on Vercel URL. Run the full demo sequence once:

1. Person A starts solo session, walks small loop around building entrance
2. Person B and C enter the same code, walk a bigger loop together enclosing Person A's territory
3. Squad fires on B and C's phones, green territory replaces Person A's blue
4. Wait 1 minute — confirm Person A's decayed territory would now be vulnerable
5. Person B attempts a solo revenge loop — confirm squad territory holds

If this sequence runs correctly — the demo is ready.

**Step 2 — Build 5 pitch slides (Google Slides, 15 minutes):**

- Slide 1 — Problem: fitness apps are boring, making friends at university is hard without a shared activity
- Slide 2 — Solution: TerraLoop in one sentence + three differentiators (movement = strategy, walking together = stronger territory, decay keeps the map alive)
- Slide 3 — How it works: lobby code → walk → territory claims in 3 steps
- Slide 4 — Squad mechanic: two strangers, one code, one walk, unbreakable territory
- Slide 5 — Why it wins: no other fitness or social app does this

Each slide: one headline (7 words max) + 2-3 bullets (6 words each max).

---

## 14. Checkpoint 3 — T+150

Pre-demo verification. All three people. All three phones. Outside.

| # | Test | Expected result |
|---|---|---|
| 1 | All three phones on Vercel HTTPS URL | Lobby screens visible, GPS permission granted |
| 2 | Person A claims solo territory | Blue territory appears, Claude names it |
| 3 | Person B and C join same code, both close loops | Green squad territory replaces Person A's blue on all three phones |
| 4 | Territory card shows squad lore on all phones | Yes |
| 5 | Wait 1 minute, check strength: `Game.getAll().map(t => Game.getCurrentStrength(t))` | Numbers lower than original `t.str` values |
| 6 | Map polygon for Person A's original (now lost) territory looks faded | Polygon fillOpacity visibly lower |
| 7 | Person A attempts revenge loop over squad territory | Blocked toast — squad strength too high |
| 8 | Person A walks patrol over their own territory (if they reclaimed it) | "Patrolled — strength fully restored" toast |
| 9 | Claude API test from laptop | `curl` returns valid JSON with name, lore, energy, battle, reward |
| 10 | Demo script rehearsed out loud once | All beats timed, GPS fallback practiced |

**If you pass all 10 — stop building. Start rehearsing.**

---

## 15. Deployment

### Why Vercel is required

`watchPosition()` — the GPS API — is blocked on plain HTTP on all modern mobile browsers. You must serve over HTTPS. Vercel deploys a static folder instantly with HTTPS included, for free.

### First deploy

```bash
vercel
```

Follow prompts: new project, no framework override, deploy. Copy the `.vercel.app` URL. Share it in the group chat. This is the only URL anyone opens.

### Pushing updates

```bash
vercel --prod
```

Takes about 20 seconds. Always use `--prod` — the plain `vercel` command deploys to a preview URL that is different from the shared production URL.

### Confirming Firebase is connected

After the first deploy with the Firebase config in place, open the Vercel URL on a phone, enter a code, tap Start Run, and immediately check Firebase Console → Realtime Database → Data. The session path should appear within a few seconds. If it does not, the `databaseURL` in config.js is wrong.

---

## 16. Demo Sequence — 3 People, 3 Phones

### Before starting

- All three phones on Vercel URL, lobby screen visible
- Person B and C pre-agree to use the code shown on Person B's screen
- Person A uses their own code (starts solo)
- Screen recording started on all three phones
- Standing outside near the CS building entrance

### Beat 1 — Problem (20 seconds, no phone action)

> "Fitness apps count steps. Nobody opens Strava for fun. And making friends at university feels impossible unless you already have something to do together."

### Beat 2 — Solution (15 seconds)

> "TerraLoop turns walking into a real-world strategy game. Walk a loop — you own that space. Walk with someone — your territory becomes almost unbreakable. And the longer you ignore it, the weaker it gets."

Hold up one phone showing the lobby screen.

### Beat 3a — Person A solo claim (60 seconds)

Person A enters their own code, taps Start Run. Walks a small loop around the building entrance. Returns to start. Loop auto-closes (or tap Close Loop). Blue territory appears. Claude card shows name and lore.

> "I just walked around this building. Now I own it."

### Beat 3b — Squad takes over (60 seconds)

Person B and C tap Start Run on the same code. Both phones show each other as amber dots on the map. Both walk a bigger loop enclosing Person A's territory. Both close loops within a few seconds. Squad fires. Green territory replaces Person A's blue territory on all three phones.

> "They didn't say a word to each other. They shared a code and walked. Now they own this together. And my territory is gone."

Hold up all three phones — B and C's are green, A's is empty.

### Beat 3c — Decay moment (20 seconds)

> "And it doesn't stop there. Every territory weakens over time. Walk away — someone else can take it. Come back and patrol it — strength fully restored. The map is never settled."

If demo rate is 60/hr, a territory claimed 1+ minutes ago will visibly be fading. Point at the polygon and the strength number.

### Beat 4 — Why we win (30 seconds)

> "Movement is strategy. Cooperation is the mechanic. Decay keeps the whole map in play. And Claude builds a living world around every loop. This is not a fitness app. It is a friendship engine."

Hold up all three phones together.

### GPS fallback

If GPS drifts and auto-close does not fire, tap the Close Loop button immediately. Territory still appears, Claude still generates. Judges cannot tell the difference. Practice pressing it so it looks deliberate.

---

## 17. Recording the Demo

### What to record

**Phone screens** — screen record all three phones. This is the primary footage.

**Physical footage** — prop a laptop or fourth phone at a fixed angle capturing the building and all three people walking. A static wide shot is more convincing than shaky follow footage.

### Start recordings simultaneously

Count down: "3, 2, 1, record." All three start screen recording at the same moment.

### The edit — 90 seconds total

| Clip | Source | Duration | What it shows |
|---|---|---|---|
| Opening | Wide shot | 5s | Three people outside CS building, phones in hand |
| Solo claim | Person A screen | 15s | Path traces, blue territory, Claude card |
| Squad join | Person B screen | 10s | Two amber dots on same map |
| Squad takeover | Person C screen | 12s | Green territory, squad lore, Person A's blue gone |
| Decay moment | Person A screen | 8s | Territory polygon visibly fading, strength dropping |
| End card | Wide shot | 5s | All three people, phones up |

Editing tools: iMovie, CapCut, or DaVinci Resolve — all free. Cut on impact moments: territory appearing, the color change to green, the strength number visibly lower.

### Run the session twice

Record the entire sequence twice while you are already outside. The second take is almost always better. Costs 10 minutes. Always worth it.

---

## 18. Troubleshooting

### Firebase not connecting

Open browser console. Firebase logs connection errors clearly. The `databaseURL` in config.js must come from the Realtime Database page in the Firebase console (the URL shown at the top of the Data tab), ending in `.firebaseio.com`. The URL in Project Settings is a different field and does not work here.

### GPS not firing on phone

Confirm you are on the Vercel HTTPS URL, not localhost.
- iPhone: Settings → Privacy & Security → Location Services → Safari or Chrome → While Using
- Android: Tap the lock icon in Chrome → Permissions → Location → Allow

### Teammate dot not appearing

Open Firebase console → /sessions/{code}/players. If only one phoneId entry exists, both phones joined different session codes. Run `localStorage.clear()` in browser console on both phones, reload, and rejoin with the same 4-letter code.

### Squad not firing

Check Firebase /sessions/{code}/players — both `completed` fields must be `true`. If one phone's GPS auto-closed but the other did not, tap Close Loop manually on the second phone. Squad detection reads all completions on each `markComplete()` call.

### Decay not visible on polygon

Confirm `DECAY_RATE_PER_HOUR` in `config.js` is set to `60`. With this setting, a territory fades visually over 30-second intervals (the `setInterval(updateDecayOpacity, 30000)` timer). Wait at least 30 seconds after claiming before expecting visual fade. Confirm `Game.getCurrentStrength()` is being called in `ui.js` showCard().

### Patrol not triggering

Patrol requires the new loop to overlap a territory owned by the same phone. Confirm `Session.getPhoneId()` returns the same value by running it in console before and after a page reload — it reads from localStorage and must be stable. If localStorage was cleared between sessions, the phone has a new ID and will not match the original owner record.

### Claude API errors

Test the key before the hackathon:

```bash
curl https://api.anthropic.com/v1/messages \
  -H "x-api-key: YOUR_KEY" \
  -H "anthropic-version: 2023-06-01" \
  -H "content-type: application/json" \
  -d '{"model":"claude-sonnet-4-6","max_tokens":50,"messages":[{"role":"user","content":"say ok"}]}'
```

If 401: key is wrong. If 429: rate limited — generate a new key from console.anthropic.com tonight.

### Vercel not reflecting changes

Always use `vercel --prod`. The plain `vercel` command deploys to a preview URL. Your teammates are on the production URL — only `--prod` updates it.

---

*Base MVP built by your teammate. This plan adds real GPS, Firebase multi-device sync,*
*lobby codes, territory decay, and patrolling.*
*Total new code: approximately 200 lines across one new file and five modified files.*
*Remember: set `DECAY_RATE_PER_HOUR: 1` in config.js before shipping to real players.*
