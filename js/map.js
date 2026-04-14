// ============================================================
//  js/map.js — Leaflet map + glue that connects everything.
//              This file boots the app (DOMContentLoaded).
// ============================================================

const MapCtrl = (() => {

  let map;
  let isSquad  = false;
  let drawing  = false;
  let pts      = [];
  let markers  = [];
  let polyline = null;
  let layers   = {};     // territory id → { polygon, label }
  let teammateLayers = {};

  // ── Boot ──────────────────────────────────────────────────
  function init() {

    // Guard: if Leaflet CDN failed to load
    if (typeof L === "undefined") {
      document.getElementById("dbg").textContent =
        "❌ Leaflet did not load. Run: npx serve . — then open localhost:3000";
      return;
    }

    map = L.map("map", { zoomControl: true })
            .setView(CONFIG.MAP_CENTER, CONFIG.MAP_ZOOM);

    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution : '© <a href="https://openstreetmap.org">OpenStreetMap</a>',
      maxZoom     : 19,
    }).addTo(map);

    // Fade debug bar once tiles start loading
    map.once("tileloadstart", () => {
      setTimeout(() => document.getElementById("dbg").classList.add("gone"), 2000);
    });
    // Fallback — hide after 4s regardless
    setTimeout(() => document.getElementById("dbg").classList.add("gone"), 4000);

    // Subtle landmark pins
    CONFIG.LANDMARKS.forEach(lm =>
      L.circleMarker([lm.lat, lm.lng], {
        radius: 4, color: "#555", fillColor: "#888", fillOpacity: 0.7, weight: 1,
      })
      .bindTooltip(lm.name, { permanent: false, direction: "top" })
      .addTo(map)
    );

    console.log("[TerraLoop] Map ready — UW-Madison loaded.");

    const myCode = 'DEMO';
    document.getElementById('my-code').textContent = myCode;
  }

  // ── Squad toggle ──────────────────────────────────────────
  function toggleSquad() {
    isSquad = !isSquad;
    UI.setSquadBtn(isSquad);
  }

  // ── Close loop & claim territory ─────────────────────────
  async function closeLoop() {
    if (pts.length < CONFIG.MIN_POINTS) return;

    const result = Game.checkTakeover(pts, isSquad);

    // Blocked — attacker too weak
    if (result?.blocked) {
      UI.toast(`🛡 ${result.name} held firm (str ${result.str}). Draw a bigger loop!`, "t-warn");
      if (polyline) { map.removeLayer(polyline); polyline = null; }
      markers.forEach(m => map.removeLayer(m));
      markers = []; pts = []; drawing = false;
      UI.setDrawState(false, 0);
      return;
    }

    // Snapshot state, clear drawing
    const savedPts   = [...pts];
    const savedSquad = isSquad;
    const prevName   = result?.lore?.name || null;
    const overtook   = !!result;
    if (polyline) { map.removeLayer(polyline); polyline = null; }
    markers.forEach(m => map.removeLayer(m));
    markers = []; pts = []; drawing = false;
    UI.setDrawState(false, 0);

    UI.showLoading();

    try {
      const area = Math.round(Game.calcArea(savedPts));
      const str  = Game.calcStr(area, savedSquad);
      const spot = Game.nearestLandmark(savedPts);

      // ── Claude generates lore ────────────────────────────
      const lore = await Claude.generateTerritory({
        area, squad: savedSquad, spot, str, overtook, prevName,
      });

      // ── Remove old territory if taken over ───────────────
      if (overtook) {
        removeLayer(result.id);
        Game.remove(result.id);
      }

      // ── Save + render ────────────────────────────────────
      const t = Game.create({ pts: savedPts, squad: savedSquad, lore });
      renderTerritory(t);

      UI.hideLoading();
      UI.showCard(t);
      UI.setTerrCount(Game.getAll().length);

      UI.toast(
        overtook
          ? `⚔️ ${lore.battle || lore.name + " took over!"}`
          : `${lore.name} is yours!`,
        overtook ? "t-fight" : "t-ok"
      );

    } catch (err) {
      UI.hideLoading();
      UI.toast("Error: " + err.message, "t-err");
      console.error("[TerraLoop]", err);
    }
  }

  // ── Draw a territory polygon on the map ──────────────────
  function renderTerritory(t) {
    const color = t.squad ? CONFIG.C_SQUAD : CONFIG.C_SOLO;

    const polygon = L.polygon(
      t.pts.map(p => [p.lat, p.lng]),
      { color, fillColor: color, fillOpacity: CONFIG.FILL_OP, weight: 2.5 }
    ).addTo(map);

    polygon.on("click", () => UI.showCard(t));

    // Centroid label
    const clat = t.pts.reduce((s, p) => s + p.lat, 0) / t.pts.length;
    const clng = t.pts.reduce((s, p) => s + p.lng, 0) / t.pts.length;

    const icon = L.divIcon({
      className  : "",
      html       : `<div class="tlabel" style="border-color:${color}">
                      <div class="tl-n">${t.lore.name}</div>
                      <div class="tl-s" style="color:${color}">${t.str}</div>
                    </div>`,
      iconAnchor : [60, 18],
      iconSize   : [120, 36],
    });

    const label = L.marker([clat, clng], { icon }).addTo(map);

    // Pulse animation on claim
    let f = 0;
    const iv = setInterval(() => {
      polygon.setStyle({ fillOpacity: f % 2 ? CONFIG.FILL_OP : 0.5 });
      if (++f > 5) { clearInterval(iv); polygon.setStyle({ fillOpacity: CONFIG.FILL_OP }); }
    }, 150);

    layers[t.id] = { polygon, label };
  }

  // ── Remove a territory from map (with flash) ─────────────
  function removeLayer(id) {
    if (!layers[id]) return;
    layers[id].polygon.setStyle({ color: CONFIG.C_OVER, fillColor: CONFIG.C_OVER });
    setTimeout(() => {
      map.removeLayer(layers[id].polygon);
      map.removeLayer(layers[id].label);
      delete layers[id];
    }, 600);
  }

  // ── GPS mode ─────────────────────────────────────────────
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

  // ── Session start (Firebase wired in Hour 2) ─────────────
  async function startSession() {
    document.getElementById('lobby').classList.add('hidden');
    UI.toast('GPS starting...', 't-info');
    startGPS();
  }

  // Expose functions globally for onclick= attributes in index.html
  window.toggleSquad   = toggleSquad;
  window.closeLoop     = closeLoop;
  window.startSession  = startSession;

  return { init };

})();

// ── Boot when DOM is ready ────────────────────────────────
window.addEventListener("DOMContentLoaded", () => {
  MapCtrl.init();
  UI.setSquadBtn(false);
});
