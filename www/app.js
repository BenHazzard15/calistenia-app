/* Calistenia 45 — app de entrenamiento con registro de series. */
(function () {
  "use strict";

  // ---------- Estado persistente ----------
  const KEY = "cal45_v1";
  const DEFAULT = {
    v: 1,
    next: 0,               // índice en ROTATION
    sessions: [],          // sesiones terminadas
    loads: {},             // kg de mochila por ejercicio
    settings: { sound: true, vibrate: true, deloadEvery: 21, deload: false },
    active: null           // sesión en curso (para retomar)
  };
  let S = load();

  function load() {
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) return Object.assign({}, DEFAULT, JSON.parse(raw), { settings: Object.assign({}, DEFAULT.settings, JSON.parse(raw).settings || {}) });
    } catch (e) {}
    return JSON.parse(JSON.stringify(DEFAULT));
  }
  function save() { try { localStorage.setItem(KEY, JSON.stringify(S)); } catch (e) {} }

  // ---------- Utilidades ----------
  const $app = document.getElementById("app");
  const esc = s => String(s == null ? "" : s).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  const img = (name, j) => `img/${name}_${j}.jpg`;
  const fmtTime = s => { s = Math.max(0, Math.round(s)); return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`; };
  const DOW = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"];
  const fmtDate = iso => { const d = new Date(iso); return `${DOW[d.getDay()]} ${d.getDate()}/${d.getMonth() + 1}`; };
  const unitOf = ex => ex.type === "time" ? "s" : (ex.perLeg ? "reps/pierna" : "reps");
  const rangeTxt = ex => `${ex.range[0]}–${ex.range[1]} ${ex.type === "time" ? "s" : "reps"}${ex.perLeg ? " por lado" : ""}`;

  function toast(msg) {
    const t = document.getElementById("toast");
    t.textContent = msg; t.classList.remove("hidden");
    clearTimeout(toast._t); toast._t = setTimeout(() => t.classList.add("hidden"), 2200);
  }

  // ---------- Sonido, vibración y pantalla encendida ----------
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
      o.connect(g); g.connect(audio.destination);
      o.start(); o.stop(audio.currentTime + dur);
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

  // ---------- Historial y progresión ----------
  function lastSetsFor(exId) {
    for (let i = S.sessions.length - 1; i >= 0; i--) {
      const sets = S.sessions[i].sets.filter(x => x.ex === exId);
      if (sets.length) return { session: S.sessions[i], sets };
    }
    return null;
  }
  function readyToProgress(exId) {
    const ex = EXERCISES[exId];
    const last = lastSetsFor(exId);
    if (!last) return false;
    const block = findBlock(exId);
    if (!block || last.session.deload) return false;
    const full = last.sets.length >= block.rounds;
    return full && last.sets.every(s => (s.val >= ex.range[1]) && (s.rir == null || s.rir >= 1));
  }
  function findBlock(exId) {
    for (const k of ROTATION) for (const b of DAYS[k].blocks) if (b.type === "ss" && b.items.includes(exId)) return b;
    return null;
  }
  function lastTxt(exId) {
    const l = lastSetsFor(exId);
    if (!l) return null;
    const vals = l.sets.map(s => s.val).join(", ");
    const kg = l.sets[0].kg ? ` · ${l.sets[0].kg} kg` : "";
    return `${fmtDate(l.session.date)}: ${vals}${kg}`;
  }
  function f37Last(exId) {
    for (let i = S.sessions.length - 1; i >= 0; i--) {
      const f = S.sessions[i].finisher;
      if (f && f.ex === exId) return f;
    }
    return null;
  }

  // ---------- Construcción de la sesión ----------
  function buildSteps(dayKey, deload) {
    const day = DAYS[dayKey];
    const steps = [{ k: "warmup" }, { k: "approach" }];
    day.blocks.forEach((b, bi) => {
      if (b.type === "ss") {
        const rounds = deload ? Math.ceil(b.rounds / 2) : b.rounds;
        for (let r = 1; r <= rounds; r++) {
          b.items.forEach((exId, pos) => {
            steps.push({ k: "set", ex: exId, bi, label: b.label, round: r, rounds, rest: b.rest, pos, items: b.items });
          });
        }
      } else if (b.type === "37" && !deload) {
        steps.push({ k: "f37", ex: b.item, label: b.label });
      }
    });
    steps.push({ k: "cooldown" });
    // descanso de transición entre bloques
    for (let i = 0; i < steps.length - 1; i++) {
      const a = steps[i], b = steps[i + 1];
      if (a.k === "set" && b.k === "set" && a.bi !== b.bi) a.rest = 90;
      if (a.k === "set" && b.k !== "set") a.rest = 60;
    }
    return steps;
  }

  // ---------- Navegación ----------
  let tab = "home";
  let pickedDay = null;

  function render() {
    stopTick();
    if (S.active) return renderSession();
    if (tab === "home") renderHome();
    else if (tab === "history") renderHistory();
    else renderSettings();
  }

  const ICONS = {
    home: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 11l9-7 9 7v9a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z"/></svg>',
    history: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 19V9M10 19V5M16 19v-7M22 19H2"/></svg>',
    settings: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/></svg>'
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
    const dayKey = pickedDay || ROTATION[S.next % ROTATION.length];
    const day = DAYS[dayKey];
    const done = S.sessions.length;
    const every = S.settings.deloadEvery || 21;
    const inCycle = done % every;
    const deloadDue = done > 0 && inCycle === 0;
    const last = S.sessions[S.sessions.length - 1];
    const weekAgo = Date.now() - 7 * 864e5;
    const thisWeek = S.sessions.filter(s => new Date(s.date).getTime() > weekAgo).length;

    let list = "";
    day.blocks.forEach(b => {
      const items = b.type === "ss" ? b.items : [b.item];
      const rounds = b.type === "ss" ? (S.settings.deload ? Math.ceil(b.rounds / 2) : b.rounds) : null;
      if (b.type === "37" && S.settings.deload) return;
      list += `<div class="mt12 tiny muted">${esc(b.label)}${rounds ? ` · ${rounds} rondas` : " · 3-4-5-6-7"}</div>`;
      items.forEach(id => {
        const ex = EXERCISES[id];
        const up = readyToProgress(id);
        list += `<div class="exline"><img src="${img(ex.img, 1)}" alt=""><div class="meta"><b>${esc(ex.name)}</b>
          <span class="small muted">${b.type === "37" ? "3-4-5-6-7 reps, 15 s entre series" : rangeTxt(ex)}${S.loads[id] ? ` · ${S.loads[id]} kg` : ""}</span>
          ${up ? '<div class="small" style="color:var(--accent)">▲ Listo para subir dificultad</div>' : ""}</div></div>`;
      });
    });

    $app.innerHTML = `<div class="wrap">
      <div class="row between"><div><div class="tiny muted">Calistenia 45 · ayunas 6:00</div><h1 class="mt8">Hoy toca ${esc(day.title)}</h1></div>
      ${S.settings.deload ? '<span class="pill warn">Descarga</span>' : ""}</div>
      <p class="muted mt8" style="margin-bottom:0">${esc(day.focus)}</p>

      <div class="days mt16">${ROTATION.map(k => `<button data-day="${k}" class="${k === dayKey ? "on" : ""}">${k}<span class="s">${["Lunes", "Miércoles", "Viernes"][ROTATION.indexOf(k)]}</span></button>`).join("")}</div>

      <div class="card mt16">
        <div class="row between small"><span class="muted">Ciclo hasta la descarga</span><b>${inCycle} / ${every} sesiones</b></div>
        <div class="bar mt8"><div style="width:${(inCycle / every) * 100}%"></div></div>
        <div class="row between small mt8"><span class="muted">Esta semana: <b style="color:var(--text)">${thisWeek}</b> sesiones</span>
          <span class="muted">${last ? "Última: " + fmtDate(last.date) + " (" + last.day + ")" : "Aún sin sesiones"}</span></div>
        ${deloadDue && !S.settings.deload ? `<div class="hint warn mt12">Completaste ${every} sesiones. Toca una semana de descarga: la mitad de las series y lejos del fallo. Actívala en Ajustes.</div>` : ""}
      </div>

      <div class="card">${list}</div>
      ${S.sessions.length ? `<button class="btn ghost mt12" id="undo" style="font-size:13px;color:var(--muted)">Deshacer la última sesión registrada</button>` : ""}
    </div>
    <div class="bottom" style="bottom:62px"><div class="inner"><button class="btn primary" id="start">▶ Empezar ${esc(day.title)}</button></div></div>
    ${tabsHtml()}`;

    bindTabs();
    $app.querySelectorAll("[data-day]").forEach(b => b.onclick = () => { pickedDay = b.dataset.day; renderHome(); });
    document.getElementById("start").onclick = () => startSession(dayKey);
    const u = document.getElementById("undo");
    if (u) u.onclick = () => {
      if (!confirm("¿Borrar la última sesión registrada? Se pierden sus series.")) return;
      const s = S.sessions.pop();
      S.next = Math.max(0, ROTATION.indexOf(s.day));
      save(); pickedDay = null; renderHome(); toast("Sesión eliminada");
    };
  }

  // ---------- Sesión en curso ----------
  function startSession(dayKey) {
    unlockAudio();
    S.active = {
      day: dayKey, start: Date.now(), deload: !!S.settings.deload,
      steps: buildSteps(dayKey, S.settings.deload), i: 0,
      sets: [], finisher: null, warm: [], rest: null
    };
    pickedDay = null;
    save(); keepAwake(true); render(); window.scrollTo(0, 0);
  }

  function A() { return S.active; }
  function step() { return A().steps[A().i]; }

  function sessionHeader(title) {
    const a = A();
    const total = a.steps.length;
    return `<div class="topbar">
      <button class="btn sm" id="exit">✕ Salir</button>
      <div class="grow" style="text-align:center"><div class="tiny muted">${esc(title)}</div><div class="small muted">Paso ${a.i + 1} de ${total}</div></div>
      <div class="clock" id="clock">${fmtTime((Date.now() - a.start) / 1000)}</div>
    </div><div class="bar mt8"><div style="width:${((a.i + 1) / total) * 100}%"></div></div>`;
  }
  function bindHeader() {
    document.getElementById("exit").onclick = () => {
      const ans = confirm("¿Salir del entrenamiento?\n\nAceptar: guardar lo que llevas y terminar.\nCancelar: seguir entrenando.");
      if (ans) finishSession(true);
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

  // Calentamiento
  function renderWarmup() {
    const a = A();
    if (!a.warmStart) { a.warmStart = Date.now(); save(); }
    const doneCount = a.warm.length;
    const items = WARMUP.map((w, i) => `<div class="wu ${a.warm.includes(i) ? "done" : ""}" data-w="${i}">
        ${w.img ? `<img src="${img(w.img, 0)}" alt="">` : `<div class="ph"></div>`}
        <div class="grow"><b style="font-size:14px">${esc(w.name)}</b><div class="small muted">${w.dur >= 60 ? w.dur / 60 + " min" : w.dur + " s"}</div></div>
        <div class="chk">${a.warm.includes(i) ? "✓" : ""}</div></div>`).join("");
    $app.innerHTML = `<div class="wrap">${sessionHeader("Calentamiento")}
      <h2 class="mt16">Calentamiento · 7 min</h2>
      <p class="small muted">Movimiento continuo, sin estiramientos largos. Toca cada ítem al terminarlo.</p>
      <div class="card row between"><span class="muted small">Tiempo de calentamiento</span><b id="wclock" style="font-size:22px;font-variant-numeric:tabular-nums">0:00</b></div>
      ${items}
    </div>
    <div class="bottom"><div class="inner"><button class="btn primary" id="next">${doneCount === WARMUP.length ? "Listo, seguir ➔" : `Seguir (${doneCount}/${WARMUP.length})`}</button></div></div>`;
    bindHeader();
    $app.querySelectorAll("[data-w]").forEach(el => el.onclick = () => {
      const i = +el.dataset.w; const ix = a.warm.indexOf(i);
      ix >= 0 ? a.warm.splice(ix, 1) : a.warm.push(i); save(); renderWarmup();
    });
    document.getElementById("next").onclick = advance;
    startTick(() => {
      const e = (Date.now() - a.warmStart) / 1000;
      const el = document.getElementById("wclock"); if (el) { el.textContent = fmtTime(e); el.style.color = e > 420 ? "var(--warn)" : ""; }
      tickClock();
    });
  }

  // Aproximación
  function renderApproach() {
    const first = A().steps.find(s => s.k === "set");
    const ids = first.items;
    const exs = ids.map(id => EXERCISES[id]);
    $app.innerHTML = `<div class="wrap">${sessionHeader("Series de aproximación")}
      <h2 class="mt16">Aproximación · 2 min</h2>
      <p class="small muted">Una serie fácil de 5–6 reps de cada ejercicio de la Superserie 1, en versión asistida. No cuentan para el registro.</p>
      ${exs.map(ex => `<div class="card"><div class="row"><img src="${img(ex.img, 0)}" style="width:72px;height:54px;object-fit:cover;border-radius:10px" alt="">
        <div><b>${esc(ex.name)}</b><div class="small muted">5–6 reps fáciles · ${esc(ex.easier)}</div></div></div></div>`).join("")}
      <div class="hint mt16">Si hoy hay búlgara o sentadilla a una pierna, haz además 5 reps sin peso por pierna antes de la Superserie 2.</div>
    </div>
    <div class="bottom"><div class="inner"><button class="btn primary" id="next">Empezar Superserie 1 ➔</button></div></div>`;
    bindHeader();
    document.getElementById("next").onclick = advance;
    startTick(tickClock);
  }

  // Serie
  let timerRun = null; // cronómetro para ejercicios de tiempo
  function renderSet() {
    const st = step(), ex = EXERCISES[st.ex];
    const a = A();
    const kg = S.loads[st.ex] || 0;
    const prev = lastTxt(st.ex);
    const up = readyToProgress(st.ex);
    const dots = [];
    for (let r = 1; r <= st.rounds; r++) dots.push(`<i class="${r < st.round ? "done" : r === st.round ? "now" : ""}"></i>`);
    const todaySets = a.sets.filter(s => s.ex === st.ex).map(s => s.val);
    const code = String.fromCharCode(65 + st.bi) + (st.pos + 1);

    $app.innerHTML = `<div class="wrap">${sessionHeader(st.label)}
      <div class="row between mt16">
        <div class="grow"><span class="pill accent">${code}</span><h2 class="mt8">${esc(ex.name)}</h2><div class="small muted">${esc(ex.muscles)}</div></div>
        <div style="text-align:right"><div class="tiny muted">Serie</div><div style="font-size:26px;font-weight:900">${st.round}<span class="muted" style="font-size:16px">/${st.rounds}</span></div></div>
      </div>
      <div class="setdots mt8">${dots.join("")}</div>

      <div class="photos mt12">
        <div><div class="photo" data-zoom="${img(ex.img, 0)}"><img src="${img(ex.img, 0)}" alt=""><span class="lab">1 · INICIO</span></div><div class="photo-cap">${esc(ex.p1)}</div></div>
        <div><div class="photo" data-zoom="${img(ex.img, 1)}"><img src="${img(ex.img, 1)}" alt=""><span class="lab">2 · FINAL</span></div><div class="photo-cap">${esc(ex.p2)}</div></div>
      </div>

      <div class="stats mt12">
        <div class="stat"><div class="k">Objetivo</div><div class="v">${ex.range[0]}–${ex.range[1]} ${ex.type === "time" ? "s" : ""}</div><div class="small muted">${ex.perLeg ? "por lado" : ex.type === "time" ? "sostenido" : "reps"}</div></div>
        <div class="stat"><div class="k">Esfuerzo</div><div class="v">RIR 1–2</div><div class="small muted">${st.round === st.rounds ? "última: puede 0" : "1–2 en reserva"}</div></div>
        <div class="stat"><div class="k">Descanso</div><div class="v">${st.rest} s</div><div class="small muted">después</div></div>
      </div>

      ${up ? `<div class="hint mt12">▲ La vez pasada llegaste al tope en todas las series. Hoy sube la dificultad: ${esc(ex.harder)}</div>` : ""}
      ${prev ? `<div class="card mt12 small"><span class="muted">La vez pasada · </span><b>${esc(prev)}</b>${todaySets.length ? `<br><span class="muted">Hoy · </span><b>${todaySets.join(", ")}</b>` : ""}</div>` : todaySets.length ? `<div class="card mt12 small"><span class="muted">Hoy · </span><b>${todaySets.join(", ")}</b></div>` : ""}

      ${ex.load ? `<div class="card mt12 row between"><div><b style="font-size:14px">Peso en la mochila</b><div class="small muted">Se guarda para la próxima vez</div></div>
        <div class="kg"><button data-kg="-1">−</button><span id="kgv">${kg} kg</span><button data-kg="1">+</button></div></div>` : ""}

      ${ex.type === "time" ? `<div class="card mt12" style="text-align:center"><div class="tiny muted">Cronómetro</div><div id="hold" style="font-size:48px;font-weight:900;font-variant-numeric:tabular-nums">0</div>
        <button class="btn sm" id="holdbtn" style="margin:6px auto 0">Iniciar</button></div>` : ""}

      <div class="hint mt12">${esc(ex.tips)}</div>
      ${ex.safety ? `<div class="hint warn mt8">${esc(ex.safety)}</div>` : ""}
      <details class="mt8"><summary>Más fácil / más difícil</summary>
        <div class="small"><b>Más fácil:</b> ${esc(ex.easier)}<br><b>Más difícil:</b> ${esc(ex.harder)}</div></details>
    </div>
    <div class="bottom"><div class="inner">
      <button class="btn primary" id="done">✓ Terminé la serie</button>
      <button class="btn ghost" id="skip" style="padding:10px;font-size:13px;color:var(--muted)">Saltar esta serie</button>
    </div></div>`;
    bindHeader();
    bindZoom();
    $app.querySelectorAll("[data-kg]").forEach(b => b.onclick = () => {
      const v = Math.max(0, Math.round(((S.loads[st.ex] || 0) + (+b.dataset.kg)) * 2) / 2);
      S.loads[st.ex] = v; save(); document.getElementById("kgv").textContent = v + " kg";
    });
    let holdStart = null, holdVal = 0;
    const hb = document.getElementById("holdbtn");
    if (hb) hb.onclick = () => {
      if (!holdStart) { holdStart = Date.now(); hb.textContent = "Detener"; beep(660, .12); }
      else { holdVal = Math.round((Date.now() - holdStart) / 1000); holdStart = null; hb.textContent = "Reiniciar"; beep(990, .2); }
    };
    document.getElementById("done").onclick = () => {
      const guess = ex.type === "time" ? (holdVal || ex.range[0]) : defaultReps(st);
      openRest(st, guess);
    };
    document.getElementById("skip").onclick = advance;
    startTick(() => {
      tickClock();
      if (holdStart) { const el = document.getElementById("hold"); if (el) el.textContent = Math.floor((Date.now() - holdStart) / 1000); }
      else if (holdVal) { const el = document.getElementById("hold"); if (el) el.textContent = holdVal; }
    });
  }
  function defaultReps(st) {
    const ex = EXERCISES[st.ex];
    const today = A().sets.filter(s => s.ex === st.ex);
    if (today.length) return today[today.length - 1].val;
    const l = lastSetsFor(st.ex);
    if (l) { const s = l.sets.find(x => x.round === st.round) || l.sets[l.sets.length - 1]; return s.val; }
    return ex.range[0];
  }

  // Descanso + registro de la serie
  function openRest(st, guess) {
    const a = A();
    a.rest = { st, val: guess, rir: null, endAt: Date.now() + st.rest * 1000, total: st.rest, alarm: false, beeped: {} };
    save(); render();
  }
  function renderRest() {
    const a = A(), r = a.rest, st = r.st, ex = EXERCISES[st.ex];
    const next = a.steps[a.i + 1];
    let nextHtml = "";
    if (next && next.k === "set") {
      const nx = EXERCISES[next.ex];
      nextHtml = `<div class="nextup"><img src="${img(nx.img, 0)}" alt=""><div><div class="tiny muted">Siguiente</div><b>${esc(nx.name)}</b><div class="small muted">Serie ${next.round}/${next.rounds} · ${rangeTxt(nx)}</div></div></div>`;
    } else if (next && next.k === "f37") nextHtml = `<div><div class="tiny muted">Siguiente</div><b>Final 3/7 · ${esc(EXERCISES[next.ex].name)}</b></div>`;
    else nextHtml = `<div><div class="tiny muted">Siguiente</div><b>Vuelta a la calma</b></div>`;

    const unit = ex.type === "time" ? "segundos" : ex.perLeg ? "reps por pierna" : "repeticiones";
    const step1 = ex.type === "time" ? 5 : 1;
    $app.innerHTML = `<div class="rest" id="restbg"><div class="wrap">
      <div class="row between"><span class="pill">Descanso</span><span class="small muted">${esc(st.label)} · serie ${st.round}/${st.rounds}</span></div>
      <div class="ring"><svg viewBox="0 0 100 100"><circle cx="50" cy="50" r="44" stroke="#1a2333" stroke-width="8" fill="none"/>
        <circle id="arc" cx="50" cy="50" r="44" stroke="var(--accent)" stroke-width="8" stroke-linecap="round" fill="none" stroke-dasharray="276.5" stroke-dashoffset="0"/></svg>
        <div class="num"><div><b id="secs">${r.total}</b><span>SEGUNDOS</span></div></div></div>
      <div class="row" style="justify-content:center;gap:8px" id="adj">
        <button class="btn sm" data-adj="-15">−15 s</button><button class="btn sm" data-adj="15">+15 s</button></div>

      <div class="card mt16">
        <div class="row between"><b>¿Cuánto hiciste en ${esc(ex.name)}?</b></div>
        <div class="small muted">Objetivo: ${rangeTxt(ex)}</div>
        <div class="stepper mt12"><button data-v="-${step1}">−</button><div class="val" id="val">${r.val}<small>${unit}</small></div><button data-v="${step1}">+</button></div>
        <div class="small muted mt12">¿Cuántas te quedaban en reserva? (RIR)</div>
        <div class="seg mt8">${[0, 1, 2, 3].map(n => `<button data-rir="${n}" class="${r.rir === n ? "on" : ""}">${n === 3 ? "3+" : n}</button>`).join("")}</div>
      </div>
      <div class="card mt12">${nextHtml}</div>
    </div>
    <div class="bottom"><div class="inner">
      <button class="btn primary" id="go">Guardar y seguir ➔</button>
    </div></div></div>`;
    $app.querySelectorAll("[data-v]").forEach(b => b.onclick = () => {
      r.val = Math.max(0, r.val + (+b.dataset.v)); save();
      document.getElementById("val").firstChild.nodeValue = r.val;
    });
    $app.querySelectorAll("[data-rir]").forEach(b => b.onclick = () => {
      r.rir = +b.dataset.rir; save();
      $app.querySelectorAll("[data-rir]").forEach(x => x.classList.toggle("on", +x.dataset.rir === r.rir));
    });
    $app.querySelectorAll("[data-adj]").forEach(b => b.onclick = () => {
      r.endAt += (+b.dataset.adj) * 1000;
      r.total = Math.max(r.total, Math.ceil((r.endAt - Date.now()) / 1000)); save();
    });
    document.getElementById("go").onclick = () => {
      a.sets.push({ ex: st.ex, round: st.round, val: r.val, rir: r.rir, kg: ex.load ? (S.loads[st.ex] || 0) : 0 });
      a.rest = null; stopAlarm(); advance();
    };
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
    const ring = () => { beep(880, .25); setTimeout(() => beep(1175, .25), 280); buzz([300, 120, 300]); if (++n > 25) stopAlarm(false); };
    ring(); alarmT = setInterval(ring, 1100);
  }
  function stopAlarm() { if (alarmT) clearInterval(alarmT); alarmT = null; }

  // Bloque final 3/7
  function render37() {
    const st = step(), ex = EXERCISES[st.ex];
    const a = A();
    if (!a.f) { a.f = { idx: 0, phase: "work", endAt: 0, done: [] }; save(); }
    const f = a.f;
    const reps = [3, 4, 5, 6, 7];
    const prev = f37Last(st.ex);
    const mini = reps.map((n, i) => `<div class="${i < f.idx ? "done" : i === f.idx ? "now" : ""}">${n}</div>`).join("");
    const finished = f.idx >= 5;
    const resting = f.phase === "rest" && !finished;
    $app.innerHTML = `<div class="wrap">${sessionHeader("Final 3/7")}
      <h2 class="mt16">${esc(ex.name)}</h2>
      <div class="small muted">5 mini-series de 3, 4, 5, 6 y 7 reps con solo 15 s entre ellas. Elige una variante con la que harías ~12–15 reps seguidas.</div>
      <div class="photos mt12">
        <div class="photo" data-zoom="${img(ex.img, 0)}"><img src="${img(ex.img, 0)}" alt=""><span class="lab">1 · INICIO</span></div>
        <div class="photo" data-zoom="${img(ex.img, 1)}"><img src="${img(ex.img, 1)}" alt=""><span class="lab">2 · FINAL</span></div>
      </div>
      <div class="mini mt16">${mini}</div>
      <div class="card mt12" style="text-align:center">
        ${finished ? `<b>¡Bloque 3/7 completo!</b><div class="small muted">Si no completaste alguna mini-serie, corrígela abajo.</div>`
        : resting ? `<div class="tiny muted">Descanso</div><div id="f37t" style="font-size:56px;font-weight:900;font-variant-numeric:tabular-nums">15</div><div class="small muted">Siguiente: ${reps[f.idx]} reps</div>`
        : `<div class="tiny muted">Ahora</div><div style="font-size:56px;font-weight:900">${reps[f.idx]} reps</div>`}
      </div>
      ${finished ? `<div class="card mt12"><div class="small muted">Reps logradas en cada mini-serie</div>
        <div class="mini mt8">${reps.map((n, i) => `<div style="padding:0"><button data-fv="${i}" style="width:100%;padding:12px 0;font-weight:900;font-size:20px">${f.done[i] == null ? n : f.done[i]}</button></div>`).join("")}</div>
        <div class="small muted mt8">Toca un número para bajarlo en 1 si no lo completaste.</div></div>` : ""}
      ${prev ? `<div class="card mt12 small"><span class="muted">La vez pasada · </span><b>${prev.done.join("-")}</b>${prev.done.every((v, i) => v >= reps[i]) ? ' <span style="color:var(--accent)">▲ completo: hoy usa una variante más difícil</span>' : ""}</div>` : ""}
      <div class="hint mt12">${esc(ex.tips)}</div>
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
    if (dn) dn.onclick = () => {
      f.done[f.idx] = reps[f.idx]; f.idx++;
      if (f.idx < 5) { f.phase = "rest"; f.endAt = Date.now() + 15000; }
      save(); render37();
    };
    const sk = document.getElementById("f37skip"); if (sk) sk.onclick = go;
    const stop = document.getElementById("f37stop");
    if (stop) stop.onclick = () => { for (let i = f.idx; i < 5; i++) f.done[i] = 0; f.idx = 5; save(); render37(); };
    $app.querySelectorAll("[data-fv]").forEach(b => b.onclick = () => {
      const i = +b.dataset.fv; const cur = f.done[i] == null ? reps[i] : f.done[i];
      f.done[i] = cur <= 0 ? reps[i] : cur - 1; save(); render37();
    });
    const sv = document.getElementById("f37save");
    if (sv) sv.onclick = () => { a.finisher = { ex: st.ex, done: reps.map((n, i) => f.done[i] == null ? n : f.done[i]) }; a.f = null; advance(); };
    startTick(() => {
      tickClock();
      if (f.phase === "rest" && f.idx < 5) {
        const left = Math.ceil((f.endAt - Date.now()) / 1000);
        const el = document.getElementById("f37t"); if (el) el.textContent = Math.max(0, left);
        if (left <= 3 && left > 0 && f._b !== left) { f._b = left; beep(660, .1, .25); }
        if (left <= 0) { beep(1175, .3); buzz(300); go(); }
      }
    });
  }

  // Vuelta a la calma
  function renderCooldown() {
    $app.innerHTML = `<div class="wrap">${sessionHeader("Vuelta a la calma")}
      <h2 class="mt16">Vuelta a la calma · 2 min</h2>
      <p class="small muted">Respira lento por la nariz. Los estiramientos son opcionales: hazlos si quieres ganar flexibilidad.</p>
      ${COOLDOWN.map(c => `<div class="wu">${c.img ? `<img src="${img(c.img, 1)}" alt="">` : `<div class="ph"></div>`}<b class="grow" style="font-size:14px">${esc(c.name)}</b></div>`).join("")}
      <div class="hint mt16">Toma tu whey (30 g) con la creatina al terminar.</div>
    </div>
    <div class="bottom"><div class="inner"><button class="btn primary" id="next">Terminar entrenamiento ✓</button></div></div>`;
    bindHeader();
    document.getElementById("next").onclick = () => finishSession(false);
    startTick(tickClock);
  }

  function finishSession(early) {
    const a = A();
    stopAlarm(); keepAwake(false);
    if (a.rest) { // registrar la serie que estaba en descanso
      const r = a.rest, ex = EXERCISES[r.st.ex];
      a.sets.push({ ex: r.st.ex, round: r.st.round, val: r.val, rir: r.rir, kg: ex.load ? (S.loads[r.st.ex] || 0) : 0 });
    }
    const dur = Math.round((Date.now() - a.start) / 1000);
    if (a.sets.length || a.finisher) {
      S.sessions.push({ date: new Date(a.start).toISOString(), day: a.day, dur, deload: a.deload, early: !!early, sets: a.sets, finisher: a.finisher });
      S.next = (ROTATION.indexOf(a.day) + 1) % ROTATION.length;
      if (a.deload) S.settings.deload = false;
    }
    const saved = S.sessions[S.sessions.length - 1];
    S.active = null; save();
    if (saved && saved.date === new Date(a.start).toISOString()) renderSummary(saved);
    else render();
  }

  function renderSummary(s) {
    const byEx = groupSets(s.sets);
    const ups = Object.keys(byEx).filter(readyToProgress);
    $app.innerHTML = `<div class="wrap">
      <div class="tiny muted mt16">Sesión guardada</div>
      <h1 class="mt8">¡${esc(DAYS[s.day].title)} listo!</h1>
      <p class="muted">${fmtTime(s.dur)} de entrenamiento · ${s.sets.length} series registradas</p>
      ${ups.length ? `<div class="hint">▲ Para la próxima, sube la dificultad en: <b>${ups.map(id => esc(EXERCISES[id].name)).join(", ")}</b></div>` : ""}
      <div class="card mt12"><table class="tbl">${Object.keys(byEx).map(id => {
        const ex = EXERCISES[id], sets = byEx[id];
        return `<tr><td><b>${esc(ex.name)}</b><div class="small muted">${rangeTxt(ex)}${sets[0].kg ? " · " + sets[0].kg + " kg" : ""}</div></td><td class="hist-set">${sets.map(x => x.val).join(" · ")}</td></tr>`;
      }).join("")}${s.finisher ? `<tr><td><b>3/7 · ${esc(EXERCISES[s.finisher.ex].name)}</b></td><td>${s.finisher.done.join("-")}</td></tr>` : ""}</table></div>
      <div class="card mt12 small"><b>Ahora:</b> ducha y al trabajo. Mantén el ayuno hasta las 12:00 si lo estás haciendo, y camina para sumar pasos. Próximo entrenamiento: ${esc(DAYS[ROTATION[S.next]].title)}.</div>
    </div>
    <div class="bottom"><div class="inner"><button class="btn primary" id="close">Cerrar</button></div></div>`;
    document.getElementById("close").onclick = () => { tab = "home"; render(); };
  }

  function groupSets(sets) {
    const o = {};
    sets.forEach(x => { (o[x.ex] = o[x.ex] || []).push(x); });
    return o;
  }

  // ---------- Registro / historial ----------
  let histRange = 7;
  function renderHistory() {
    const since = histRange ? Date.now() - histRange * 864e5 : 0;
    const list = S.sessions.filter(s => new Date(s.date).getTime() >= since).slice().reverse();
    const allEx = {};
    S.sessions.forEach(s => s.sets.forEach(x => allEx[x.ex] = 1));
    const progress = Object.keys(EXERCISES).filter(id => allEx[id]).map(id => {
      const ex = EXERCISES[id];
      const hist = [];
      S.sessions.forEach(s => { const sets = s.sets.filter(x => x.ex === id); if (sets.length) hist.push({ d: s.date, sets }); });
      const lastN = hist.slice(-4);
      return `<tr><td><b>${esc(ex.name)}</b>${readyToProgress(id) ? ' <span style="color:var(--accent)">▲</span>' : ""}
        <div class="small muted">${lastN.map(h => `${fmtDate(h.d)}: ${h.sets.map(x => x.val).join(",")}${h.sets[0].kg ? " (" + h.sets[0].kg + "kg)" : ""}`).join("<br>")}</div></td>
        <td>${sparkline(hist.map(h => h.sets.reduce((t, x) => t + x.val, 0)))}</td></tr>`;
    }).join("");

    $app.innerHTML = `<div class="wrap">
      <div class="tiny muted">Registro</div><h1 class="mt8">Tu progreso</h1>
      <div class="card mt16">
        <h3>Resumen para enviarle a Claude</h3>
        <p class="small muted">Copia el resumen y pégalo en el chat cada semana para ajustar tus ejercicios.</p>
        <div class="seg" style="grid-template-columns:repeat(3,1fr)">
          ${[[7, "7 días"], [14, "14 días"], [0, "Todo"]].map(([v, l]) => `<button data-range="${v}" class="${histRange === v ? "on" : ""}">${l}</button>`).join("")}</div>
        <button class="btn primary mt12" id="copy">Copiar resumen</button>
      </div>

      <div class="card">
        <h3>Progreso por ejercicio</h3>
        <p class="small muted">Últimas 4 sesiones · ▲ = listo para subir dificultad · la línea muestra las reps totales por sesión.</p>
        ${progress ? `<table class="tbl">${progress}</table>` : `<p class="small muted">Aún no hay series registradas.</p>`}
      </div>

      <div class="card">
        <h3>Sesiones${histRange ? ` · últimos ${histRange} días` : ""}</h3>
        ${list.length ? list.map(s => sessionCard(s)).join("") : `<p class="small muted">No hay sesiones en este período.</p>`}
      </div>
    </div>${tabsHtml()}`;
    bindTabs();
    $app.querySelectorAll("[data-range]").forEach(b => b.onclick = () => { histRange = +b.dataset.range; renderHistory(); });
    document.getElementById("copy").onclick = () => copyText(weeklyReport(histRange), "Resumen copiado. Pégalo en el chat con Claude.");
  }
  function sessionCard(s) {
    const byEx = groupSets(s.sets);
    return `<details class="mt8"><summary>${fmtDate(s.date)} · ${esc(DAYS[s.day].title)} · ${Math.round(s.dur / 60)} min${s.deload ? " · descarga" : ""}${s.early ? " · incompleta" : ""}</summary>
      <table class="tbl">${Object.keys(byEx).map(id => `<tr><td>${esc(EXERCISES[id].name)}${byEx[id][0].kg ? ` <span class="muted">(${byEx[id][0].kg} kg)</span>` : ""}</td>
        <td>${byEx[id].map(x => x.val + (x.rir != null ? `<span class="muted">@${x.rir}</span>` : "")).join(" · ")}</td></tr>`).join("")}
      ${s.finisher ? `<tr><td>3/7 · ${esc(EXERCISES[s.finisher.ex].name)}</td><td>${s.finisher.done.join("-")}</td></tr>` : ""}</table></details>`;
  }
  function sparkline(vals) {
    if (vals.length < 2) return "";
    const w = 70, h = 26, mn = Math.min(...vals), mx = Math.max(...vals), span = mx - mn || 1;
    const pts = vals.slice(-8).map((v, i, arr) => `${(i / (arr.length - 1)) * w},${h - 3 - ((v - mn) / span) * (h - 6)}`).join(" ");
    return `<svg width="${w}" height="${h}" viewBox="0 0 ${w} ${h}"><polyline points="${pts}" fill="none" stroke="var(--accent)" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/></svg>`;
  }

  function weeklyReport(days) {
    const since = days ? Date.now() - days * 864e5 : 0;
    const list = S.sessions.filter(s => new Date(s.date).getTime() >= since);
    if (!list.length) return "Registro de calistenia: no hay sesiones en este período.";
    const d0 = new Date(list[0].date), d1 = new Date(list[list.length - 1].date);
    let t = `REGISTRO CALISTENIA 45 (${d0.getDate()}/${d0.getMonth() + 1} al ${d1.getDate()}/${d1.getMonth() + 1})\n`;
    t += `Sesiones: ${list.length} · Formato: reps por serie, @RIR (reps en reserva), kg de mochila\n`;
    list.forEach(s => {
      t += `\n${fmtDate(s.date)} · ${DAYS[s.day].title} · ${Math.round(s.dur / 60)} min${s.deload ? " · DESCARGA" : ""}${s.early ? " · INCOMPLETA" : ""}\n`;
      const byEx = groupSets(s.sets);
      Object.keys(byEx).forEach(id => {
        const ex = EXERCISES[id], sets = byEx[id];
        t += `- ${ex.name} [objetivo ${rangeTxt(ex)}]${sets[0].kg ? ` (${sets[0].kg} kg)` : ""}: ${sets.map(x => x.val + (x.rir != null ? "@" + x.rir : "")).join(", ")}\n`;
      });
      if (s.finisher) t += `- 3/7 ${EXERCISES[s.finisher.ex].name}: ${s.finisher.done.join("-")} (objetivo 3-4-5-6-7)\n`;
    });
    const ups = Object.keys(EXERCISES).filter(readyToProgress);
    if (ups.length) t += `\nListos para subir dificultad: ${ups.map(id => EXERCISES[id].name).join(", ")}\n`;
    return t;
  }

  function copyText(text, msg) {
    const done = () => toast(msg);
    const fallback = () => {
      const ta = document.createElement("textarea");
      ta.value = text; ta.style.position = "fixed"; ta.style.opacity = "0";
      document.body.appendChild(ta); ta.select();
      try { document.execCommand("copy"); done(); } catch (e) { showText(text); }
      ta.remove();
    };
    if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(text).then(done, fallback);
    else fallback();
  }
  function showText(text) {
    const box = document.createElement("div");
    box.className = "lightbox";
    box.innerHTML = `<div style="width:100%;max-width:520px"><textarea readonly>${esc(text)}</textarea><button class="btn mt12">Cerrar</button></div>`;
    box.querySelector("button").onclick = () => box.remove();
    document.body.appendChild(box);
  }

  // ---------- Ajustes ----------
  function renderSettings() {
    const st = S.settings;
    const tg = (k, on) => `<button class="toggle ${on ? "on" : ""}" data-tg="${k}" aria-label="${k}"></button>`;
    $app.innerHTML = `<div class="wrap">
      <div class="tiny muted">Ajustes</div><h1 class="mt8">Ajustes</h1>
      <div class="card mt16">
        <div class="switch"><div><b>Sonido de alarma</b><div class="small muted">Pitidos al terminar el descanso</div></div>${tg("sound", st.sound)}</div>
        <div class="switch"><div><b>Vibración</b></div>${tg("vibrate", st.vibrate)}</div>
        <div class="switch"><div><b>Semana de descarga</b><div class="small muted">Mitad de series, sin bloque 3/7, RIR 3–4. Se apaga sola tras 1 sesión.</div></div>${tg("deload", st.deload)}</div>
        <div class="switch"><div><b>Descarga cada</b><div class="small muted">Sesiones entre descargas (21 = 7 semanas)</div></div>
          <div class="kg"><button data-de="-3">−</button><span>${st.deloadEvery}</span><button data-de="3">+</button></div></div>
        <button class="btn mt12" id="testsound">Probar alarma</button>
      </div>
      <div class="card">
        <h3>Respaldo de datos</h3>
        <p class="small muted">Tus datos viven solo en este teléfono. Copia el respaldo de vez en cuando y guárdalo (por ejemplo en un correo para ti).</p>
        <button class="btn" id="backup">Copiar respaldo</button>
        <button class="btn mt8" id="restore">Restaurar desde respaldo</button>
        <button class="btn mt8" id="csv">Copiar todas las series en CSV</button>
      </div>
      <div class="card">
        <h3>Zona peligrosa</h3>
        <button class="btn mt8" id="wipe" style="color:var(--danger)">Borrar todo el registro</button>
      </div>
      <p class="small muted mt16">Fotos de ejercicios: free-exercise-db (dominio público). Algunas fotos muestran la versión con barra o máquina; la nota de cada ejercicio indica cómo hacerlo con tu equipo.</p>
    </div>${tabsHtml()}`;
    bindTabs();
    $app.querySelectorAll("[data-tg]").forEach(b => b.onclick = () => { st[b.dataset.tg] = !st[b.dataset.tg]; save(); renderSettings(); });
    $app.querySelectorAll("[data-de]").forEach(b => b.onclick = () => { st.deloadEvery = Math.min(42, Math.max(9, st.deloadEvery + (+b.dataset.de))); save(); renderSettings(); });
    document.getElementById("testsound").onclick = () => { unlockAudio(); beep(880, .25); setTimeout(() => beep(1175, .25), 280); buzz([300, 120, 300]); };
    document.getElementById("backup").onclick = () => copyText(JSON.stringify({ app: "cal45", ...S, active: null }), "Respaldo copiado");
    document.getElementById("csv").onclick = () => {
      let csv = "fecha,dia,ejercicio,serie,valor,rir,kg\n";
      S.sessions.forEach(s => s.sets.forEach(x => csv += `${s.date.slice(0, 10)},${s.day},"${EXERCISES[x.ex].name}",${x.round},${x.val},${x.rir == null ? "" : x.rir},${x.kg || 0}\n`));
      copyText(csv, "CSV copiado");
    };
    document.getElementById("restore").onclick = () => {
      const box = document.createElement("div");
      box.className = "lightbox";
      box.innerHTML = `<div style="width:100%;max-width:520px"><h3>Pega tu respaldo</h3><textarea class="mt8" id="rt"></textarea>
        <button class="btn primary mt12" id="rok">Restaurar</button><button class="btn mt8" id="rno">Cancelar</button></div>`;
      document.body.appendChild(box);
      box.querySelector("#rno").onclick = () => box.remove();
      box.querySelector("#rok").onclick = () => {
        try {
          const d = JSON.parse(box.querySelector("#rt").value);
          if (!d || !Array.isArray(d.sessions)) throw 0;
          S = Object.assign(JSON.parse(JSON.stringify(DEFAULT)), d, { active: null });
          save(); box.remove(); toast("Respaldo restaurado"); render();
        } catch (e) { toast("Ese texto no es un respaldo válido"); }
      };
    };
    document.getElementById("wipe").onclick = () => {
      if (confirm("¿Borrar TODO el registro? Esto no se puede deshacer.") && confirm("¿Seguro? Copia un respaldo antes si lo quieres conservar.")) {
        S = JSON.parse(JSON.stringify(DEFAULT)); save(); toast("Registro borrado"); render();
      }
    };
  }

  // ---------- Zoom de fotos ----------
  function bindZoom() {
    $app.querySelectorAll("[data-zoom]").forEach(el => el.onclick = () => {
      const box = document.createElement("div");
      box.className = "lightbox";
      box.innerHTML = `<img src="${el.dataset.zoom}" alt="">`;
      box.onclick = () => box.remove();
      document.body.appendChild(box);
    });
  }

  // ---------- Reloj ----------
  let tickT = null;
  function startTick(fn) { stopTick(); fn(); tickT = setInterval(fn, 250); }
  function stopTick() { if (tickT) clearInterval(tickT); tickT = null; }
  function tickClock() {
    const el = document.getElementById("clock");
    if (el && S.active) {
      const e = (Date.now() - S.active.start) / 1000;
      el.textContent = fmtTime(e);
      el.style.color = e > 45 * 60 ? "var(--warn)" : "";
    }
  }

  // Botón atrás de Android: no salir de la app en medio del entrenamiento
  try {
    const CapApp = window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins.App;
    if (CapApp) CapApp.addListener("backButton", () => {
      if (document.querySelector(".lightbox")) return document.querySelector(".lightbox").remove();
      if (S.active) { const b = document.getElementById("exit"); if (b) b.click(); return; }
      if (tab !== "home") { tab = "home"; render(); return; }
      CapApp.minimizeApp();
    });
  } catch (e) {}

  if (S.active) keepAwake(true);
  render();
})();
