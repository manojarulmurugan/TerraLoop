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