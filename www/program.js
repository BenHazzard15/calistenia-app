/* Lector de rutinas en Excel (.xlsx) para Calistenia 45.
   Convierte el libro en la misma estructura que window.DEFAULT_PROGRAM. */
(function () {
  "use strict";

  function slug(s) {
    return String(s == null ? "" : s).toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "")
      .replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
  }
  const DOW = { lun: 1, mar: 2, mie: 3, jue: 4, vie: 5, sab: 6, dom: 0 };
  const TRUE = ["si", "s", "x", "1", "true", "yes", "verdadero"];

  function str(v) { return v == null ? "" : String(v).trim(); }
  function bool(v) { return TRUE.includes(slug(v)); }
  function num(v) {
    if (typeof v === "number") return v;
    const s = str(v).replace(",", ".");
    if (s === "") return NaN;
    return Number(s);
  }

  // Lee una hoja como lista de objetos con claves = encabezados normalizados.
  function readSheet(wb, name) {
    const key = Object.keys(wb.Sheets).find(k => slug(k) === slug(name));
    if (!key) return null;
    const rows = XLSX.utils.sheet_to_json(wb.Sheets[key], { header: 1, defval: "", raw: true });
    if (!rows.length) return [];
    const head = rows[0].map(slug);
    const out = [];
    for (let i = 1; i < rows.length; i++) {
      const r = rows[i];
      if (!r || r.every(c => str(c) === "")) continue;
      const o = { _row: i + 1 };
      head.forEach((h, j) => { if (h) o[h] = r[j]; });
      out.push(o);
    }
    out.head = head;
    return out;
  }

  function parseWorkbook(data) {
    const errors = [], warnings = [];
    let wb;
    try { wb = XLSX.read(data, { type: "array" }); }
    catch (e) { return { errors: ["No pude abrir el archivo. ¿Es un Excel (.xlsx)?"], warnings }; }

    const need = { fases: "Fases", sesiones: "Sesiones", ejercicios: "Ejercicios" };
    const sh = {};
    for (const k in need) {
      sh[k] = readSheet(wb, need[k]);
      if (!sh[k]) errors.push(`Falta la hoja "${need[k]}".`);
    }
    if (errors.length) return { errors, warnings };
    sh.cal = readSheet(wb, "Calentamiento") || [];
    const progSheet = readSheet(wb, "Programa") || [];

    const reqCols = {
      fases: ["fase", "nombre", "dias"],
      sesiones: ["fase", "sesion", "nombre"],
      ejercicios: ["fase", "sesion", "bloque", "ejercicio", "tipo", "series", "min", "max"]
    };
    for (const k in reqCols) {
      const head = sh[k].head || [];
      reqCols[k].forEach(c => { if (!head.includes(c)) errors.push(`La hoja "${need[k]}" no tiene la columna "${c}".`); });
    }
    if (errors.length) return { errors, warnings };

    let name = "Rutina importada";
    progSheet.forEach(r => { if (slug(r.campo) === "nombre" && str(r.valor)) name = str(r.valor); });

    const photoKeys = window.PHOTO_KEYS || [];
    const phases = [], byCode = {};
    sh.fases.forEach(r => {
      const code = str(r.fase);
      if (!code) return errors.push(`Hoja Fases, fila ${r._row}: falta el código de la fase.`);
      if (byCode[code]) return errors.push(`Hoja Fases, fila ${r._row}: la fase "${code}" está repetida.`);
      const days = num(r.dias);
      const gap = r["horas-tren-superior"] === undefined || str(r["horas-tren-superior"]) === "" ? 0 : num(r["horas-tren-superior"]);
      if (isNaN(days) || days < 0) errors.push(`Hoja Fases, fila ${r._row}: "Días" debe ser un número (0 = sin fin).`);
      if (isNaN(gap) || gap < 0) errors.push(`Hoja Fases, fila ${r._row}: "Horas tren superior" debe ser un número.`);
      const p = {
        code, name: str(r.nombre) || code, days: days || 0, gap: gap || 0, elbow: bool(r["control-de-codo"]),
        desc: str(r.descripcion), criteria: str(r["criterio-para-avanzar"]), sessions: [], warmup: [], cooldown: []
      };
      phases.push(p); byCode[code] = p;
    });
    if (!phases.length) errors.push("La hoja Fases no tiene ninguna fase.");

    const sessByKey = {};
    sh.sesiones.forEach(r => {
      const pc = str(r.fase), code = str(r.sesion);
      const p = byCode[pc];
      if (!p) return errors.push(`Hoja Sesiones, fila ${r._row}: la fase "${pc}" no existe en la hoja Fases.`);
      if (!code) return errors.push(`Hoja Sesiones, fila ${r._row}: falta el código de la sesión.`);
      if (sessByKey[pc + "|" + code]) return errors.push(`Hoja Sesiones, fila ${r._row}: la sesión "${code}" está repetida en la fase ${pc}.`);
      const weekdays = [];
      str(r["dias-de-la-semana"]).split(/[,;/ ]+/).forEach(d => {
        const k = slug(d).slice(0, 3);
        if (!k) return;
        if (k in DOW) weekdays.push(DOW[k]);
        else warnings.push(`Hoja Sesiones, fila ${r._row}: no entendí el día "${d}".`);
      });
      const s = { code, name: str(r.nombre) || code, weekdays, upper: bool(r["tren-superior"]), focus: str(r.enfoque), blocks: [] };
      p.sessions.push(s); sessByKey[pc + "|" + code] = s;
    });

    let lastKey = null, curBlock = null;
    sh.ejercicios.forEach(r => {
      const pc = str(r.fase), sc = str(r.sesion), bl = str(r.bloque) || "Bloque";
      const s = sessByKey[pc + "|" + sc];
      const where = `Hoja Ejercicios, fila ${r._row}`;
      if (!s) { lastKey = null; return errors.push(`${where}: la sesión "${sc}" de la fase "${pc}" no existe en la hoja Sesiones.`); }
      const exName = str(r.ejercicio);
      if (!exName) return errors.push(`${where}: falta el nombre del ejercicio.`);
      const t = slug(r.tipo);
      let type;
      if (t === "reps" || t === "repeticiones" || t === "") type = "reps";
      else if (t === "tiempo" || t === "segundos" || t === "time") type = "time";
      else if (t === "3-7" || t === "37") type = "37";
      else return errors.push(`${where}: el tipo "${str(r.tipo)}" no existe. Usa reps, tiempo o 3-7.`);
      let sets = 1, range = [3, 7];
      if (type !== "37") {
        sets = num(r.series); const lo = num(r.min), hi = num(r.max);
        if (!(sets >= 1)) errors.push(`${where}: "Series" debe ser 1 o más.`);
        if (!(lo >= 1) || !(hi >= 1)) errors.push(`${where}: "Mín" y "Máx" deben ser números.`);
        else if (lo > hi) errors.push(`${where}: "Mín" es mayor que "Máx".`);
        range = [lo, hi];
      }
      const restRaw = r["descanso-s"];
      const rest = str(restRaw) === "" ? 60 : num(restRaw);
      if (isNaN(rest) || rest < 0) errors.push(`${where}: "Descanso (s)" debe ser un número.`);
      let img = str(r.foto) || null;
      if (img && photoKeys.length && !photoKeys.includes(img)) {
        warnings.push(`${where}: la foto "${img}" no existe en la app; el ejercicio se mostrará sin foto.`);
        img = null;
      }
      const item = {
        id: slug(exName), name: exName, type, sets: type === "37" ? 1 : sets, range, perLeg: bool(r["por-lado"]),
        rest: isNaN(rest) ? 60 : rest, load: bool(r.mochila), img, muscles: str(r.musculos), tips: str(r.tecnica),
        easier: str(r["mas-facil"]), harder: str(r["mas-dificil"]), safety: str(r.precaucion)
      };
      const key = pc + "|" + sc + "|" + bl;
      if (key !== lastKey || !curBlock) {
        curBlock = { label: bl, type: "single", rounds: 0, items: [] };
        s.blocks.push(curBlock); lastKey = key;
      }
      curBlock.items.push(item);
    });

    phases.forEach(p => p.sessions.forEach(s => {
      s.blocks.forEach(b => {
        b.type = b.items.some(i => i.type === "37") ? "37" : (b.items.length > 1 ? "ss" : "single");
        b.rounds = Math.max.apply(null, b.items.map(i => i.sets));
        if (b.type === "37" && b.items.length > 1) warnings.push(`El bloque "${b.label}" de ${s.code} mezcla 3-7 con otros ejercicios: solo se usará el primero.`);
      });
      if (!s.blocks.length) errors.push(`La sesión ${s.code} (fase ${p.code}) no tiene ejercicios.`);
    }));
    phases.forEach(p => { if (!p.sessions.length) errors.push(`La fase ${p.code} no tiene sesiones.`); });

    sh.cal.forEach(r => {
      const exName = str(r.ejercicio);
      if (!exName) return;
      const list = str(r.fases) ? str(r.fases).split(/[,;]+/).map(x => x.trim()).filter(Boolean) : phases.map(p => p.code);
      list.forEach(c => { if (!byCode[c]) warnings.push(`Hoja Calentamiento, fila ${r._row}: la fase "${c}" no existe.`); });
      let img = str(r.foto) || null;
      if (img && photoKeys.length && !photoKeys.includes(img)) img = null;
      const cool = slug(r.momento).indexOf("calma") >= 0;
      const dur = num(r["duracion-s"]);
      phases.forEach(p => {
        if (!list.includes(p.code)) return;
        if (cool) p.cooldown.push({ name: exName, img });
        else p.warmup.push({ name: exName, dur: isNaN(dur) ? 30 : dur, img });
      });
    });

    return { program: errors.length ? null : { name, phases }, errors, warnings };
  }

  window.ProgramIO = { parseWorkbook, slug };
})();
