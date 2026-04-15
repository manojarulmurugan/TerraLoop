// ============================================================
//  js/map.js — Leaflet map + user interaction + rendering
//  Click-to-move, drawing-while-moving, NPC territory rendering
// ============================================================

const MapCtrl = (() => {

  let map;
  let userMarker = null;
  let btCircle = null;
  let userPlaced = false;
  let drawing = false;
  let drawPts = [];
  let drawLine = null;
  let drawDots = [];
  let squadTrails = [];
  let simMarkers = {};
  let territoryLayers = [];
  let npcTerritoryLayers = [];

  let moveAnim = null;

  // ── Init ──────────────────────────────────────────────────
  function init() {
    if (map) return; // guard against double init

    map = L.map('map', {
      center: CONFIG.MAP_CENTER,
      zoom: CONFIG.MAP_ZOOM,
      zoomControl: true,
      attributionControl: false,
    });

    L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
      maxZoom: 19,
    }).addTo(map);

    map.on('click', onMapClick);

    Simulation.init();
  }

  // ── Map click handler ─────────────────────────────────────
  function onMapClick(e) {
    const { lat, lng } = e.latlng;

    if (!userPlaced) {
      placeUser(lat, lng);
      return;
    }

    if (drawing) {
      addDrawPoint({ lat, lng });
      moveUser(lat, lng);
      return;
    }

    moveUser(lat, lng);
  }

  // ── Place user initially ──────────────────────────────────
  function placeUser(lat, lng) {
    userPlaced = true;

    const icon = L.divIcon({ className: 'user-marker', iconSize: [20, 20], iconAnchor: [10, 10] });
    userMarker = L.marker([lat, lng], { icon, zIndexOffset: 1000 }).addTo(map);

    btCircle = L.circle([lat, lng], {
      radius: CONFIG.BLUETOOTH_RANGE * 111000,
      color: '#f59e0b', fillColor: '#f59e0b',
      fillOpacity: 0.06, weight: 1, opacity: 0.3,
      dashArray: '6,4',
    }).addTo(map);

    Simulation.setUserPos(lat, lng);
    Simulation.start();
    updateLocationLabel(lat, lng);

    if (typeof UI !== 'undefined') {
      UI.addFeedItem('📍 You entered campus!', 'sys');
    }
    const bb = document.getElementById('bb-status');
    if (bb) bb.textContent = 'Click map to move. Complete a challenge to unlock zone claiming.';
  }

  // ── Smooth move user ──────────────────────────────────────
  function moveUser(lat, lng) {
    if (!userMarker) return;

    if (moveAnim) cancelAnimationFrame(moveAnim);

    const start = userMarker.getLatLng();
    const sLat = start.lat, sLng = start.lng;
    let progress = 0;

    function step() {
      progress += CONFIG.MOVE_LERP;
      if (progress >= 1) progress = 1;

      const cLat = sLat + (lat - sLat) * progress;
      const cLng = sLng + (lng - sLng) * progress;

      userMarker.setLatLng([cLat, cLng]);
      btCircle.setLatLng([cLat, cLng]);
      Simulation.setUserPos(cLat, cLng);

      if (progress < 1) {
        moveAnim = requestAnimationFrame(step);
      } else {
        moveAnim = null;
        updateLocationLabel(lat, lng);
      }
    }
    moveAnim = requestAnimationFrame(step);
  }

  function getUserPos() {
    if (!userMarker) return null;
    const ll = userMarker.getLatLng();
    return { lat: ll.lat, lng: ll.lng };
  }

  // ── Drawing ───────────────────────────────────────────────
  function startDraw() {
    if (!userPlaced) {
      UI.toast('Click the map to place yourself first!');
      return;
    }
    if (!Simulation.isChallengeUnlocked()) {
      UI.toast('Complete a challenge first to unlock zone claiming!');
      return;
    }
    drawing = true;
    drawPts = [];
    drawDots = [];
    squadTrails = [];

    if (drawLine) { map.removeLayer(drawLine); drawLine = null; }

    const pos = getUserPos();
    if (pos) addDrawPoint(pos);

    document.getElementById('btn-claim').style.display = 'none';
    document.getElementById('btn-close').style.display = '';
    document.getElementById('btn-cancel').style.display = '';
    document.getElementById('btn-patrol').style.display = 'none';
    document.getElementById('bb-status').textContent = 'Click map to add points. Close the loop when done.';
  }

  function addDrawPoint(pt) {
    drawPts.push(pt);

    const dot = L.circleMarker([pt.lat, pt.lng], {
      radius: 5, color: CONFIG.C_DRAW, fillColor: CONFIG.C_DRAW,
      fillOpacity: 0.8, weight: 2,
    }).addTo(map);
    drawDots.push(dot);

    // Show squad mate trails as visual-only markers (not added to polygon)
    const squadPts = Simulation.getSquadContribution();
    squadTrails.forEach(t => map.removeLayer(t));
    squadTrails = [];
    squadPts.forEach(sp => {
      const sDot = L.circleMarker([sp.lat, sp.lng], {
        radius: 3, color: CONFIG.C_SQUAD, fillColor: CONFIG.C_SQUAD,
        fillOpacity: 0.5, weight: 1,
      }).addTo(map);
      squadTrails.push(sDot);
    });

    if (drawLine) map.removeLayer(drawLine);
    if (drawPts.length > 1) {
      drawLine = L.polyline(drawPts.map(p => [p.lat, p.lng]), {
        color: CONFIG.C_DRAW, weight: 3, opacity: 0.7, dashArray: '8,6',
      }).addTo(map);
    }
  }

  function cancelDraw() {
    drawing = false;
    drawPts = [];
    drawDots.forEach(d => map.removeLayer(d));
    drawDots = [];
    if (drawLine) { map.removeLayer(drawLine); drawLine = null; }
    squadTrails.forEach(t => map.removeLayer(t));
    squadTrails = [];
    resetBottomBar();
  }

  async function closeDraw() {
    if (drawPts.length < CONFIG.MIN_POINTS) {
      UI.toast(`Need at least ${CONFIG.MIN_POINTS} points!`);
      return;
    }

    drawing = false;
    const pts = [...drawPts];

    drawDots.forEach(d => map.removeLayer(d));
    drawDots = [];
    if (drawLine) { map.removeLayer(drawLine); drawLine = null; }
    squadTrails.forEach(t => map.removeLayer(t));
    squadTrails = [];
    drawPts = [];

    const hasSquad = Simulation.getSquadMembers().length > 0;

    // Find ALL overlapping territories — they all get consumed
    const eaten = Game.findOverlapping(pts);
    const eatenNames = eaten.filter(t => t.owner !== CONFIG.PHONE_ID).map(t => t.lore.name);
    const hadTakeover = eatenNames.length > 0;

    if (typeof UI !== 'undefined') UI.showLoading(true);

    let lore;
    try {
      const area = Game.calcArea(pts);
      const str = Game.calcStr(area, hasSquad);
      const spot = Game.nearestLandmark(pts);
      lore = await Claude.generateTerritory({
        area: Math.round(area), squad: hasSquad, spot, str,
        overtook: hadTakeover,
        prevName: eatenNames[0] || null,
      });
    } catch {
      lore = {
        name: "Unnamed Territory",
        lore: "A mysterious zone on campus.",
        energy: "Unknown Energy",
        battle: "",
        reward: "Explorer",
      };
    }

    // Remove all eaten territories from map and data
    eaten.forEach(old => {
      Game.remove(old.id);
      removeTerritoryLayer(old.id);
    });

    const t = Game.create({ pts, squad: hasSquad, lore });
    renderTerritory(t);

    if (typeof UI !== 'undefined') UI.showLoading(false);

    if (hadTakeover) {
      UI.addFeedItem(`⚔️ Consumed ${eatenNames.join(', ')}!`, 'zone');
    }

    Simulation.onZoneClaimed(t);
    resetBottomBar();
  }

  function patrolZone() {
    if (!userPlaced) return;
    const pos = getUserPos();
    if (!pos) return;
    const small = [
      { lat: pos.lat + 0.0001, lng: pos.lng + 0.0001 },
      { lat: pos.lat - 0.0001, lng: pos.lng + 0.0001 },
      { lat: pos.lat, lng: pos.lng - 0.0001 },
    ];
    const result = Game.checkTakeover(small, false);
    if (result && result.patrolled) {
      UI.toast(`✅ Patrolled ${result.name}! Strength refreshed.`);
      UI.addFeedItem(`🔄 Patrolled <b>${result.name}</b>`, 'zone');
    } else {
      UI.toast('No zones nearby to patrol.');
    }
  }

  function resetBottomBar() {
    document.getElementById('btn-claim').style.display = '';
    document.getElementById('btn-close').style.display = 'none';
    document.getElementById('btn-cancel').style.display = 'none';
    document.getElementById('btn-patrol').style.display = '';
    document.getElementById('bb-status').textContent = 'Click map to move around campus.';
  }

  // ── Render territories ────────────────────────────────────
  function renderTerritory(t) {
    const color = t.squad ? CONFIG.C_SQUAD : CONFIG.C_SOLO;
    const poly = L.polygon(t.pts.map(p => [p.lat, p.lng]), {
      color, fillColor: color, fillOpacity: CONFIG.FILL_OP,
      weight: 2, dashArray: t.squad ? null : '6,4',
      bubblingMouseEvents: true,
    }).addTo(map);
    poly._tId = t.id;

    poly.bindTooltip(`${t.lore.name} · STR ${t.str}`, { sticky: true, className: 'terr-tip' });

    territoryLayers.push(poly);
  }

  function renderNPCTerritory(t) {
    const color = CONFIG.C_NPC;
    const poly = L.polygon(t.pts.map(p => [p.lat, p.lng]), {
      color, fillColor: color, fillOpacity: 0.15,
      weight: 2, dashArray: '4,4',
      bubblingMouseEvents: true,
    }).addTo(map);
    poly._tId = t.id;

    poly.bindTooltip(`${t.lore.name} · ${t.ownerName}`, { sticky: true, className: 'terr-tip' });

    npcTerritoryLayers.push(poly);
  }

  function removeTerritoryLayer(id) {
    territoryLayers = territoryLayers.filter(l => {
      if (l._tId === id) { map.removeLayer(l); return false; }
      return true;
    });
    npcTerritoryLayers = npcTerritoryLayers.filter(l => {
      if (l._tId === id) { map.removeLayer(l); return false; }
      return true;
    });
  }

  // ── Sim student markers ───────────────────────────────────
  function updateSimStudents(students, uPos) {
    students.forEach(s => {
      const isNear = Math.hypot(s.lat - uPos.lat, s.lng - uPos.lng) < CONFIG.BLUETOOTH_RANGE;
      const isCon = Simulation.isConnected(s.id);

      if (!simMarkers[s.id]) {
        const icon = L.divIcon({
          className: `sim-marker${isNear ? ' nearby' : ''}${isCon ? ' connected' : ''}`,
          html: `<div style="background:${s.color};width:100%;height:100%;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:.65rem;font-weight:700">${s.avatar}</div>`,
          iconSize: [28, 28], iconAnchor: [14, 14],
        });
        simMarkers[s.id] = L.marker([s.lat, s.lng], { icon, zIndexOffset: 500 }).addTo(map);
      } else {
        simMarkers[s.id].setLatLng([s.lat, s.lng]);
        const el = simMarkers[s.id].getElement();
        if (el) {
          el.classList.toggle('nearby', isNear && !isCon);
          el.classList.toggle('connected', isCon);
        }
      }
    });
  }

  // ── Location label ────────────────────────────────────────
  function updateLocationLabel(lat, lng) {
    const lbl = document.getElementById('loclbl');
    if (!lbl) return;
    let best = 'Open Campus', minD = Infinity;
    CONFIG.LANDMARKS.forEach(lm => {
      const d = Math.hypot(lm.lat - lat, lm.lng - lng);
      if (d < minD) { minD = d; best = lm.name; }
    });
    lbl.textContent = minD < 0.003 ? `Near ${best}` : best;
    if (typeof UI !== 'undefined') UI.updateLocationLabel(best);
  }

  // ── Expose ────────────────────────────────────────────────
  return {
    init, startDraw, closeDraw, cancelDraw, patrolZone,
    updateSimStudents, renderTerritory, renderNPCTerritory,
    getUserPos, moveUser,
  };

})();

// Init is called from UI.hideSplash() after #app becomes visible
// so Leaflet can calculate tile dimensions correctly.
