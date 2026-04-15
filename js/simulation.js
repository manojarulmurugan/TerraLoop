// ============================================================
//  js/simulation.js — Full desktop simulation engine
//  Click-to-move, squad following, NPC squads, tasks, scoring
// ============================================================

const Simulation = (() => {

  let students = [];
  let userPos = null;
  let running = false;
  let animId = null;
  let lastRadarUpdate = 0;
  let lastLeaderboardUpdate = 0;

  const connectedStudents = new Set();
  const proximityAlerted = new Set();
  let pendingStudent = null;
  let challengeData = null;
  let challengeUnlocked = false;
  let proofPhotoSrc = null;

  let myScore = 0;
  let myConns = 0;
  let myZones = 0;

  // NPC squad state
  let npcSquads = [];
  let npcClaimTimer = null;
  let npcInitTimer = null;

  // ── Init ──────────────────────────────────────────────────
  function init() {
    students = CONFIG.SIM_STUDENTS.map(s => ({
      ...s,
      lat: s.path[0].lat,
      lng: s.path[0].lng,
      pathIdx: 0,
      pathProgress: 0,
      direction: 1,
      npcSquadId: null,
      npcScore: Math.floor(Math.random() * 30),
      following: null,
    }));
  }

  function setUserPos(lat, lng) {
    userPos = { lat, lng };
  }

  function getUserPos() { return userPos; }

  // ── Start / Stop ──────────────────────────────────────────
  function start() {
    if (running) return;
    running = true;
    tick();
    scheduleNPCSquads();
  }

  function stop() {
    running = false;
    if (animId) cancelAnimationFrame(animId);
    if (npcClaimTimer) clearInterval(npcClaimTimer);
    if (npcInitTimer) clearTimeout(npcInitTimer);
  }

  // ── Main tick ─────────────────────────────────────────────
  function tick() {
    if (!running) return;

    students.forEach(s => {
      if (s.following) {
        followTarget(s);
      } else {
        moveStudent(s);
      }
    });

    if (userPos && typeof MapCtrl !== 'undefined') {
      MapCtrl.updateSimStudents(students, userPos);
    }

    const now = Date.now();
    if (userPos && now - lastRadarUpdate > 600) {
      lastRadarUpdate = now;
      checkProximity();
      if (typeof UI !== 'undefined') {
        UI.updateNearbyPanel(getNearbyList());
      }
    }

    if (now - lastLeaderboardUpdate > 2000) {
      lastLeaderboardUpdate = now;
      incrementNPCScores();
      if (typeof UI !== 'undefined') {
        UI.updateLeaderboard(getLeaderboard());
        UI.updateHeaderStats(myScore, myConns, myZones);
      }
    }

    animId = requestAnimationFrame(tick);
  }

  // ── Student movement along path ───────────────────────────
  function moveStudent(s) {
    if (!s.path || s.path.length < 2) return;

    s.pathProgress += CONFIG.SIM_SPEED;

    if (s.pathProgress >= 1) {
      s.pathProgress = 0;
      s.pathIdx += s.direction;
      if (s.pathIdx >= s.path.length - 1) { s.direction = -1; s.pathIdx = s.path.length - 2; }
      if (s.pathIdx < 0) { s.direction = 1; s.pathIdx = 0; }
    }

    const a = s.path[s.pathIdx];
    const b = s.path[Math.min(s.pathIdx + 1, s.path.length - 1)];
    s.lat = a.lat + (b.lat - a.lat) * s.pathProgress;
    s.lng = a.lng + (b.lng - a.lng) * s.pathProgress;
  }

  // ── Follow a target (squad following) ─────────────────────
  function followTarget(s) {
    let target;
    if (s.following === 'user') {
      if (!userPos) return;
      target = userPos;
    } else {
      const leader = students.find(st => st.id === s.following);
      if (!leader) return;
      target = { lat: leader.lat, lng: leader.lng };
    }

    const offsetLat = (hashStr(s.id) % 5 - 2) * 0.00015;
    const offsetLng = ((hashStr(s.id + 'x') % 5) - 2) * 0.00015;
    const tLat = target.lat + offsetLat;
    const tLng = target.lng + offsetLng;

    s.lat += (tLat - s.lat) * 0.04;
    s.lng += (tLng - s.lng) * 0.04;
  }

  function hashStr(str) {
    let h = 0;
    for (let i = 0; i < str.length; i++) h = ((h << 5) - h + str.charCodeAt(i)) | 0;
    return Math.abs(h);
  }

  // ── Proximity ─────────────────────────────────────────────
  function distanceDeg(a, b) {
    return Math.hypot(a.lat - b.lat, a.lng - b.lng);
  }

  function distanceMeters(a, b) {
    const R = 6371000;
    const dLat = (b.lat - a.lat) * Math.PI / 180;
    const dLng = (b.lng - a.lng) * Math.PI / 180;
    const aCalc = Math.sin(dLat/2)**2 + Math.cos(a.lat*Math.PI/180)*Math.cos(b.lat*Math.PI/180)*Math.sin(dLng/2)**2;
    return R * 2 * Math.atan2(Math.sqrt(aCalc), Math.sqrt(1-aCalc));
  }

  function checkProximity() {
    if (!userPos) return;
    students.forEach(s => {
      if (connectedStudents.has(s.id) || proximityAlerted.has(s.id)) return;
      if (s.following) return;
      const d = distanceDeg(userPos, s);
      if (d < CONFIG.BLUETOOTH_RANGE) {
        proximityAlerted.add(s.id);
        triggerConnectionRequest(s);
      }
    });
  }

  // ── Connection flow ───────────────────────────────────────
  async function triggerConnectionRequest(student) {
    pendingStudent = student;
    const landmark = getNearestLandmark();
    const ice = await Claude.generateIcebreaker({
      userName: "Explorer",
      studentName: student.name,
      studentMajor: student.major,
      studentInterests: student.interests,
      landmark,
    });
    if (typeof UI !== 'undefined') {
      UI.showConnectionRequest(student, ice);
    }
  }

  function acceptConnection() {
    if (!pendingStudent) return;
    const s = pendingStudent;
    connectedStudents.add(s.id);
    s.following = 'user';
    myConns++;
    myScore += CONFIG.SCORE_CONNECT;
    pendingStudent = null;

    if (typeof UI !== 'undefined') {
      UI.closeModal('m-conn');
      UI.showSquadFormed(s);
      UI.updateSquadPanel(getSquadMembers());
      UI.addFeedItem(`🤝 <b>${s.name}</b> joined your squad!`, 'conn');
      UI.updateHeaderStats(myScore, myConns, myZones);
    }

    startChallenge(s);
  }

  function declineConnection() {
    pendingStudent = null;
    if (typeof UI !== 'undefined') UI.closeModal('m-conn');
  }

  // ── Challenge system ──────────────────────────────────────
  async function startChallenge(student) {
    const landmark = getNearestLandmark();
    challengeData = await Claude.generateChallenge({
      userName: "Explorer",
      studentName: student.name,
      studentMajor: student.major,
      studentInterests: student.interests,
      landmark,
    });
    challengeData._student = student;
    challengeData._landmark = landmark;

    // Show task modal after squad celebration is dismissed
    setTimeout(() => {
      if (typeof UI !== 'undefined') {
        UI.showTaskModal(challengeData);
      }
    }, 2500);
  }

  function submitProof() {
    if (!proofPhotoSrc) return;
    challengeUnlocked = true;
    myScore += CONFIG.SCORE_CHALLENGE;

    if (typeof UI !== 'undefined') {
      UI.closeModal('m-proof');
      UI.showChallengeComplete(proofPhotoSrc, challengeData?._landmark || "campus");
      UI.addFeedItem(`📸 Challenge completed! Zone claiming unlocked.`, 'task');
      UI.updateHeaderStats(myScore, myConns, myZones);
      UI.updateClaimStatus(true);
    }
    proofPhotoSrc = null;
  }

  function setProofPhoto(src) {
    proofPhotoSrc = src;
  }

  function isChallengeUnlocked() { return challengeUnlocked; }

  // ── Zone claimed callback ─────────────────────────────────
  function onZoneClaimed(territory) {
    myZones++;
    myScore += territory.str;
    if (typeof UI !== 'undefined') {
      UI.updateHeaderStats(myScore, myConns, myZones);
      UI.updateZoneList(Game.getByOwner(CONFIG.PHONE_ID));
      UI.addFeedItem(`🏰 Claimed <b>${territory.lore.name}</b> (${territory.str} STR)`, 'zone');
      UI.showZoneModal(territory);
    }
  }

  // ── NPC Squad competition ─────────────────────────────────
  function scheduleNPCSquads() {
    npcInitTimer = setTimeout(() => {
      initNPCSquads();
      npcClaimTimer = setInterval(npcClaimTerritory, CONFIG.NPC_CLAIM_INTERVAL);
    }, CONFIG.NPC_CLAIM_DELAY);
  }

  function initNPCSquads() {
    CONFIG.NPC_SQUAD_PAIRS.forEach(([i, j], idx) => {
      const a = students[i];
      const b = students[j];
      if (!a || !b) return;
      const squadId = `npc_squad_${idx}`;
      a.npcSquadId = squadId;
      b.npcSquadId = squadId;
      b.following = a.id;
      npcSquads.push({ id: squadId, leader: a, follower: b, claimed: 0 });

      if (typeof UI !== 'undefined') {
        UI.addFeedItem(`👥 <b>${a.name}</b> and <b>${b.name}</b> formed a squad!`, 'npc');
      }
    });
  }

  async function npcClaimTerritory() {
    if (npcSquads.length === 0) return;

    const squad = npcSquads[Math.floor(Math.random() * npcSquads.length)];
    const center = { lat: squad.leader.lat, lng: squad.leader.lng };
    const pts = generatePolygon(center, 0.0005 + Math.random() * 0.0004, 5 + Math.floor(Math.random() * 3));

    let lore;
    try {
      lore = await Claude.generateTerritory({
        area: Math.round(Game.calcArea(pts)),
        squad: true,
        spot: getNearestLandmarkTo(center),
        str: Game.calcStr(Game.calcArea(pts), true),
      });
    } catch {
      lore = {
        name: `${squad.leader.name.split(' ')[0]}'s Domain`,
        lore: "A fiercely guarded NPC territory.",
        energy: "Rival Energy",
        battle: "",
        reward: "NPC Champion",
      };
    }

    const t = Game.create({
      pts,
      squad: true,
      lore,
      ownerName: `${squad.leader.name} & ${squad.follower.name}`,
    });

    squad.claimed++;
    squad.leader.npcScore += t.str;
    squad.follower.npcScore += Math.floor(t.str * 0.7);

    if (typeof MapCtrl !== 'undefined') {
      MapCtrl.renderNPCTerritory(t);
    }
    if (typeof UI !== 'undefined') {
      UI.addFeedItem(`⚔️ <b>${squad.leader.name}</b>'s squad claimed <b>${lore.name}</b>!`, 'npc');
      UI.updateLeaderboard(getLeaderboard());
    }
  }

  function generatePolygon(center, radius, sides) {
    const pts = [];
    for (let i = 0; i < sides; i++) {
      const angle = (2 * Math.PI * i) / sides + (Math.random() - 0.5) * 0.4;
      const r = radius * (0.8 + Math.random() * 0.4);
      pts.push({
        lat: center.lat + r * Math.cos(angle),
        lng: center.lng + r * Math.sin(angle) / Math.cos(center.lat * Math.PI / 180),
      });
    }
    return pts;
  }

  // ── Scoring & Leaderboard ─────────────────────────────────
  function incrementNPCScores() {
    students.forEach(s => {
      if (s.npcSquadId) s.npcScore += Math.floor(Math.random() * 3);
    });
  }

  function getLeaderboard() {
    const entries = [{ name: "You", score: myScore, color: "#f59e0b", isYou: true }];
    students.forEach(s => {
      entries.push({ name: s.name, score: s.npcScore, color: s.color, isYou: false });
    });
    entries.sort((a, b) => b.score - a.score);
    return entries.slice(0, 8);
  }

  // ── Helpers ───────────────────────────────────────────────
  function getNearestLandmark() {
    if (!userPos) return "Memorial Union";
    let best = "Memorial Union", min = Infinity;
    CONFIG.LANDMARKS.forEach(lm => {
      const d = distanceDeg(userPos, lm);
      if (d < min) { min = d; best = lm.name; }
    });
    return best;
  }

  function getNearestLandmarkTo(pos) {
    let best = "campus", min = Infinity;
    CONFIG.LANDMARKS.forEach(lm => {
      const d = distanceDeg(pos, lm);
      if (d < min) { min = d; best = lm.name; }
    });
    return best;
  }

  function getNearbyList() {
    if (!userPos) return [];
    return students
      .filter(s => !s.following || s.following !== 'user')
      .map(s => ({
        ...s,
        dist: distanceMeters(userPos, s),
        distDeg: distanceDeg(userPos, s),
        isConnected: connectedStudents.has(s.id),
      }))
      .sort((a, b) => a.dist - b.dist)
      .slice(0, 10);
  }

  function getSquadMembers() {
    return students.filter(s => connectedStudents.has(s.id));
  }

  function isConnected(id) { return connectedStudents.has(id); }

  function triggerConnectionById(id) {
    const s = students.find(st => st.id === id);
    if (s && !connectedStudents.has(s.id) && !proximityAlerted.has(s.id)) {
      proximityAlerted.add(s.id);
      triggerConnectionRequest(s);
    }
  }

  function getSquadContribution() {
    if (connectedStudents.size === 0 || !userPos) return [];
    const members = getSquadMembers();
    return members.map(s => ({
      lat: s.lat + (hashStr(s.id + 'cLat') % 7 - 3) * 0.00008,
      lng: s.lng + (hashStr(s.id + 'cLng') % 7 - 3) * 0.00008,
    }));
  }

  function getMyScore() { return myScore; }
  function getMyConns() { return myConns; }
  function getMyZones() { return myZones; }

  return {
    init, start, stop, setUserPos, getUserPos,
    acceptConnection, declineConnection,
    submitProof, setProofPhoto, isChallengeUnlocked,
    onZoneClaimed,
    isConnected, triggerConnectionById,
    getNearbyList, getSquadMembers, getSquadContribution,
    getLeaderboard, getNearestLandmark,
    getMyScore, getMyConns, getMyZones,
  };

})();
