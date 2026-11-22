/* Calistenia 45 — rutina por fases, control de codo, registro de series e importación desde Excel. */
(function () {
  "use strict";

  const APP_VERSION = "1.2";
  const KEY = "cal45_v1";
  const slug = window.ProgramIO.slug;

  // ---------- Fechas ----------
  function today() { const d = new Date(); return ymd(d); }
  function ymd(d) { return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`; }
  function daysSince(dateStr) {
    const [y, m, d] = dateStr.split("-").map(Number);
    const a = new Date(y, m - 1, d), n = new Date(); n.setHours(0, 0, 0, 0);
    return Math.round((n - a) / 864e5);
  }
  const DOW = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"];
  const fmtDate = iso => { const d = new Date(iso); return `${DOW[d.getDay()]} ${d.getDate()}/${d.getMonth() + 1}`; };
  const fmtYmd = s => { const [y, m, d] = s.split("-").map(Number); return fmtDate(new Date(y, m - 1, d).toISOString()); };
  const fmtTime = s => { s = Math.max(0, Math.round(s)); return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`; };

  // ---------- Estado ----------
  function fresh() {
    return {
      v: 2, program: null,
      phase: { idx: 0, start: today(), rehabStart: today() },
      rot: {}, sessions: [], loads: {},
      settings: { sound: true, vibrate: true, deloadEvery: 21, deload: false },
      active: null, notice: null
    };
  }
  const OLD_NAMES = {"pullups":"Dominadas pronas","pullups_heavy":"Dominadas pronas con mochila","chinup":"Chin-ups (dominadas supinas)","dips":"Fondos en paralelas","dips_chest":"Fondos con torso inclinado","bulgarian":"Sentadilla búlgara con mochila","decline_pushup":"Flexiones con pies en silla","nordic":"Curl nórdico asistido","hanging_raise":"Elevaciones de piernas colgado","inverted_row":"Remo australiano prono","inverted_row_sup":"Remo australiano supino","pushup":"Flexiones con mochila o en déficit","stepup":"Step-up alto con mochila","sl_rdl":"Peso muerto rumano a una pierna","deadbug":"Dead bug","diamond":"Flexiones diamante","box_pistol":"Sentadilla a una pierna a banco","facepull":"Face pull con banda","hip_thrust":"Hip thrust a una pierna con mochila","tuck_lsit":"Tuck L-sit en paralelas","band_curl":"Curl de bíceps con banda"};

  function migrate(old) {
    const s = fresh();
    s.settings = Object.assign(s.settings, old.settings || {});
    const conv = id => OLD_NAMES[id] ? slug(OLD_NAMES[id]) : id;
    s.sessions = (old.sessions || []).map(x => ({
      date: x.date, phase: "N", phaseName: "Rutina normal", session: "N-" + x.day, sessionName: "Día " + x.day,
      upper: true, dur: x.dur, deload: x.deload, early: x.early,
      sets: (x.sets || []).map(t => ({ ex: conv(t.ex), name: OLD_NAMES[t.ex] || t.ex, round: t.round, val: t.val, rir: t.rir, kg: t.kg || 0 })),
      finisher: x.finisher ? { ex: conv(x.finisher.ex), name: OLD_NAMES[x.finisher.ex] || x.finisher.ex, done: x.finisher.done } : null
    }));
    Object.keys(old.loads || {}).forEach(k => { s.loads[conv(k)] = old.loads[k]; });
    s.notice = "migrated";
    return s;
  }
  function load() {
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) {
        const d = JSON.parse(raw);
        if (!d.v || d.v < 2) return migrate(d);
        const s = Object.assign(fresh(), d);
        s.settings = Object.assign(fresh().settings, d.settings || {});
        return s;
      }
    } catch (e) {}
    const s = fresh(); s.notice = "new"; return s;
  }
  let S = load();
  function save() { try { localStorage.setItem(KEY, JSON.stringify(S)); } catch (e) { toast("No se pudo guardar en el teléfono"); } }
  save();

  // ---------- Programa ----------
  const P = () => S.program || window.DEFAULT_PROGRAM;
  function phase() {
    const ph = P().phases;
    if (S.phase.idx >= ph.length || S.phase.idx < 0) S.phase.idx = 0;
    return ph[S.phase.idx];
  }
  function sessionByCode(code) { return phase().sessions.find(s => s.code === code); }
  function findItem(id) {
    for (const s of phase().sessions) for (const b of s.blocks) for (const i of b.items) if (i.id === id) return { item: i, block: b };
    for (const p of P().phases) for (const s of p.sessions) for (const b of s.blocks) for (const i of b.items) if (i.id === id) return { item: i, block: b, other: true };
    return null;
  }

  // ---------- Utilidades UI ----------
  const $app = document.getElementById("app");
  const esc = s => String(s == null ? "" : s).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  const img = (name, j) => `img/${name}_${j}.jpg`;
  const rangeTxt = it => it.type === "37" ? "3-4-5-6-7 reps, 15 s entre series" :
    `${it.range[0]}–${it.range[1]} ${it.type === "time" ? "s" : "reps"}${it.perLeg ? " por lado" : ""}`;
  function toast(msg) {
    const t = document.getElementById("toast");
    t.textContent = msg; t.classList.remove("hidden");
    clearTimeout(toast._t); toast._t = setTimeout(() => t.classList.add("hidden"), 2600);
  }
  function modal(html) {
    const box = document.createElement("div");
    box.className = "lightbox";
    box.innerHTML = `<div class="sheet">${html}</div>`;
    document.body.appendChild(box);
    return box;
  }

  // ---------- Sonido, vibración, pantalla ----------
  let audio = null;
  function unlockAudio() {
    try {
      if (!audio) audio = new (window.AudioContext || window.webkitAudioContext)();
      if (audio.state === "suspended") audio.resume();
    } catch (e) {}
  }
  document.addEventListener("pointerdown", unlockAudio, { passive: true });
  function beep(freq = 880, dur = 0.18, vol = 0.35) {
    if (!S.settings.sound || !audio) return;
    try {
      const o = audio.createOscillator(), g = audio.createGain();
      o.type = "square"; o.frequency.value = freq;
      g.gain.setValueAtTime(vol, audio.currentTime);
      g.gain.exponentialRampToValueAtTime(0.001, audio.currentTime + dur);
      o.connect(g); g.connect(audio.destination); o.start(); o.stop(audio.currentTime + dur);
    } catch (e) {}
  }
  function buzz(p) { if (S.settings.vibrate && navigator.vibrate) try { navigator.vibrate(p); } catch (e) {} }
  let wakeLock = null;
  async function keepAwake(on) {
    try {
      const KA = window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins.KeepAwake;
      if (KA) { on ? await KA.keepAwake() : await KA.allowSleep(); return; }
      if (on && "wakeLock" in navigator) wakeLock = await navigator.wakeLock.request("screen");
      if (!on && wakeLock) { await wakeLock.release(); wakeLock = null; }
    } catch (e) {}
  }
  document.addEventListener("visibilitychange", () => { if (document.visibilityState === "visible" && S.active) keepAwake(true); });

  // ---------- Historial ----------
  function lastSetsFor(id) {
    for (let i = S.sessions.length - 1; i >= 0; i--) {
      const sets = S.sessions[i].sets.filter(x => x.ex === id);
      if (sets.length) return { session: S.sessions[i], sets };
    }
    return null;
  }
  function readyToProgress(id) {
    const f = findItem(id);
    if (!f || f.other || f.item.type === "37") return false;
    const last = lastSetsFor(id);
    if (!last || last.session.deload) return false;
    return last.sets.length >= f.block.rounds && last.sets.every(s => s.val >= f.item.range[1] && (s.rir == null || s.rir >= 1));
  }
  function lastTxt(id) {
    const l = lastSetsFor(id);
    if (!l) return null;
    return `${fmtDate(l.session.date)}: ${l.sets.map(s => s.val).join(", ")}${l.sets[0].kg ? ` · ${l.sets[0].kg} kg` : ""}`;
  }
  function f37Last(id) {
    for (let i = S.sessions.length - 1; i >= 0; i--) { const f = S.sessions[i].finisher; if (f && f.ex === id) return f; }
    return null;
  }

  // ---------- Fases ----------
  function phaseDay() { return daysSince(S.phase.start) + 1; }
  function rehabDay() { return daysSince(S.phase.rehabStart || S.phase.start) + 1; }
  function phaseSessions() {
    const ph = phase();
    return S.sessions.filter(s => s.phase === ph.code && ymd(new Date(s.date)) >= S.phase.start);
  }
  function evalPhase() {
    const ph = phase(), list = phaseSessions();
    const reasons = [];
    if (!list.length) reasons.push("Aún no registras sesiones en esta fase.");
    if (ph.sessions.some(s => s.upper) && !list.some(s => s.upper)) reasons.push("Falta al menos una sesión de tren superior en esta fase.");
    if (ph.elbow) {
      const bad = list.filter(s => (s.elbowPre != null && s.elbowPre > 2) || (s.elbowPost != null && s.elbowPost > 2));
      if (bad.length) reasons.push(`En ${bad.length} sesión(es) la molestia del codo pasó de 2/10.`);
      if (list.some(s => s.elbowFeel === "peor")) reasons.push("El codo amaneció peor después de alguna sesión.");
    }
    return { ok: reasons.length === 0, reasons, n: list.length };
  }
  function lastUpperHours() {
    for (let i = S.sessions.length - 1; i >= 0; i--) if (S.sessions[i].upper) return (Date.now() - new Date(S.sessions[i].date).getTime()) / 36e5;
    return Infinity;
  }
  function lowerAlternative() { return phase().sessions.find(s => !s.upper) || null; }
  function defaultSession() {
    const ph = phase(), dow = new Date().getDay();
    const byDay = ph.sessions.filter(s => s.weekdays && s.weekdays.includes(dow));
    if (byDay.length === 1) return byDay[0];
    const r = (S.rot[ph.code] || 0) % ph.sessions.length;
    if (byDay.length > 1) return byDay.find(s => s === ph.sessions[r]) || byDay[0];
    return ph.sessions[r];
  }
  function setPhase(idx, keepStart) {
    S.phase.idx = idx;
    if (!keepStart) S.phase.start = today();
    S.settings.deload = false;
    save();
  }

  // ---------- Pasos de la sesión ----------
  function buildSteps(sess, deload) {
    const steps = [{ k: "warmup" }, { k: "approach", items: (sess.blocks[0] || { items: [] }).items }];
    sess.blocks.forEach((b, bi) => {
      if (b.type === "37") { if (!deload) steps.push({ k: "f37", item: b.items[0], label: b.label }); return; }
      const rounds = deload ? Math.ceil(b.rounds / 2) : b.rounds;
      for (let r = 1; r <= rounds; r++) {
        b.items.forEach((item, pos) => {
          if (r > (deload ? Math.ceil(item.sets / 2) : item.sets)) return;
          steps.push({ k: "set", item, bi, label: b.label, btype: b.type, round: r, rounds: deload ? Math.ceil(item.sets / 2) : item.sets, rest: item.rest, pos });
        });
      }
    });
    steps.push({ k: "cooldown" });
    for (let i = 0; i < steps.length - 1; i++) {
      const a = steps[i], b = steps[i + 1];
      if (a.k === "set" && (b.k !== "set" || a.bi !== b.bi)) a.rest = Math.max(45, Math.min(a.rest, 90));
    }
    return steps;
  }

  // ---------- Navegación ----------
  let tab = "home", pickedSession = null, precheck = null;
  function render() {
    stopTick();
    if (S.active) return renderSession();
    if (precheck) return renderPrecheck();
    if (tab === "home") renderHome();
    else if (tab === "history") renderHistory();
    else renderSettings();
  }
  const ICONS = {
    home: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 11l9-7 9 7v9a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z"/></svg>',
    history: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 19V9M10 19V5M16 19v-7M22 19H2"/></svg>',
    settings: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M4.2 4.2l2.1 2.1M17.7 17.7l2.1 2.1M2 12h3M19 12h3M4.2 19.8l2.1-2.1M17.7 6.3l2.1-2.1"/></svg>'
  };
  function tabsHtml() {
    const b = (id, label) => `<button class="${tab === id ? "on" : ""}" data-tab="${id}">${ICONS[id]}${label}</button>`;
    return `<nav class="tabs"><div class="inner">${b("home", "Entrenar")}${b("history", "Registro")}${b("settings", "Ajustes")}</div></nav>`;
  }
  function bindTabs() {
    $app.querySelectorAll("[data-tab]").forEach(el => el.onclick = () => { tab = el.dataset.tab; render(); window.scrollTo(0, 0); });
  }

  // ---------- Inicio ----------
  function renderHome() {
    const ph = phase(), phs = P().phases;
    const sess = (pickedSession && sessionByCode(pickedSession)) || defaultSession();
    const pd = phaseDay();
    const complete = ph.days > 0 && pd > ph.days;
    const ev = complete ? evalPhase() : null;
    const next = phs[S.phase.idx + 1];
    const prev = phs[S.phase.idx - 1];
    const deloadMode = ph.days === 0 && S.settings.deload;

    // Aviso de 72 h
    let gapWarn = "";
    if (ph.gap > 0 && sess.upper) {
      const h = lastUpperHours();
      if (h < ph.gap) {
        const alt = lowerAlternative();
        gapWarn = `<div class="hint warn mt12">Tu última sesión de tren superior fue hace ${Math.round(h)} h. El tendón necesita ${ph.gap} h entre sesiones.
          ${alt ? `<button class="btn sm mt8" data-pick="${esc(alt.code)}">Hacer "${esc(alt.name)}" hoy</button>` : ""}</div>`;
      }
    }

    // Lista de ejercicios
    let list = "";
    sess.blocks.forEach(b => {
      if (b.type === "37" && deloadMode) return;
      const rounds = b.type === "37" ? null : (deloadMode ? Math.ceil(b.rounds / 2) : b.rounds);
      list += `<div class="mt12 tiny muted">${esc(b.label)}${rounds ? ` · ${rounds} ${b.type === "ss" ? "rondas" : "series"}` : " · 3-4-5-6-7"}</div>`;
      (b.type === "37" ? b.items.slice(0, 1) : b.items).forEach(it => {
        const up = readyToProgress(it.id);
        list += `<div class="exline">${it.img ? `<img src="${img(it.img, 1)}" alt="">` : `<div class="noimg"></div>`}<div class="meta"><b>${esc(it.name)}</b>
          <span class="small muted">${rangeTxt(it)}${it.load && S.loads[it.id] ? ` · ${S.loads[it.id]} kg` : ""}</span>
          ${up ? '<div class="small" style="color:var(--accent)">▲ Listo para subir dificultad</div>' : ""}</div></div>`;
      });
    });

    // Banner de primera vez
    let notice = "";
    if (S.notice) {
      notice = `<div class="card notice"><b>${S.notice === "migrated" ? "Rutina de recuperación activada" : "Bienvenido"}</b>
        <p class="small" style="margin:6px 0 0">Empiezas en la ${esc(phs[0].name)} con el Día 1 de la recuperación = hoy (${fmtYmd(S.phase.rehabStart)}).
        ${S.notice === "migrated" ? "Tu registro anterior se mantiene." : ""} Puedes cambiar la fecha o la fase en Ajustes.</p>
        <button class="btn sm mt8" id="okNotice">Entendido</button></div>`;
    }

    // Tarjeta de fase
    const sessChips = ph.sessions.map(s => `<button data-pick="${esc(s.code)}" class="${s === sess ? "on" : ""}">${esc(s.name)}
        <span class="s">${s.weekdays.length ? s.weekdays.map(d => DOW[d]).join(" · ") : "Cualquier día"}${s.upper ? "" : " · sin tren sup."}</span></button>`).join("");

    const cycleInfo = ph.days === 0 ? (() => {
      const n = S.sessions.filter(s => s.phase === ph.code && ymd(new Date(s.date)) >= S.phase.start).length;
      const every = S.settings.deloadEvery || 21, inCycle = n % every;
      return `<div class="row between small mt12"><span class="muted">Ciclo hasta la descarga</span><b>${inCycle} / ${every}</b></div>
        <div class="bar mt8"><div style="width:${(inCycle / every) * 100}%"></div></div>
        ${n > 0 && inCycle === 0 && !S.settings.deload ? `<div class="hint warn mt8">Toca una semana de descarga. Actívala en Ajustes.</div>` : ""}`;
    })() : `<div class="row between small mt12"><span class="muted">Día de la fase</span><b>${Math.min(pd, ph.days)} de ${ph.days}${pd > ph.days ? " ✓" : ""}</b></div>
        <div class="bar mt8"><div style="width:${Math.min(100, (pd / ph.days) * 100)}%"></div></div>`;

    const lastElbow = [...S.sessions].reverse().find(s => s.elbowPost != null || s.elbowPre != null);
    const phaseCard = `<div class="card phasecard mt16">
      <div class="row between"><span class="pill accent">${esc(ph.code)}</span>
        ${ph.elbow ? `<span class="small muted">Día ${rehabDay()} de la recuperación</span>` : ""}</div>
      <h2 class="mt8">${esc(ph.name)}</h2>
      <p class="small muted" style="margin:6px 0 0">${esc(ph.desc)}</p>
      ${cycleInfo}
      ${ph.criteria ? `<details class="mt8"><summary>Criterio para avanzar</summary><div class="small">${esc(ph.criteria)}</div></details>` : ""}
      ${ph.elbow && lastElbow ? `<div class="small mt8"><span class="muted">Codo, última sesión:</span> ${lastElbow.elbowPre != null ? `antes ${lastElbow.elbowPre}/10` : ""}${lastElbow.elbowPost != null ? ` · durante ${lastElbow.elbowPost}/10` : ""}${lastElbow.elbowFeel ? ` · amaneció ${lastElbow.elbowFeel}` : ""}</div>` : ""}
      ${complete && next ? `<div class="hint ${ev.ok ? "" : "warn"} mt12">
          ${ev.ok ? `<b>Cumpliste los ${ph.days} días y el criterio.</b> Puedes pasar a la ${esc(next.name)}.` :
          `<b>Cumpliste los ${ph.days} días, pero aún no el criterio:</b><br>${ev.reasons.map(esc).join("<br>")}<br>Lo recomendable es repetir la fase.`}
          <div class="row mt8" style="flex-wrap:wrap">
            <button class="btn sm ${ev.ok ? "primary" : ""}" id="nextPhase">Pasar a ${esc(next.code)}</button>
            <button class="btn sm ${ev.ok ? "" : "primary"}" id="repeatPhase">Repetir la fase</button></div></div>` : ""}
      ${ph.elbow && prev ? `<button class="btn ghost mt8" id="backPhase" style="padding:6px;font-size:12.5px;color:var(--muted)">¿El codo empeoró? Volver a la ${esc(prev.code)}</button>` : ""}
    </div>`;

    $app.innerHTML = `<div class="wrap">
      <div class="tiny muted">${esc(P().name)}</div>
      <h1 class="mt8">Hoy toca: ${esc(sess.name)}</h1>
      <p class="muted mt8" style="margin-bottom:0">${esc(sess.focus || "")}</p>
      ${notice}
      ${phaseCard}
      <div class="chips mt12">${sessChips}</div>
      ${gapWarn}
      ${deloadMode ? `<div class="hint warn mt12">Semana de descarga: la mitad de las series, sin bloque 3/7 y lejos del fallo (RIR 3–4).</div>` : ""}
      <div class="card mt12">${list}</div>
      ${S.sessions.length ? `<button class="btn ghost mt12" id="undo" style="font-size:13px;color:var(--muted)">Deshacer la última sesión registrada</button>` : ""}
    </div>
    <div class="bottom" style="bottom:62px"><div class="inner"><button class="btn primary" id="start">▶ Empezar: ${esc(sess.name)}</button></div></div>
    ${tabsHtml()}`;

    bindTabs();
    $app.querySelectorAll("[data-pick]").forEach(b => b.onclick = () => { pickedSession = b.dataset.pick; renderHome(); });
    document.getElementById("start").onclick = () => beginSession(sess);
    const on = document.getElementById("okNotice"); if (on) on.onclick = () => { S.notice = null; save(); renderHome(); };
    const np = document.getElementById("nextPhase");
    if (np) np.onclick = () => {
      if (!ev.ok && !confirm("Aún no cumples el criterio para avanzar. ¿Pasar de fase igual?")) return;
      setPhase(S.phase.idx + 1); pickedSession = null; toast(`Ahora estás en la ${phase().name}`); renderHome(); window.scrollTo(0, 0);
    };
    const rp = document.getElementById("repeatPhase");
    if (rp) rp.onclick = () => { setPhase(S.phase.idx); toast("Fase reiniciada desde hoy"); renderHome(); };
    const bp = document.getElementById("backPhase");
    if (bp) bp.onclick = () => {
      if (!confirm(`¿Volver a la ${prev.name}? Empieza desde hoy.`)) return;
      setPhase(S.phase.idx - 1); pickedSession = null; renderHome(); window.scrollTo(0, 0);
    };
    const u = document.getElementById("undo");
    if (u) u.onclick = () => {
      if (!confirm("¿Borrar la última sesión registrada? Se pierden sus series.")) return;
      const s = S.sessions.pop();
      const ph2 = P().phases.find(p => p.code === s.phase);
      if (ph2) { const i = ph2.sessions.findIndex(x => x.code === s.session); if (i >= 0) S.rot[ph2.code] = i; }
      save(); renderHome(); toast("Sesión eliminada");
    };
  }

  // ---------- Control del codo antes de entrenar ----------
  function beginSession(sess) {
    unlockAudio();
    if (phase().elbow) { precheck = { code: sess.code, pain: null, feel: null }; render(); window.scrollTo(0, 0); }
    else startSession(sess, {});
  }
  function painGrid(attr, val) {
    let h = `<div class="grid11">`;
    for (let n = 0; n <= 10; n++) h += `<button data-${attr}="${n}" class="${val === n ? "on" : ""} ${n >= 4 ? "hi" : n === 3 ? "mid" : ""}">${n}</button>`;
    return h + "</div>";
  }
  function renderPrecheck() {
    const pc = precheck, sess = sessionByCode(pc.code) || defaultSession();
    const hadPrev = S.sessions.some(s => s.elbowPost != null || s.elbowPre != null);
    const alt = lowerAlternative();
    let advice = "";
    if (pc.pain != null) {
      if (pc.pain >= 4 || pc.feel === "peor") {
        advice = `<div class="hint warn mt12"><b>Hoy no cargues el codo.</b> ${sess.upper && alt ? `Haz la sesión "${esc(alt.name)}" en su lugar.` : "Haz la sesión con cuidado y para si la molestia sube."}
          Si se repite, vuelve a la fase anterior desde la pantalla de inicio. Si la molestia no baja en unos días, consulta a un kinesiólogo.</div>`;
      } else if (pc.pain === 3) {
        advice = `<div class="hint warn mt12">Molestia moderada: entrena, pero en el tren superior baja la intensidad y para si pasa de 3/10.</div>`;
      } else {
        advice = `<div class="hint mt12">Bien. Durante la sesión, la molestia aceptable es hasta 2/10 y debe pasarse en pocos minutos.</div>`;
      }
    }
    const ready = pc.pain != null && (!hadPrev || pc.feel != null);
    const suggestAlt = sess.upper && alt && pc.pain != null && (pc.pain >= 3 || pc.feel === "peor");
    $app.innerHTML = `<div class="wrap">
      <div class="row"><button class="btn sm" id="cancel">← Volver</button></div>
      <h1 class="mt16">¿Cómo está el codo?</h1>
      <p class="small muted">Antes de "${esc(sess.name)}". 0 = nada, 10 = dolor máximo.</p>
      <div class="card"><b>Molestia en el pliegue del codo ahora</b>${painGrid("pain", pc.pain)}</div>
      ${hadPrev ? `<div class="card"><b>Después de la sesión anterior, el codo amaneció…</b>
        <div class="seg mt8" style="grid-template-columns:repeat(3,1fr)">${["mejor", "igual", "peor"].map(f => `<button data-feel="${f}" class="${pc.feel === f ? "on" : ""}">${f[0].toUpperCase() + f.slice(1)}</button>`).join("")}</div></div>` : ""}
      ${advice}
    </div>
    <div class="bottom"><div class="inner">
      ${suggestAlt ? `<button class="btn primary" id="alt">Hacer "${esc(alt.name)}"</button>` : ""}
      <button class="btn ${suggestAlt ? "" : "primary"}" id="go" ${ready ? "" : "disabled"}>${ready ? `Empezar ${esc(sess.name)} ➔` : "Responde para empezar"}</button>
    </div></div>`;
    $app.querySelectorAll("[data-pain]").forEach(b => b.onclick = () => { pc.pain = +b.dataset.pain; renderPrecheck(); });
    $app.querySelectorAll("[data-feel]").forEach(b => b.onclick = () => { pc.feel = b.dataset.feel; renderPrecheck(); });
    document.getElementById("cancel").onclick = () => { precheck = null; render(); };
    document.getElementById("go").onclick = () => { if (!ready) return; const p = precheck; precheck = null; startSession(sess, { elbowPre: p.pain, elbowFeel: p.feel }); };
    const a = document.getElementById("alt");
    if (a) a.onclick = () => { const p = precheck; precheck = null; startSession(alt, { elbowPre: p.pain, elbowFeel: p.feel }); };
  }

  // ---------- Sesión en curso ----------
  function startSession(sess, elbow) {
    const ph = phase();
    const deload = ph.days === 0 && !!S.settings.deload;
    S.active = {
      phase: ph.code, phaseName: ph.name, session: sess.code, sessionName: sess.name, upper: !!sess.upper, elbowPhase: !!ph.elbow,
      start: Date.now(), deload, steps: buildSteps(sess, deload), i: 0, sets: [], finisher: null, warm: [], rest: null,
      warmup: ph.warmup || [], cooldown: ph.cooldown || [],
      elbowPre: elbow.elbowPre == null ? null : elbow.elbowPre, elbowFeel: elbow.elbowFeel || null, elbowPost: null
    };
    pickedSession = null;
    save(); keepAwake(true); render(); window.scrollTo(0, 0);
  }
  const A = () => S.active;
  const step = () => A().steps[A().i];
  function sessionHeader(title) {
    const a = A(), total = a.steps.length;
    return `<div class="topbar">
      <button class="btn sm" id="exit">✕ Salir</button>
      <div class="grow" style="text-align:center"><div class="tiny muted">${esc(title)}</div><div class="small muted">Paso ${a.i + 1} de ${total}</div></div>
      <div class="clock" id="clock">${fmtTime((Date.now() - a.start) / 1000)}</div>
    </div><div class="bar mt8"><div style="width:${((a.i + 1) / total) * 100}%"></div></div>`;
  }
  function bindHeader() {
    document.getElementById("exit").onclick = () => {
      if (confirm("¿Salir del entrenamiento?\n\nAceptar: guardar lo que llevas y terminar.\nCancelar: seguir entrenando.")) finishSession(true);
    };
  }
  function renderSession() {
    const st = step();
    if (A().rest) return renderRest();
    if (!st) return finishSession(false);
    if (st.k === "warmup") return renderWarmup();
    if (st.k === "approach") return renderApproach();
    if (st.k === "set") return renderSet();
    if (st.k === "f37") return render37();
    if (st.k === "cooldown") return renderCooldown();
  }
  function advance() { A().i++; save(); render(); window.scrollTo(0, 0); }

  function renderWarmup() {
    const a = A(), W = a.warmup;
    if (!a.warmStart) { a.warmStart = Date.now(); save(); }
    const total = W.reduce((t, w) => t + (w.dur || 0), 0);
    const items = W.map((w, i) => `<div class="wu ${a.warm.includes(i) ? "done" : ""}" data-w="${i}">
        ${w.img ? `<img src="${img(w.img, 0)}" alt="">` : `<div class="ph"></div>`}
        <div class="grow"><b style="font-size:14px">${esc(w.name)}</b><div class="small muted">${w.dur >= 60 ? Math.round(w.dur / 60 * 10) / 10 + " min" : w.dur + " s"}</div></div>
        <div class="chk">${a.warm.includes(i) ? "✓" : ""}</div></div>`).join("");
    $app.innerHTML = `<div class="wrap">${sessionHeader("Calentamiento")}
      <h2 class="mt16">Calentamiento · ${Math.round(total / 60)} min</h2>
      <p class="small muted">Movimiento continuo, sin estiramientos largos. Toca cada ítem al terminarlo.</p>
      <div class="card row between"><span class="muted small">Tiempo de calentamiento</span><b id="wclock" style="font-size:22px;font-variant-numeric:tabular-nums">0:00</b></div>
      ${items || '<p class="small muted">Esta fase no tiene calentamiento definido.</p>'}
    </div>
    <div class="bottom"><div class="inner"><button class="btn primary" id="next">${a.warm.length >= W.length ? "Listo, seguir ➔" : `Seguir (${a.warm.length}/${W.length})`}</button></div></div>`;
    bindHeader();
    $app.querySelectorAll("[data-w]").forEach(el => el.onclick = () => {
      const i = +el.dataset.w, ix = a.warm.indexOf(i);
      ix >= 0 ? a.warm.splice(ix, 1) : a.warm.push(i); save(); renderWarmup();
    });
    document.getElementById("next").onclick = advance;
    startTick(() => {
      const e = (Date.now() - a.warmStart) / 1000, el = document.getElementById("wclock");
      if (el) { el.textContent = fmtTime(e); el.style.color = e > total + 60 ? "var(--warn)" : ""; }
      tickClock();
    });
  }

  function renderApproach() {
    const items = (step().items || []).filter(i => i.type !== "37");
    $app.innerHTML = `<div class="wrap">${sessionHeader("Series de aproximación")}
      <h2 class="mt16">Aproximación · 2 min</h2>
      <p class="small muted">Una serie fácil de cada ejercicio del primer bloque, en su versión más fácil. No cuenta para el registro.</p>
      ${items.map(it => `<div class="card"><div class="row">${it.img ? `<img src="${img(it.img, 0)}" style="width:72px;height:54px;object-fit:cover;border-radius:10px" alt="">` : ""}
        <div><b>${esc(it.name)}</b><div class="small muted">${it.type === "time" ? "10–15 s suaves" : "5–6 reps fáciles"}${it.easier ? " · " + esc(it.easier) : ""}</div></div></div></div>`).join("")}
    </div>
    <div class="bottom"><div class="inner"><button class="btn primary" id="next">Empezar el primer bloque ➔</button></div></div>`;
    bindHeader();
    document.getElementById("next").onclick = advance;
    startTick(tickClock);
  }

  function effortTxt(st) {
    const a = A();
    if (a.elbowPhase && st.item.type === "time") return ["Suave", "2–3 de 10"];
    if (a.elbowPhase) return ["RIR 2–3", "sin llegar al fallo"];
    if (a.deload) return ["RIR 3–4", "descarga"];
    return ["RIR 1–2", st.round === st.rounds ? "última: puede 0" : "1–2 en reserva"];
  }

  function renderSet() {
    const st = step(), it = st.item, a = A();
    const kg = S.loads[it.id] || 0, prev = lastTxt(it.id), up = readyToProgress(it.id);
    const dots = []; for (let r = 1; r <= st.rounds; r++) dots.push(`<i class="${r < st.round ? "done" : r === st.round ? "now" : ""}"></i>`);
    const todaySets = a.sets.filter(s => s.ex === it.id).map(s => s.val);
    const code = st.btype === "ss" ? String.fromCharCode(65 + st.bi) + (st.pos + 1) : String.fromCharCode(65 + st.bi);
    const [eff, effSub] = effortTxt(st);
    $app.innerHTML = `<div class="wrap">${sessionHeader(st.label)}
      <div class="row between mt16">
        <div class="grow"><span class="pill accent">${code}</span><h2 class="mt8">${esc(it.name)}</h2><div class="small muted">${esc(it.muscles)}</div></div>
        <div style="text-align:right"><div class="tiny muted">Serie</div><div style="font-size:26px;font-weight:900">${st.round}<span class="muted" style="font-size:16px">/${st.rounds}</span></div></div>
      </div>
      <div class="setdots mt8">${dots.join("")}</div>
      ${it.img ? `<div class="photos mt12">
        <div><div class="photo" data-zoom="${img(it.img, 0)}"><img src="${img(it.img, 0)}" alt=""><span class="lab">1 · INICIO</span></div></div>
        <div><div class="photo" data-zoom="${img(it.img, 1)}"><img src="${img(it.img, 1)}" alt=""><span class="lab">2 · FINAL</span></div></div>
      </div>` : ""}
      <div class="stats mt12">
        <div class="stat"><div class="k">Objetivo</div><div class="v">${it.range[0]}–${it.range[1]}${it.type === "time" ? " s" : ""}</div><div class="small muted">${it.perLeg ? "por lado" : it.type === "time" ? "sostenido" : "reps"}</div></div>
        <div class="stat"><div class="k">Esfuerzo</div><div class="v">${eff}</div><div class="small muted">${effSub}</div></div>
        <div class="stat"><div class="k">Descanso</div><div class="v">${st.rest} s</div><div class="small muted">después</div></div>
      </div>
      ${up ? `<div class="hint mt12">▲ La vez pasada llegaste al tope en todas las series.${it.harder ? " Más difícil: " + esc(it.harder) : ""}</div>` : ""}
      ${prev || todaySets.length ? `<div class="card mt12 small">${prev ? `<span class="muted">La vez pasada · </span><b>${esc(prev)}</b>` : ""}${todaySets.length ? `${prev ? "<br>" : ""}<span class="muted">Hoy · </span><b>${todaySets.join(", ")}</b>` : ""}</div>` : ""}
      ${it.load ? `<div class="card mt12 row between"><div><b style="font-size:14px">Peso en la mochila</b><div class="small muted">Se guarda para la próxima vez</div></div>
        <div class="kg"><button data-kg="-1">−</button><span id="kgv">${kg} kg</span><button data-kg="1">+</button></div></div>` : ""}
      ${it.type === "time" ? `<div class="card mt12" style="text-align:center"><div class="tiny muted">Cronómetro · objetivo ${it.range[0]}–${it.range[1]} s</div>
        <div id="hold" style="font-size:52px;font-weight:900;font-variant-numeric:tabular-nums">0</div>
        <button class="btn sm" id="holdbtn" style="margin:6px auto 0">Iniciar</button></div>` : ""}
      ${it.tips ? `<div class="hint mt12">${esc(it.tips)}</div>` : ""}
      ${it.safety ? `<div class="hint warn mt8">${esc(it.safety)}</div>` : ""}
      ${it.easier || it.harder ? `<details class="mt8"><summary>Más fácil / más difícil</summary>
        <div class="small">${it.easier ? `<b>Más fácil:</b> ${esc(it.easier)}<br>` : ""}${it.harder ? `<b>Más difícil:</b> ${esc(it.harder)}` : ""}</div></details>` : ""}
    </div>
    <div class="bottom"><div class="inner">
      <button class="btn primary" id="done">✓ Terminé la serie</button>
      <button class="btn ghost" id="skip" style="padding:10px;font-size:13px;color:var(--muted)">Saltar esta serie</button>
    </div></div>`;
    bindHeader(); bindZoom();
    $app.querySelectorAll("[data-kg]").forEach(b => b.onclick = () => {
      const v = Math.max(0, Math.round(((S.loads[it.id] || 0) + (+b.dataset.kg)) * 2) / 2);
      S.loads[it.id] = v; save(); document.getElementById("kgv").textContent = v + " kg";
    });
    let holdStart = null, holdVal = 0, beepedMin = false, beepedMax = false;
    const hb = document.getElementById("holdbtn");
    if (hb) hb.onclick = () => {
      if (!holdStart) { holdStart = Date.now(); beepedMin = beepedMax = false; hb.textContent = "Detener"; beep(660, .12); }
      else { holdVal = Math.round((Date.now() - holdStart) / 1000); holdStart = null; hb.textContent = "Reiniciar"; beep(990, .2); }
    };
    document.getElementById("done").onclick = () => {
      if (holdStart) holdVal = Math.round((Date.now() - holdStart) / 1000);
      openRest(st, it.type === "time" ? (holdVal || it.range[0]) : defaultReps(st));
    };
    document.getElementById("skip").onclick = advance;
    startTick(() => {
      tickClock();
      const el = document.getElementById("hold"); if (!el) return;
      if (holdStart) {
        const e = Math.floor((Date.now() - holdStart) / 1000);
        el.textContent = e;
        el.style.color = e >= it.range[1] ? "var(--warn)" : e >= it.range[0] ? "var(--accent)" : "";
        if (e >= it.range[0] && !beepedMin) { beepedMin = true; beep(880, .15); setTimeout(() => beep(880, .15), 220); buzz(150); }
        if (e >= it.range[1] && !beepedMax) { beepedMax = true; beep(1175, .4); buzz([200, 100, 200]); }
      } else if (holdVal) el.textContent = holdVal;
    });
  }
  function defaultReps(st) {
    const it = st.item, td = A().sets.filter(s => s.ex === it.id);
    if (td.length) return td[td.length - 1].val;
    const l = lastSetsFor(it.id);
    if (l) { const s = l.sets.find(x => x.round === st.round) || l.sets[l.sets.length - 1]; return s.val; }
    return it.range[0];
  }

  function openRest(st, guess) {
    A().rest = { st, val: guess, rir: null, endAt: Date.now() + st.rest * 1000, total: st.rest, alarm: false, beeped: {} };
    save(); render();
  }
  function recordRest(r) {
    const it = r.st.item;
    A().sets.push({ ex: it.id, name: it.name, round: r.st.round, val: r.val, rir: r.rir, kg: it.load ? (S.loads[it.id] || 0) : 0 });
  }
  function renderRest() {
    const a = A(), r = a.rest, st = r.st, it = st.item, next = a.steps[a.i + 1];
    let nextHtml;
    if (next && next.k === "set") {
      const nx = next.item;
      nextHtml = `<div class="nextup">${nx.img ? `<img src="${img(nx.img, 0)}" alt="">` : ""}<div><div class="tiny muted">Siguiente</div><b>${esc(nx.name)}</b><div class="small muted">Serie ${next.round}/${next.rounds} · ${rangeTxt(nx)}</div></div></div>`;
    } else if (next && next.k === "f37") nextHtml = `<div><div class="tiny muted">Siguiente</div><b>Final 3/7 · ${esc(next.item.name)}</b></div>`;
    else nextHtml = `<div><div class="tiny muted">Siguiente</div><b>Vuelta a la calma</b></div>`;
    const unit = it.type === "time" ? "segundos" : it.perLeg ? "reps por pierna" : "repeticiones";
    const inc = it.type === "time" ? 5 : 1;
    $app.innerHTML = `<div class="rest" id="restbg"><div class="wrap">
      <div class="row between"><span class="pill">Descanso</span><span class="small muted">${esc(st.label)} · serie ${st.round}/${st.rounds}</span></div>
      <div class="ring"><svg viewBox="0 0 100 100"><circle cx="50" cy="50" r="44" stroke="#1a2333" stroke-width="8" fill="none"/>
        <circle id="arc" cx="50" cy="50" r="44" stroke="var(--accent)" stroke-width="8" stroke-linecap="round" fill="none" stroke-dasharray="276.5" stroke-dashoffset="0"/></svg>
        <div class="num"><div><b id="secs">${r.total}</b><span>SEGUNDOS</span></div></div></div>
      <div class="row" style="justify-content:center;gap:8px" id="adj"><button class="btn sm" data-adj="-15">−15 s</button><button class="btn sm" data-adj="15">+15 s</button></div>
      <div class="card mt16">
        <b>¿Cuánto hiciste en ${esc(it.name)}?</b>
        <div class="small muted">Objetivo: ${rangeTxt(it)}</div>
        <div class="stepper mt12"><button data-v="-${inc}">−</button><div class="val" id="val">${r.val}<small>${unit}</small></div><button data-v="${inc}">+</button></div>
        <div class="small muted mt12">¿Cuántas te quedaban en reserva? (RIR)</div>
        <div class="seg mt8">${[0, 1, 2, 3].map(n => `<button data-rir="${n}" class="${r.rir === n ? "on" : ""}">${n === 3 ? "3+" : n}</button>`).join("")}</div>
      </div>
      <div class="card mt12">${nextHtml}</div>
    </div>
    <div class="bottom"><div class="inner"><button class="btn primary" id="go">Guardar y seguir ➔</button></div></div></div>`;
    $app.querySelectorAll("[data-v]").forEach(b => b.onclick = () => {
      r.val = Math.max(0, r.val + (+b.dataset.v)); save(); document.getElementById("val").firstChild.nodeValue = r.val;
    });
    $app.querySelectorAll("[data-rir]").forEach(b => b.onclick = () => {
      r.rir = +b.dataset.rir; save();
      $app.querySelectorAll("[data-rir]").forEach(x => x.classList.toggle("on", +x.dataset.rir === r.rir));
    });
    $app.querySelectorAll("[data-adj]").forEach(b => b.onclick = () => {
      r.endAt += (+b.dataset.adj) * 1000; r.total = Math.max(r.total, Math.ceil((r.endAt - Date.now()) / 1000)); save();
    });
    document.getElementById("go").onclick = () => { recordRest(r); a.rest = null; stopAlarm(); advance(); };
    startTick(() => {
      const left = Math.ceil((r.endAt - Date.now()) / 1000);
      const sEl = document.getElementById("secs"), arc = document.getElementById("arc");
      if (!sEl) return;
      sEl.textContent = Math.max(0, left);
      arc.style.strokeDashoffset = 276.5 * (1 - Math.max(0, left) / Math.max(1, r.total));
      if (left <= 3 && left > 0 && !r.beeped[left]) { r.beeped[left] = 1; beep(660, .12, .25); }
      if (left <= 0 && !r.alarm) { r.alarm = true; startAlarm(); }
    });
  }
  let alarmT = null;
  function startAlarm() {
    const bg = document.getElementById("restbg"); if (bg) bg.classList.add("alarm");
    const go = document.getElementById("go"); if (go) { go.textContent = "⏰ ¡A la siguiente serie! Guardar ➔"; go.classList.add("danger"); go.classList.remove("primary"); }
    const adj = document.getElementById("adj"); if (adj) adj.classList.add("hidden");
    let n = 0;
    const ring = () => { beep(880, .25); setTimeout(() => beep(1175, .25), 280); buzz([300, 120, 300]); if (++n > 25) stopAlarm(); };
    ring(); alarmT = setInterval(ring, 1100);
  }
  function stopAlarm() { if (alarmT) clearInterval(alarmT); alarmT = null; }

  function render37() {
    const st = step(), it = st.item, a = A();
    if (!a.f) { a.f = { idx: 0, phase: "work", endAt: 0, done: [] }; save(); }
    const f = a.f, reps = [3, 4, 5, 6, 7], prev = f37Last(it.id);
    const finished = f.idx >= 5, resting = f.phase === "rest" && !finished;
    $app.innerHTML = `<div class="wrap">${sessionHeader("Final 3/7")}
      <h2 class="mt16">${esc(it.name)}</h2>
      <div class="small muted">5 mini-series de 3, 4, 5, 6 y 7 reps con solo 15 s entre ellas. Elige una variante con la que harías ~12–15 reps seguidas.</div>
      ${it.img ? `<div class="photos mt12">
        <div class="photo" data-zoom="${img(it.img, 0)}"><img src="${img(it.img, 0)}" alt=""><span class="lab">1 · INICIO</span></div>
        <div class="photo" data-zoom="${img(it.img, 1)}"><img src="${img(it.img, 1)}" alt=""><span class="lab">2 · FINAL</span></div></div>` : ""}
      <div class="mini mt16">${reps.map((n, i) => `<div class="${i < f.idx ? "done" : i === f.idx ? "now" : ""}">${n}</div>`).join("")}</div>
      <div class="card mt12" style="text-align:center">
        ${finished ? `<b>¡Bloque 3/7 completo!</b><div class="small muted">Si no completaste alguna mini-serie, corrígela abajo.</div>`
        : resting ? `<div class="tiny muted">Descanso</div><div id="f37t" style="font-size:56px;font-weight:900;font-variant-numeric:tabular-nums">15</div><div class="small muted">Siguiente: ${reps[f.idx]} reps</div>`
        : `<div class="tiny muted">Ahora</div><div style="font-size:56px;font-weight:900">${reps[f.idx]} reps</div>`}
      </div>
      ${finished ? `<div class="card mt12"><div class="small muted">Reps logradas en cada mini-serie</div>
        <div class="mini mt8">${reps.map((n, i) => `<div style="padding:0"><button data-fv="${i}" style="width:100%;padding:12px 0;font-weight:900;font-size:20px">${f.done[i] == null ? n : f.done[i]}</button></div>`).join("")}</div>
        <div class="small muted mt8">Toca un número para bajarlo en 1 si no lo completaste.</div></div>` : ""}
      ${prev ? `<div class="card mt12 small"><span class="muted">La vez pasada · </span><b>${prev.done.join("-")}</b>${prev.done.every((v, i) => v >= reps[i]) ? ' <span style="color:var(--accent)">▲ completo: hoy usa una variante más difícil</span>' : ""}</div>` : ""}
      ${it.tips ? `<div class="hint mt12">${esc(it.tips)}</div>` : ""}
      ${it.safety ? `<div class="hint warn mt8">${esc(it.safety)}</div>` : ""}
    </div>
    <div class="bottom"><div class="inner">
      ${finished ? `<button class="btn primary" id="f37save">Guardar y seguir ➔</button>`
        : resting ? `<button class="btn" id="f37skip">Saltar descanso</button>`
        : `<button class="btn primary" id="f37done">✓ Hice ${reps[f.idx]} reps</button>`}
      ${!finished ? `<button class="btn ghost" id="f37stop" style="padding:10px;font-size:13px;color:var(--muted)">No pude más: terminar el bloque aquí</button>` : ""}
    </div></div>`;
    bindHeader(); bindZoom();
    const go = () => { f.phase = "work"; save(); render37(); };
    const dn = document.getElementById("f37done");
    if (dn) dn.onclick = () => { f.done[f.idx] = reps[f.idx]; f.idx++; if (f.idx < 5) { f.phase = "rest"; f.endAt = Date.now() + 15000; } save(); render37(); };
    const sk = document.getElementById("f37skip"); if (sk) sk.onclick = go;
    const stop = document.getElementById("f37stop");
    if (stop) stop.onclick = () => { for (let i = f.idx; i < 5; i++) f.done[i] = 0; f.idx = 5; save(); render37(); };
    $app.querySelectorAll("[data-fv]").forEach(b => b.onclick = () => {
      const i = +b.dataset.fv, cur = f.done[i] == null ? reps[i] : f.done[i];
      f.done[i] = cur <= 0 ? reps[i] : cur - 1; save(); render37();
    });
    const sv = document.getElementById("f37save");
    if (sv) sv.onclick = () => { a.finisher = { ex: it.id, name: it.name, done: reps.map((n, i) => f.done[i] == null ? n : f.done[i]) }; a.f = null; advance(); };
    startTick(() => {
      tickClock();
      if (f.phase === "rest" && f.idx < 5) {
        const left = Math.ceil((f.endAt - Date.now()) / 1000), el = document.getElementById("f37t");
        if (el) el.textContent = Math.max(0, left);
        if (left <= 3 && left > 0 && f._b !== left) { f._b = left; beep(660, .1, .25); }
        if (left <= 0) { beep(1175, .3); buzz(300); go(); }
      }
    });
  }

  function renderCooldown() {
    const a = A();
    const needPain = a.elbowPhase;
    $app.innerHTML = `<div class="wrap">${sessionHeader("Vuelta a la calma")}
      <h2 class="mt16">Vuelta a la calma · 2 min</h2>
      <p class="small muted">Respira lento por la nariz. Los estiramientos son suaves y sin dolor.</p>
      ${a.cooldown.map(c => `<div class="wu">${c.img ? `<img src="${img(c.img, 1)}" alt="">` : `<div class="ph"></div>`}<b class="grow" style="font-size:14px">${esc(c.name)}</b></div>`).join("")}
      ${needPain ? `<div class="card mt16"><b>Molestia máxima en el codo durante la sesión</b><div class="small muted">0 = nada, 10 = dolor máximo</div>${painGrid("post", a.elbowPost)}
        ${a.elbowPost != null && a.elbowPost >= 3 ? `<div class="hint warn mt8">Pasó de 2/10. Si mañana el codo amanece peor, la app te va a recomendar volver a la fase anterior.</div>` : ""}</div>` : ""}
      <div class="hint mt16">Toma tu whey (30 g) con la creatina al terminar.</div>
    </div>
    <div class="bottom"><div class="inner"><button class="btn primary" id="next" ${needPain && a.elbowPost == null ? "disabled" : ""}>${needPain && a.elbowPost == null ? "Indica la molestia del codo para terminar" : "Terminar entrenamiento ✓"}</button></div></div>`;
    bindHeader();
    $app.querySelectorAll("[data-post]").forEach(b => b.onclick = () => { a.elbowPost = +b.dataset.post; save(); renderCooldown(); });
    document.getElementById("next").onclick = () => { if (needPain && a.elbowPost == null) return; finishSession(false); };
    startTick(tickClock);
  }

  function finishSession(early) {
    const a = A();
    stopAlarm(); keepAwake(false);
    if (a.rest) recordRest(a.rest);
    const dur = Math.round((Date.now() - a.start) / 1000);
    let saved = null;
    if (a.sets.length || a.finisher) {
      saved = {
        date: new Date(a.start).toISOString(), phase: a.phase, phaseName: a.phaseName, session: a.session, sessionName: a.sessionName,
        upper: a.upper, dur, deload: a.deload, early: !!early, sets: a.sets, finisher: a.finisher,
        elbowPre: a.elbowPre, elbowFeel: a.elbowFeel, elbowPost: a.elbowPost
      };
      S.sessions.push(saved);
      const ph = P().phases.find(p => p.code === a.phase);
      if (ph) { const i = ph.sessions.findIndex(s => s.code === a.session); if (i >= 0) S.rot[ph.code] = (i + 1) % ph.sessions.length; }
      if (a.deload) S.settings.deload = false;
    }
    S.active = null; save();
    if (saved) renderSummary(saved); else render();
  }

  function groupSets(sets) { const o = {}; sets.forEach(x => { (o[x.ex] = o[x.ex] || []).push(x); }); return o; }
  function nameOf(id, sets) { const f = findItem(id); return (sets && sets[0] && sets[0].name) || (f && f.item.name) || id; }
  function rangeOf(id) { const f = findItem(id); return f ? rangeTxt(f.item) : ""; }

  function renderSummary(s) {
    const byEx = groupSets(s.sets);
    const ups = Object.keys(byEx).filter(readyToProgress);
    const nextS = defaultSession();
    $app.innerHTML = `<div class="wrap">
      <div class="tiny muted mt16">Sesión guardada</div>
      <h1 class="mt8">¡${esc(s.sessionName)} listo!</h1>
      <p class="muted">${fmtTime(s.dur)} de entrenamiento · ${s.sets.length} series registradas${s.elbowPost != null ? ` · codo ${s.elbowPost}/10` : ""}</p>
      ${ups.length ? `<div class="hint">▲ Para la próxima, sube la dificultad en: <b>${ups.map(id => esc(nameOf(id, byEx[id]))).join(", ")}</b></div>` : ""}
      <div class="card mt12"><table class="tbl">${Object.keys(byEx).map(id => {
        const sets = byEx[id];
        return `<tr><td><b>${esc(nameOf(id, sets))}</b><div class="small muted">${rangeOf(id)}${sets[0].kg ? " · " + sets[0].kg + " kg" : ""}</div></td><td class="hist-set">${sets.map(x => x.val).join(" · ")}</td></tr>`;
      }).join("")}${s.finisher ? `<tr><td><b>3/7 · ${esc(s.finisher.name || nameOf(s.finisher.ex))}</b></td><td>${s.finisher.done.join("-")}</td></tr>` : ""}</table></div>
      <div class="card mt12 small"><b>Ahora:</b> ducha y al trabajo. Próximo entrenamiento sugerido: ${esc(nextS.name)}.</div>
    </div>
    <div class="bottom"><div class="inner"><button class="btn primary" id="close">Cerrar</button></div></div>`;
    document.getElementById("close").onclick = () => { tab = "home"; render(); };
  }

  // ---------- Registro ----------
  let histRange = 7;
  function renderHistory() {
    const since = histRange ? Date.now() - histRange * 864e5 : 0;
    const list = S.sessions.filter(s => new Date(s.date).getTime() >= since).slice().reverse();
    const ids = []; S.sessions.forEach(s => s.sets.forEach(x => { if (!ids.includes(x.ex)) ids.push(x.ex); }));
    const progress = ids.map(id => {
      const hist = [];
      let nm = id;
      S.sessions.forEach(s => { const sets = s.sets.filter(x => x.ex === id); if (sets.length) { hist.push({ d: s.date, sets }); nm = sets[0].name || nm; } });
      return `<tr><td><b>${esc(nm)}</b>${readyToProgress(id) ? ' <span style="color:var(--accent)">▲</span>' : ""}
        <div class="small muted">${hist.slice(-4).map(h => `${fmtDate(h.d)}: ${h.sets.map(x => x.val).join(",")}${h.sets[0].kg ? " (" + h.sets[0].kg + "kg)" : ""}`).join("<br>")}</div></td>
        <td>${sparkline(hist.map(h => h.sets.reduce((t, x) => t + x.val, 0)))}</td></tr>`;
    }).join("");
    const elbowHist = S.sessions.filter(s => s.elbowPost != null || s.elbowPre != null).slice(-12);
    $app.innerHTML = `<div class="wrap">
      <div class="tiny muted">Registro</div><h1 class="mt8">Tu progreso</h1>
      <div class="card mt16">
        <h3>Resumen para enviarle a Claude</h3>
        <p class="small muted">Copia el resumen y pégalo en el chat cada semana para ajustar la rutina.</p>
        <div class="seg" style="grid-template-columns:repeat(3,1fr)">${[[7, "7 días"], [14, "14 días"], [0, "Todo"]].map(([v, l]) => `<button data-range="${v}" class="${histRange === v ? "on" : ""}">${l}</button>`).join("")}</div>
        <button class="btn primary mt12" id="copy">Copiar resumen</button>
      </div>
      ${elbowHist.length ? `<div class="card"><h3>Molestia del codo</h3><p class="small muted">Durante cada sesión (0–10). La línea punteada marca el límite de 2/10.</p>
        ${elbowChart(elbowHist)}</div>` : ""}
      <div class="card"><h3>Progreso por ejercicio</h3>
        <p class="small muted">Últimas 4 sesiones · ▲ = listo para subir dificultad · la línea muestra el total de reps por sesión.</p>
        ${progress ? `<table class="tbl">${progress}</table>` : `<p class="small muted">Aún no hay series registradas.</p>`}</div>
      <div class="card"><h3>Sesiones${histRange ? ` · últimos ${histRange} días` : ""}</h3>
        ${list.length ? list.map(sessionCard).join("") : `<p class="small muted">No hay sesiones en este período.</p>`}</div>
    </div>${tabsHtml()}`;
    bindTabs();
    $app.querySelectorAll("[data-range]").forEach(b => b.onclick = () => { histRange = +b.dataset.range; renderHistory(); });
    document.getElementById("copy").onclick = () => copyText(weeklyReport(histRange), "Resumen copiado. Pégalo en el chat con Claude.");
  }
  function elbowChart(list) {
    const w = 300, h = 90, pad = 14, n = list.length;
    const x = i => pad + (n === 1 ? (w - 2 * pad) / 2 : i * (w - 2 * pad) / (n - 1));
    const y = v => h - pad - (v / 10) * (h - 2 * pad);
    const vals = list.map(s => s.elbowPost != null ? s.elbowPost : s.elbowPre);
    const pts = vals.map((v, i) => `${x(i)},${y(v)}`).join(" ");
    return `<svg viewBox="0 0 ${w} ${h}" width="100%" style="display:block">
      <line x1="${pad}" x2="${w - pad}" y1="${y(2)}" y2="${y(2)}" stroke="var(--warn)" stroke-dasharray="4 4" stroke-width="1"/>
      <polyline points="${pts}" fill="none" stroke="var(--accent)" stroke-width="2.5" stroke-linejoin="round"/>
      ${vals.map((v, i) => `<circle cx="${x(i)}" cy="${y(v)}" r="3.5" fill="${v > 2 ? "var(--warn)" : "var(--accent)"}"/><text x="${x(i)}" y="${y(v) - 7}" fill="var(--muted)" font-size="9" text-anchor="middle">${v}</text>`).join("")}
    </svg><div class="row between small muted"><span>${fmtDate(list[0].date)}</span><span>${fmtDate(list[n - 1].date)}</span></div>`;
  }
  function elbowLine(s) {
    if (s.elbowPre == null && s.elbowPost == null) return "";
    return `Codo: antes ${s.elbowPre != null ? s.elbowPre + "/10" : "-"}${s.elbowFeel ? ` (amaneció ${s.elbowFeel})` : ""}, durante ${s.elbowPost != null ? s.elbowPost + "/10" : "-"}`;
  }
  function sessionCard(s) {
    const byEx = groupSets(s.sets);
    return `<details class="mt8"><summary>${fmtDate(s.date)} · ${esc(s.sessionName)} · ${Math.round(s.dur / 60)} min${s.deload ? " · descarga" : ""}${s.early ? " · incompleta" : ""}</summary>
      <div class="small muted">${esc(s.phaseName || "")}${elbowLine(s) ? " · " + esc(elbowLine(s)) : ""}</div>
      <table class="tbl">${Object.keys(byEx).map(id => `<tr><td>${esc(nameOf(id, byEx[id]))}${byEx[id][0].kg ? ` <span class="muted">(${byEx[id][0].kg} kg)</span>` : ""}</td>
        <td>${byEx[id].map(x => x.val + (x.rir != null ? `<span class="muted">@${x.rir}</span>` : "")).join(" · ")}</td></tr>`).join("")}
      ${s.finisher ? `<tr><td>3/7 · ${esc(s.finisher.name || nameOf(s.finisher.ex))}</td><td>${s.finisher.done.join("-")}</td></tr>` : ""}</table></details>`;
  }
  function sparkline(vals) {
    if (vals.length < 2) return "";
    const w = 70, h = 26, v8 = vals.slice(-8), mn = Math.min(...v8), mx = Math.max(...v8), span = mx - mn || 1;
    const pts = v8.map((v, i) => `${(i / (v8.length - 1)) * w},${h - 3 - ((v - mn) / span) * (h - 6)}`).join(" ");
    return `<svg width="${w}" height="${h}" viewBox="0 0 ${w} ${h}"><polyline points="${pts}" fill="none" stroke="var(--accent)" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/></svg>`;
  }
  function weeklyReport(days) {
    const since = days ? Date.now() - days * 864e5 : 0;
    const list = S.sessions.filter(s => new Date(s.date).getTime() >= since);
    const ph = phase();
    let t = `REGISTRO CALISTENIA 45 · ${P().name}\nFase actual: ${ph.name} (día ${phaseDay()}${ph.days ? " de " + ph.days : ""})${ph.elbow ? ` · día ${rehabDay()} de la recuperación` : ""}\n`;
    if (!list.length) return t + "No hay sesiones en este período.";
    const d0 = new Date(list[0].date), d1 = new Date(list[list.length - 1].date);
    t += `Período: ${d0.getDate()}/${d0.getMonth() + 1} al ${d1.getDate()}/${d1.getMonth() + 1} · ${list.length} sesiones\nFormato: reps (o segundos) por serie, @RIR, kg de mochila\n`;
    list.forEach(s => {
      t += `\n${fmtDate(s.date)} · ${s.phaseName ? s.phaseName + " · " : ""}${s.sessionName} · ${Math.round(s.dur / 60)} min${s.deload ? " · DESCARGA" : ""}${s.early ? " · INCOMPLETA" : ""}\n`;
      if (elbowLine(s)) t += `${elbowLine(s)}\n`;
      const byEx = groupSets(s.sets);
      Object.keys(byEx).forEach(id => {
        const sets = byEx[id];
        t += `- ${nameOf(id, sets)}${rangeOf(id) ? ` [objetivo ${rangeOf(id)}]` : ""}${sets[0].kg ? ` (${sets[0].kg} kg)` : ""}: ${sets.map(x => x.val + (x.rir != null ? "@" + x.rir : "")).join(", ")}\n`;
      });
      if (s.finisher) t += `- 3/7 ${s.finisher.name || nameOf(s.finisher.ex)}: ${s.finisher.done.join("-")} (objetivo 3-4-5-6-7)\n`;
    });
    return t;
  }
  function copyText(text, msg) {
    const fallback = () => {
      const ta = document.createElement("textarea"); ta.value = text; ta.style.position = "fixed"; ta.style.opacity = "0";
      document.body.appendChild(ta); ta.select();
      try { document.execCommand("copy"); toast(msg); } catch (e) { showText(text); }
      ta.remove();
    };
    if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(text).then(() => toast(msg), fallback);
    else fallback();
  }
  function showText(text) {
    const box = modal(`<textarea readonly>${esc(text)}</textarea><button class="btn mt12">Cerrar</button>`);
    box.querySelector("button").onclick = () => box.remove();
  }

  // ---------- Ajustes ----------
  function renderSettings() {
    const st = S.settings, ph = phase();
    const tg = (k, on) => `<button class="toggle ${on ? "on" : ""}" data-tg="${k}" aria-label="${k}"></button>`;
    $app.innerHTML = `<div class="wrap">
      <div class="tiny muted">Ajustes</div><h1 class="mt8">Ajustes</h1>
      <div class="card mt16">
        <h3>Rutina</h3>
        <p class="small muted" style="margin:4px 0 10px">${esc(P().name)}${S.program ? " · cargada desde Excel" : " · incluida en la app"} · ${P().phases.length} fases</p>
        <div class="switch"><div><b>Fase actual</b><div class="small muted">${esc(ph.name)} · desde ${fmtYmd(S.phase.start)}</div></div><button class="btn sm" id="chPhase">Cambiar</button></div>
        <div class="switch"><div><b>Día 1 de la recuperación</b><div class="small muted">Para contar los días de la lesión</div></div>
          <input type="date" id="rehab" value="${esc(S.phase.rehabStart || S.phase.start)}" max="${today()}"></div>
        <button class="btn primary mt12" id="import">Cargar rutina desde Excel</button>
        <input type="file" id="file" class="hidden">
        ${S.program ? `<button class="btn mt8" id="builtin">Volver a la rutina incluida en la app</button>` : ""}
        <p class="small muted mt8" style="margin-bottom:0">El archivo debe tener el formato de la plantilla (hojas Fases, Sesiones, Ejercicios y Calentamiento). Tu registro no se borra.</p>
      </div>
      <div class="card">
        <div class="switch"><div><b>Sonido de alarma</b><div class="small muted">Pitidos al terminar el descanso</div></div>${tg("sound", st.sound)}</div>
        <div class="switch"><div><b>Vibración</b></div>${tg("vibrate", st.vibrate)}</div>
        <div class="switch"><div><b>Semana de descarga</b><div class="small muted">Solo en fases sin fin. Mitad de series, sin 3/7, RIR 3–4. Se apaga sola tras 1 sesión.</div></div>${tg("deload", st.deload)}</div>
        <div class="switch"><div><b>Descarga cada</b><div class="small muted">Sesiones entre descargas</div></div>
          <div class="kg"><button data-de="-3">−</button><span>${st.deloadEvery}</span><button data-de="3">+</button></div></div>
        <button class="btn mt12" id="testsound">Probar alarma</button>
      </div>
      <div class="card">
        <h3>Respaldo de datos</h3>
        <p class="small muted">Tus datos viven solo en este teléfono. Copia el respaldo de vez en cuando y guárdalo.</p>
        <button class="btn" id="backup">Copiar respaldo</button>
        <button class="btn mt8" id="restore">Restaurar desde respaldo</button>
        <button class="btn mt8" id="csv">Copiar todas las series en CSV</button>
      </div>
      <div class="card"><h3>Zona peligrosa</h3><button class="btn mt8" id="wipe" style="color:var(--danger)">Borrar todo el registro</button></div>
      <p class="small muted mt16">Calistenia 45 · versión ${APP_VERSION}. Fotos de ejercicios: free-exercise-db (dominio público); algunas muestran la versión con máquina o barra.</p>
    </div>${tabsHtml()}`;
    bindTabs();
    $app.querySelectorAll("[data-tg]").forEach(b => b.onclick = () => { st[b.dataset.tg] = !st[b.dataset.tg]; save(); renderSettings(); });
    $app.querySelectorAll("[data-de]").forEach(b => b.onclick = () => { st.deloadEvery = Math.min(42, Math.max(9, st.deloadEvery + (+b.dataset.de))); save(); renderSettings(); });
    document.getElementById("testsound").onclick = () => { unlockAudio(); beep(880, .25); setTimeout(() => beep(1175, .25), 280); buzz([300, 120, 300]); };
    document.getElementById("rehab").onchange = e => { if (e.target.value) { S.phase.rehabStart = e.target.value; save(); toast("Fecha guardada"); } };
    document.getElementById("chPhase").onclick = () => choosePhase(P(), S.phase.idx, idx => { setPhase(idx); pickedSession = null; toast(`Ahora estás en la ${phase().name}`); renderSettings(); });
    const fileIn = document.getElementById("file");
    document.getElementById("import").onclick = () => fileIn.click();
    fileIn.onchange = () => { const f = fileIn.files && fileIn.files[0]; if (f) importFile(f); fileIn.value = ""; };
    const bi = document.getElementById("builtin");
    if (bi) bi.onclick = () => {
      if (!confirm("¿Volver a la rutina incluida en la app? Tu registro se mantiene.")) return;
      const code = phase().code; S.program = null;
      const idx = P().phases.findIndex(p => p.code === code);
      setPhase(idx >= 0 ? idx : 0, idx >= 0); renderSettings(); toast("Rutina incluida activada");
    };
    document.getElementById("backup").onclick = () => copyText(JSON.stringify({ app: "cal45", ...S, active: null }), "Respaldo copiado");
    document.getElementById("csv").onclick = () => {
      let csv = "fecha,fase,sesion,ejercicio,serie,valor,rir,kg,codo_antes,codo_durante\n";
      S.sessions.forEach(s => s.sets.forEach(x => csv += `${s.date.slice(0, 10)},${s.phase || ""},"${s.sessionName}","${x.name || x.ex}",${x.round},${x.val},${x.rir == null ? "" : x.rir},${x.kg || 0},${s.elbowPre == null ? "" : s.elbowPre},${s.elbowPost == null ? "" : s.elbowPost}\n`));
      copyText(csv, "CSV copiado");
    };
    document.getElementById("restore").onclick = () => {
      const box = modal(`<h3>Pega tu respaldo</h3><textarea class="mt8" id="rt"></textarea>
        <button class="btn primary mt12" id="rok">Restaurar</button><button class="btn mt8" id="rno">Cancelar</button>`);
      box.querySelector("#rno").onclick = () => box.remove();
      box.querySelector("#rok").onclick = () => {
        try {
          const d = JSON.parse(box.querySelector("#rt").value);
          if (!d || !Array.isArray(d.sessions)) throw 0;
          S = (!d.v || d.v < 2) ? migrate(d) : Object.assign(fresh(), d, { active: null });
          S.notice = null; save(); box.remove(); toast("Respaldo restaurado"); render();
        } catch (e) { toast("Ese texto no es un respaldo válido"); }
      };
    };
    document.getElementById("wipe").onclick = () => {
      if (confirm("¿Borrar TODO el registro? Esto no se puede deshacer.") && confirm("¿Seguro? Copia un respaldo antes si lo quieres conservar.")) {
        const keep = S.program; S = fresh(); S.program = keep; save(); toast("Registro borrado"); render();
      }
    };
  }

  function choosePhase(prog, current, onPick) {
    const box = modal(`<h3>Elige la fase</h3><p class="small muted">La fase elegida empieza a contar desde hoy.</p>
      ${prog.phases.map((p, i) => `<button class="opt ${i === current ? "on" : ""}" data-ph="${i}"><b>${esc(p.name)}</b>
        <span class="small muted">${p.days ? p.days + " días" : "Sin fin"} · ${p.sessions.length} sesiones</span></button>`).join("")}
      <button class="btn mt12" id="pcancel">Cancelar</button>`);
    box.querySelectorAll("[data-ph]").forEach(b => b.onclick = () => { box.remove(); onPick(+b.dataset.ph); });
    box.querySelector("#pcancel").onclick = () => box.remove();
  }

  function importFile(file) {
    if (!/\.xlsx$/i.test(file.name)) { toast("Elige un archivo Excel (.xlsx)"); return; }
    const rd = new FileReader();
    rd.onerror = () => toast("No pude leer el archivo");
    rd.onload = () => {
      const res = window.ProgramIO.parseWorkbook(new Uint8Array(rd.result));
      if (res.errors.length) {
        const box = modal(`<h3>El Excel tiene errores</h3><p class="small muted">Corrígelos y vuelve a cargarlo. La rutina actual no cambió.</p>
          <div class="errlist">${res.errors.slice(0, 30).map(e => `<div>• ${esc(e)}</div>`).join("")}${res.errors.length > 30 ? `<div>…y ${res.errors.length - 30} más</div>` : ""}</div>
          <button class="btn mt12" id="eok">Cerrar</button>`);
        box.querySelector("#eok").onclick = () => box.remove();
        return;
      }
      const prog = res.program;
      const curCode = phase().code;
      let pick = Math.max(0, prog.phases.findIndex(p => p.code === curCode));
      const draw = () => {
        box.querySelector(".sheet").innerHTML = `<h3>${esc(prog.name)}</h3>
          <p class="small muted">${prog.phases.length} fases · ${prog.phases.reduce((t, p) => t + p.sessions.length, 0)} sesiones · ${prog.phases.reduce((t, p) => t + p.sessions.reduce((u, s) => u + s.blocks.reduce((v, b) => v + b.items.length, 0), 0), 0)} ejercicios</p>
          ${res.warnings.length ? `<div class="hint warn small">${res.warnings.slice(0, 8).map(esc).join("<br>")}${res.warnings.length > 8 ? `<br>…y ${res.warnings.length - 8} avisos más` : ""}</div>` : ""}
          <div class="small muted mt12">¿En qué fase quieres quedar?</div>
          ${prog.phases.map((p, i) => `<button class="opt ${i === pick ? "on" : ""}" data-ph="${i}"><b>${esc(p.name)}</b>
            <span class="small muted">${p.days ? p.days + " días" : "Sin fin"} · ${p.sessions.map(s => esc(s.name)).join(", ")}</span></button>`).join("")}
          <button class="btn primary mt12" id="iok">Usar esta rutina</button><button class="btn mt8" id="ino">Cancelar</button>`;
        box.querySelectorAll("[data-ph]").forEach(b => b.onclick = () => { pick = +b.dataset.ph; draw(); });
        box.querySelector("#ino").onclick = () => box.remove();
        box.querySelector("#iok").onclick = () => {
          const keep = prog.phases[pick].code === curCode;
          S.program = prog; S.rot = {};
          setPhase(pick, keep);
          box.remove(); pickedSession = null; toast("Rutina cargada"); tab = "home"; render(); window.scrollTo(0, 0);
        };
      };
      const box = modal("");
      draw();
    };
    rd.readAsArrayBuffer(file);
  }

  // ---------- Fotos ampliadas ----------
  function bindZoom() {
    $app.querySelectorAll("[data-zoom]").forEach(el => el.onclick = () => {
      const box = document.createElement("div");
      box.className = "lightbox"; box.innerHTML = `<img src="${el.dataset.zoom}" alt="">`;
      box.onclick = () => box.remove(); document.body.appendChild(box);
    });
  }

  // ---------- Reloj ----------
  let tickT = null;
  function startTick(fn) { stopTick(); fn(); tickT = setInterval(fn, 250); }
  function stopTick() { if (tickT) clearInterval(tickT); tickT = null; }
  function tickClock() {
    const el = document.getElementById("clock");
    if (el && S.active) { const e = (Date.now() - S.active.start) / 1000; el.textContent = fmtTime(e); el.style.color = e > 45 * 60 ? "var(--warn)" : ""; }
  }

  // Botón atrás de Android
  try {
    const CapApp = window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins.App;
    if (CapApp) CapApp.addListener("backButton", () => {
      const lb = document.querySelector(".lightbox"); if (lb) return lb.remove();
      if (S.active) { const b = document.getElementById("exit"); if (b) b.click(); return; }
      if (precheck) { precheck = null; render(); return; }
      if (tab !== "home") { tab = "home"; render(); return; }
      CapApp.minimizeApp();
    });
  } catch (e) {}

  window.__cal45 = { get S() { return S; }, P, phase, render };
  if (S.active) keepAwake(true);
  render();
})();
