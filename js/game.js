// ============================================================
//  js/game.js — Territory logic. No DOM. No API. Pure maths.
//  SCALE → swap territories[] for Firebase Realtime DB
// ============================================================

const Game = (() => {

  // SCALE → firebase.database().ref('/territories').on('value', ...)
  let territories = [];
  let nextId = 1;

  // ── Shoelace formula → area in m² ─────────────────────────
  function calcArea(pts) {
    if (pts.length < 3) return 0;
    const R = 6371000;
    const rad = d => d * Math.PI / 180;
    const lat0 = pts[0].lat;
    const xs = pts.map(p => rad(p.lng - pts[0].lng) * R * Math.cos(rad(lat0)));
    const ys = pts.map(p => rad(p.lat - lat0) * R);
    let area = 0;
    for (let i = 0; i < xs.length; i++) {
      const j = (i + 1) % xs.length;
      area += xs[i] * ys[j] - xs[j] * ys[i];
    }
    return Math.abs(area) / 2;
  }

  // ── Strength score 0–99 ───────────────────────────────────
  // SCALE → add sync_bonus from Firebase timestamp comparison
  function calcStr(areaM2, squad) {
    const mul = squad ? CONFIG.SQUAD_MUL : CONFIG.SOLO_MUL;
    return Math.min(99, Math.round((areaM2 / 40) * mul));
  }

  // Live strength accounting for decay since claim time
  function getCurrentStrength(t) {
    const hoursElapsed = (Date.now() - t.timestamp) / 3600000;
    const decayed = t.str - Math.floor(hoursElapsed * CONFIG.DECAY_RATE_PER_HOUR);
    return Math.max(1, decayed);
  }

  // ── Nearest landmark to polygon centroid ──────────────────
  // SCALE → Google Places API reverse geocode of centroid lat/lng
  function nearestLandmark(pts) {
    const clat = pts.reduce((s, p) => s + p.lat, 0) / pts.length;
    const clng = pts.reduce((s, p) => s + p.lng, 0) / pts.length;
    let best = null, min = Infinity;
    for (const lm of CONFIG.LANDMARKS) {
      const d = Math.hypot(lm.lat - clat, lm.lng - clng);
      if (d < min) { min = d; best = lm; }
    }
    return min < 0.003 ? best.name : null;
  }

  // ── Centroid + radius helpers ─────────────────────────────
  function centroid(pts) {
    return {
      lat: pts.reduce((s, p) => s + p.lat, 0) / pts.length,
      lng: pts.reduce((s, p) => s + p.lng, 0) / pts.length,
    };
  }

  function approxRadius(areaM2) {
    return Math.sqrt(areaM2 / Math.PI) / 111000;
  }

  // ── Overlap check ─────────────────────────────────────────
  // SCALE → replace with Turf.js booleanIntersects for precision
  function overlaps(newPts, t) {
    const c1 = centroid(newPts);
    const c2 = centroid(t.pts);
    const r1 = approxRadius(calcArea(newPts));
    const r2 = approxRadius(t.area);
    const d = Math.hypot(c1.lat - c2.lat, c1.lng - c2.lng);
    return d < (r1 + r2) * 0.65;
  }

  // ── Check if a new loop can take over an existing one ─────
  // Returns:
  //   null              → no overlap, free to claim
  //   { ...t }          → takeover! existing territory replaced
  //   { blocked: true } → overlap but attacker too weak
  function checkTakeover(newPts, squad) {
    // Patrol check: attacker owns the overlapping territory
    for (const t of territories) {
      if (overlaps(newPts, t) && t.owner === CONFIG.PHONE_ID) {
        t.timestamp = Date.now();
        return { patrolled: true, id: t.id, name: t.lore.name };
      }
    }
    const newStr = calcStr(calcArea(newPts), squad);
    for (const t of territories) {
      if (overlaps(newPts, t)) {
        if (newStr > getCurrentStrength(t)) return { ...t, _action: 'takeover' };
        else                return { blocked: true, name: t.lore.name, str: t.str };
      }
    }
    return null;
  }

  // ── Create and store a territory ─────────────────────────
  // SCALE → firebase.database().ref('/territories').push(t);
  function create({ pts, squad, lore, ownerName }) {
    const area = Math.round(calcArea(pts));
    const str  = calcStr(area, squad);
    const spot = nearestLandmark(pts);
    const owner = ownerName || CONFIG.PHONE_ID;
    const t = {
      id: nextId++, pts, squad, area, str, spot, lore,
      ts: Date.now(), timestamp: Date.now(), owner, ownerName: ownerName || "You",
    };
    territories.push(t);
    return t;
  }

  function getByOwner(ownerId) {
    return territories.filter(t => t.owner === ownerId);
  }

  // ── Remove a territory by id ──────────────────────────────
  // SCALE → firebase.database().ref(`/territories/${id}`).remove();
  function remove(id) {
    territories = territories.filter(t => t.id !== id);
  }

  function findOverlapping(newPts) {
    return territories.filter(t => overlaps(newPts, t));
  }

  function getAll() { return territories; }

  return { calcArea, calcStr, getCurrentStrength, nearestLandmark, checkTakeover, findOverlapping, create, remove, getAll, getByOwner, centroid };

})();
