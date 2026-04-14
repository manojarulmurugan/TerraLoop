// ============================================================
//  js/ui.js — Every DOM update lives here.
//             game.js and claude.js never touch the DOM.
// ============================================================

const UI = (() => {

  let toastTimer = null;

  // ── Loading overlay ───────────────────────────────────────
  function showLoading(msg) {
    document.getElementById("load-txt").textContent = msg || "Claude is naming your territory…";
    document.getElementById("loading").classList.remove("hidden");
  }

  function hideLoading() {
    document.getElementById("loading").classList.add("hidden");
  }

  // ── Territory card ────────────────────────────────────────
  function showCard(t) {
    const color = t.squad ? CONFIG.C_SQUAD : CONFIG.C_SOLO;
    const el    = document.getElementById("card");

    el.innerHTML = `
      <div style="padding-left:12px;margin-bottom:14px;border-left:4px solid ${color}">
        <div class="c-type" style="color:${color}">
          ${t.squad ? "Squad · 2 walkers" : "Solo walker"}
        </div>
        <div class="c-name">${t.lore.name}</div>
        ${t.spot ? `<div class="c-spot">${t.spot}</div>` : ""}
      </div>

      <div class="c-lore">"${t.lore.lore}"</div>

      <div class="c-energy">
        <span class="c-dot" style="background:${color}"></span>
        ${t.lore.energy}
      </div>

      <div class="c-str-row">
        <span class="c-str-lbl">Strength</span>
        <div class="str-bg">
          <div class="str-fill" style="width:${t.str}%;background:${color}"></div>
        </div>
        <span class="c-str-n">${t.str}</span>
      </div>

      <div class="c-area">${t.area.toLocaleString()} m² claimed</div>
      <div class="c-reward">${t.lore.reward}</div>

      <button class="c-close" onclick="UI.closeCard()">Close</button>
    `;

    el.classList.remove("hidden");
    requestAnimationFrame(() => el.classList.add("open"));
  }

  function closeCard() {
    const el = document.getElementById("card");
    el.classList.remove("open");
    setTimeout(() => el.classList.add("hidden"), 350);
  }

  // ── Toast ─────────────────────────────────────────────────
  function toast(msg, cls = "t-info") {
    const el = document.getElementById("toast");
    el.textContent = msg;
    el.className   = `${cls} show`;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => el.classList.remove("show"), 4500);
  }

  // ── Top bar controls ──────────────────────────────────────
  function setDrawState(active, count) {
    const startBtn  = document.getElementById("start-btn");
    const closeBtn  = document.getElementById("close-btn");
    const cancelBtn = document.getElementById("cancel-btn");
    const hint      = document.getElementById("hint");

    if (active) {
      startBtn.classList.add("hidden");
      closeBtn.classList.remove("hidden");
      cancelBtn.classList.remove("hidden");
      closeBtn.disabled = count < CONFIG.MIN_POINTS;

      hint.textContent = count < CONFIG.MIN_POINTS
        ? `${CONFIG.MIN_POINTS - count} more point${CONFIG.MIN_POINTS - count > 1 ? "s" : ""} needed`
        : "Ready — click Close Loop";
      hint.classList.remove("hidden");
    } else {
      startBtn.classList.remove("hidden");
      closeBtn.classList.add("hidden");
      cancelBtn.classList.add("hidden");
      hint.classList.add("hidden");
    }
  }

  function setSquadBtn(on) {
    const btn = document.getElementById("squad-btn");
    btn.textContent = on ? "Squad ON · 2.2×" : "Solo mode";
    btn.classList.toggle("squad-on", on);
  }

  function setTerrCount(n) {
    document.getElementById("terr-count").textContent =
      n ? `${n} territor${n === 1 ? "y" : "ies"} claimed` : "";
  }

  return {
    showLoading,
    hideLoading,
    showCard,
    closeCard,
    toast,
    setDrawState,
    setSquadBtn,
    setTerrCount,
  };

})();
