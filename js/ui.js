// ============================================================
//  js/ui.js — All UI updates, panels, modals, feed, leaderboard
// ============================================================

const UI = (() => {

  // ── Splash ────────────────────────────────────────────────
  function hideSplash() {
    const sp = document.getElementById('splash');
    if (sp) {
      sp.style.transition = 'opacity .5s ease';
      sp.style.opacity = '0';
      setTimeout(() => { sp.style.display = 'none'; }, 500);
    }
    const app = document.getElementById('app');
    if (app) app.style.display = 'flex';
    // Leaflet needs a visible container to calculate tile layout
    setTimeout(() => {
      if (typeof MapCtrl !== 'undefined') MapCtrl.init();
    }, 120);
  }

  // ── Modal helpers ─────────────────────────────────────────
  function showModal(id) {
    const el = document.getElementById(id);
    if (el) el.style.display = 'flex';
  }

  function closeModal(id) {
    const el = document.getElementById(id);
    if (el) el.style.display = 'none';
  }

  // ── Header stats ──────────────────────────────────────────
  function updateHeaderStats(score, conns, zones) {
    setText('h-score', score);
    setText('h-conns', conns);
    setText('h-zones', zones);
    setText('lp-score-big', score);
  }

  // ── Profile ───────────────────────────────────────────────
  function updateProfile(name, major) {
    const nameEl = document.querySelector('.prof-name');
    const majorEl = document.querySelector('.prof-major');
    if (nameEl) nameEl.textContent = name;
    if (majorEl) majorEl.textContent = major;
  }

  // ── Squad panel ───────────────────────────────────────────
  function updateSquadPanel(members) {
    const el = document.getElementById('lp-squad');
    const ct = document.getElementById('squad-ct');
    if (!el) return;
    if (ct) ct.textContent = `(${members.length})`;

    if (members.length === 0) {
      el.innerHTML = '<div class="lp-empty">No squad members yet</div>';
      return;
    }

    el.innerHTML = members.map(s => `
      <div class="sq-item">
        <div class="sq-dot" style="background:${s.color}"></div>
        <div>
          <div class="sq-name">${s.name}</div>
          <div class="sq-major">${s.major}</div>
        </div>
      </div>
    `).join('');
  }

  // ── Zone list ─────────────────────────────────────────────
  function updateZoneList(territories) {
    const el = document.getElementById('lp-zones');
    const ct = document.getElementById('zone-ct');
    if (!el) return;
    if (ct) ct.textContent = `(${territories.length})`;

    if (territories.length === 0) {
      el.innerHTML = '<div class="lp-empty">Claim your first territory!</div>';
      return;
    }

    el.innerHTML = territories.map(t => {
      const curStr = Game.getCurrentStrength(t);
      const pct = Math.round((curStr / 99) * 100);
      return `
        <div class="zone-item">
          <div class="zone-name">${t.lore.name}</div>
          <div class="zone-str-bar"><div class="zone-str-fill" style="width:${pct}%"></div></div>
        </div>
      `;
    }).join('');
  }

  // ── Nearby panel (right) ──────────────────────────────────
  function updateNearbyPanel(students) {
    const el = document.getElementById('rp-nearby');
    if (!el) return;

    if (students.length === 0) {
      el.innerHTML = '<div class="rp-empty">Walk around to discover students</div>';
      return;
    }

    el.innerHTML = students.map(s => {
      const isClose = s.distDeg < CONFIG.BLUETOOTH_RANGE;
      const closeClass = isClose ? ' nc-close' : '';
      const distStr = s.dist < 1000 ? `${Math.round(s.dist)}m` : `${(s.dist/1000).toFixed(1)}km`;

      let btnHtml;
      if (s.isConnected) {
        btnHtml = '<span class="nc-btn nc-connected">SQUAD</span>';
      } else if (isClose) {
        btnHtml = `<button class="nc-btn" onclick="Simulation.triggerConnectionById('${s.id}')">CONNECT</button>`;
      } else {
        btnHtml = `<span class="nc-dist">${distStr}</span>`;
      }

      return `
        <div class="nc${closeClass}">
          <div class="nc-avatar" style="background:${s.color}">${s.avatar}</div>
          <div class="nc-info">
            <div class="nc-name">${s.name}</div>
            <div class="nc-detail">${s.major} · ${s.bio || s.interests[0]}</div>
          </div>
          ${btnHtml}
        </div>
      `;
    }).join('');
  }

  // ── Activity feed ─────────────────────────────────────────
  function addFeedItem(html, type) {
    const el = document.getElementById('rp-feed');
    if (!el) return;

    // Remove the initial system message
    const sysMsg = el.querySelector('.fi-sys');
    if (sysMsg && sysMsg.textContent === 'Simulation starting...') {
      sysMsg.remove();
    }

    const cls = type ? `fi fi-${type}` : 'fi';
    const time = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const item = document.createElement('div');
    item.className = cls;
    item.innerHTML = `<div class="fi-time">${time}</div>${html}`;
    el.prepend(item);

    while (el.children.length > 14) {
      el.removeChild(el.lastChild);
    }
  }

  // ── Leaderboard ───────────────────────────────────────────
  function updateLeaderboard(entries) {
    const el = document.getElementById('rp-lb');
    if (!el) return;

    if (entries.length === 0) {
      el.innerHTML = '<div class="rp-empty">Scores loading...</div>';
      return;
    }

    el.innerHTML = entries.map((e, i) => {
      const youClass = e.isYou ? ' lbr-you' : '';
      return `
        <div class="lbr${youClass}">
          <div class="lbr-rank">${i + 1}</div>
          <div class="lbr-dot" style="background:${e.color}"></div>
          <div class="lbr-name">${e.name}</div>
          <div class="lbr-score">${e.score}</div>
        </div>
      `;
    }).join('');
  }

  // ── Connection request modal ──────────────────────────────
  function showConnectionRequest(student, ice) {
    const av = document.getElementById('mc-avatar');
    if (av) {
      av.style.background = student.color;
      av.textContent = student.avatar;
    }
    setText('mc-name', student.name);
    setText('mc-bio', `${student.major} · ${student.bio || student.interests.join(', ')}`);
    const iceEl = document.getElementById('mc-ice');
    if (iceEl) iceEl.textContent = `"${ice.icebreaker}"`;
    showModal('m-conn');
  }

  // ── Squad formed celebration ──────────────────────────────
  function showSquadFormed(student) {
    setText('sq-name', `${student.name} is now in your squad!`);
    showModal('m-squad');
  }

  function closeSquadCelebration() {
    closeModal('m-squad');
  }

  // ── Task modal ────────────────────────────────────────────
  function showTaskModal(data) {
    setText('tk-vibe', data.vibe || 'Friendly energy');
    setText('tk-spark', data.shared_spark || '');

    const qEl = document.getElementById('tk-questions');
    if (qEl && data.icebreaker_questions) {
      qEl.innerHTML = data.icebreaker_questions.map(q =>
        `<div class="tk-q">"${q}"</div>`
      ).join('');
    }

    setText('tk-challenge', data.challenge || 'Take a selfie together near a landmark!');
    showModal('m-task');
  }

  function closeTaskModal() {
    closeModal('m-task');
  }

  // ── Proof modal ───────────────────────────────────────────
  function showProofModal() {
    closeModal('m-task');
    document.getElementById('pf-preview').style.display = 'none';
    document.getElementById('pf-drop').style.display = '';
    document.getElementById('pf-input').value = '';
    document.getElementById('pf-submit').disabled = true;
    showModal('m-proof');
  }

  function closeProofModal() {
    closeModal('m-proof');
  }

  function handleProofUpload(event) {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      const src = e.target.result;
      const preview = document.getElementById('pf-preview');
      if (preview) {
        preview.src = src;
        preview.style.display = 'block';
      }
      document.getElementById('pf-drop').style.display = 'none';
      document.getElementById('pf-submit').disabled = false;
      Simulation.setProofPhoto(src);
    };
    reader.readAsDataURL(file);
  }

  // ── Challenge complete ────────────────────────────────────
  function showChallengeComplete(photoSrc, landmark) {
    const img = document.getElementById('cel-photo');
    if (img) img.src = photoSrc;
    setText('cel-text', `Challenge completed near ${landmark}! You can now claim zones.`);
    showModal('chf');
  }

  function closeCelebration() {
    closeModal('chf');
  }

  // ── Zone modal ────────────────────────────────────────────
  function showZoneModal(t) {
    setText('zn-name', t.lore.name);
    setText('zn-lore', t.lore.lore);
    setText('zn-str', t.str);
    setText('zn-area', t.area);
    setText('zn-mul', t.squad ? `${CONFIG.SQUAD_MUL}x` : `${CONFIG.SOLO_MUL}x`);
    setText('zn-reward', t.lore.reward ? `🏆 ${t.lore.reward}` : '');
    showModal('m-zone');
  }

  function closeZoneModal() {
    closeModal('m-zone');
  }

  // ── Claim button status ───────────────────────────────────
  function updateClaimStatus(unlocked) {
    const btn = document.getElementById('btn-claim');
    if (btn) btn.disabled = !unlocked;
    const status = document.getElementById('bb-status');
    if (status && unlocked) {
      status.textContent = 'Zone claiming unlocked! Click CLAIM ZONE to start drawing.';
    }
  }

  // ── Location label ────────────────────────────────────────
  function updateLocationLabel(landmark) {
    const el = document.getElementById('loclbl');
    if (el) el.textContent = `Near ${landmark}`;
  }

  // ── Loading ───────────────────────────────────────────────
  function showLoading(show) {
    const el = document.getElementById('loading');
    if (el) el.style.display = show ? 'flex' : 'none';
  }

  // ── Toast ─────────────────────────────────────────────────
  function toast(msg) {
    const el = document.getElementById('toast');
    if (!el) return;
    el.textContent = msg;
    el.classList.add('show');
    setTimeout(() => el.classList.remove('show'), 2500);
  }

  // ── Utility ───────────────────────────────────────────────
  function setText(id, val) {
    const el = document.getElementById(id);
    if (el) el.textContent = val;
  }

  return {
    hideSplash, showModal, closeModal,
    updateHeaderStats, updateProfile,
    updateSquadPanel, updateZoneList,
    updateNearbyPanel,
    addFeedItem, updateLeaderboard,
    showConnectionRequest, showSquadFormed, closeSquadCelebration,
    showTaskModal, closeTaskModal,
    showProofModal, closeProofModal, handleProofUpload,
    showChallengeComplete, closeCelebration,
    showZoneModal, closeZoneModal,
    updateClaimStatus, updateLocationLabel,
    showLoading, toast,
  };

})();
