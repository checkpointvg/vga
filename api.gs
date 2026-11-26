/**
 * API del ranking de Pronósticos VGA 2026 (Apps Script → Implementar como aplicación web).
 *
 * En el proyecto de Apps Script este código va junto a crear-form.gs.
 * Primera vez: ejecutar configurar() una sola vez → guarda el ID de la Sheet y genera la clave de admin
 * (queda en Propiedades del script; se ve en el registro de ejecución). La clave NO va al repo.
 *
 *   GET  ?action=ranking[&limit=10]          → público: top N, ganadores cargados, totales
 *   GET  ?action=ranking&key=CLAVE&limit=0   → admin: ranking completo
 *   GET  ?action=check&key=CLAVE             → valida la clave
 *   GET  ?action=integrantes&key=CLAVE       → admin: votos de los nombres listados en la hoja "Integrantes"
 *   POST {action:'setWinner', key, categoria, ganador|null}  (body text/plain con JSON)
 */

const SHEET_ID_DEFAULT = '1P2KEvkcPYVA3e8-Y8uI2OBgiK0BOwdv1pnr7qz1XhOQ';
const HOJA_GANADORES = 'Ganadores';
const HOJA_INTEGRANTES = 'Integrantes';

/* Mismo orden que la web: de menor a mayor importancia. Se usa para desempatar. */
const ORDEN_API = [
  'Best Esports Game', 'Best Adaptation', 'Innovation in Accessibility', 'Best Mobile Game', 'Best VR/AR Game',
  'Best Family Game', 'Best Sports/Racing Game', 'Best Sim/Strategy Game', 'Best Fighting Game', 'Best Multiplayer Game',
  'Best Community Support', 'Best Ongoing Game', 'Most Anticipated Game', 'Games for Impact', 'Best Debut Indie Game',
  'Best Independent Game', 'Best Role-Playing Game', 'Best Action Game', 'Best Action/Adventure Game', 'Best Audio Design',
  'Best Score and Music', 'Best Performance', 'Best Art Direction', 'Best Narrative', 'Best Game Direction', 'Game of the Year',
];

function configurar() {
  const props = PropertiesService.getScriptProperties();
  if (!props.getProperty('SHEET_ID')) props.setProperty('SHEET_ID', SHEET_ID_DEFAULT);
  let key = props.getProperty('ADMIN_KEY');
  if (!key) {
    key = Utilities.getUuid().replace(/-/g, '').slice(0, 16);
    props.setProperty('ADMIN_KEY', key);
  }
  hojaGanadores_();
  Logger.log('SHEET_ID: ' + props.getProperty('SHEET_ID'));
  Logger.log('ADMIN_KEY: ' + key);
}

/* ---------------- HTTP ---------------- */

function doGet(e) {
  const p = (e && e.parameter) || {};
  try {
    if (p.action === 'check') return json_({ ok: esAdmin_(p.key) });
    if (p.action === 'integrantes') {
      if (!esAdmin_(p.key)) return json_({ ok: false, error: 'clave inválida' });
      return json_(integrantes_());
    }
    if (p.action === 'ranking' || !p.action) {
      const admin = esAdmin_(p.key);
      let limit = parseInt(p.limit, 10);
      if (isNaN(limit)) limit = 10;
      if (!admin) limit = Math.min(limit || 10, 10); // público: como mucho el top 10
      return json_(calcular_(limit, admin));
    }
    return json_({ ok: false, error: 'acción desconocida' });
  } catch (err) {
    return json_({ ok: false, error: String(err) });
  }
}

function doPost(e) {
  try {
    const body = JSON.parse((e && e.postData && e.postData.contents) || '{}');
    if (!esAdmin_(body.key)) return json_({ ok: false, error: 'clave inválida' });
    if (body.action === 'setWinner') {
      if (ORDEN_API.indexOf(body.categoria) < 0) return json_({ ok: false, error: 'categoría desconocida' });
      setGanador_(body.categoria, body.ganador || null);
      return json_(calcular_(0, true));
    }
    return json_({ ok: false, error: 'acción desconocida' });
  } catch (err) {
    return json_({ ok: false, error: String(err) });
  }
}

/* ---------------- lógica ---------------- */

function calcular_(limit, admin) {
  const ganadores = leerGanadores_();
  const votos = leerVotos_();
  const reveladas = ORDEN_API.filter(c => ganadores[c]);

  const filas = votos.map(v => {
    let puntos = 0, peso = 0;
    reveladas.forEach(c => {
      if (v.picks[c] && v.picks[c] === ganadores[c].ganador) { puntos++; peso += ORDEN_API.indexOf(c) + 1; }
    });
    const gotyOk = !!ganadores['Game of the Year'] && v.picks['Game of the Year'] === ganadores['Game of the Year'].ganador;
    return { alias: v.alias, puntos: puntos, goty: gotyOk, peso: peso };
  });

  // Desempate: puntos → acertó GOTY → aciertos en categorías más importantes. Si sigue igual, comparten puesto.
  filas.sort((a, b) => b.puntos - a.puntos || (b.goty - a.goty) || (b.peso - a.peso) || a.alias.localeCompare(b.alias));
  let pos = 0, prev = null;
  filas.forEach((f, i) => {
    if (!prev || f.puntos !== prev.puntos || f.goty !== prev.goty || f.peso !== prev.peso) pos = i + 1;
    f.pos = pos; prev = f;
  });

  let ultima = null;
  reveladas.forEach(c => { if (!ultima || ganadores[c].fecha > ultima.fecha) ultima = { categoria: c, ganador: ganadores[c].ganador, fecha: ganadores[c].fecha }; });

  const ganadoresOut = {};
  reveladas.forEach(c => { ganadoresOut[c] = ganadores[c].ganador; });

  const out = {
    ok: true,
    admin: admin,
    votantes: votos.length,
    reveladas: reveladas.length,
    total: ORDEN_API.length,
    ultima: ultima,
    ganadores: ganadoresOut,
    ranking: (limit > 0 ? filas.slice(0, limit) : filas).map(f => ({ pos: f.pos, alias: f.alias, puntos: f.puntos, goty: f.goty })),
  };
  if (admin) {
    // cuántos votaron a cada nominado (útil para el admin)
    const conteo = {};
    votos.forEach(v => Object.keys(v.picks).forEach(c => {
      conteo[c] = conteo[c] || {};
      conteo[c][v.picks[c]] = (conteo[c][v.picks[c]] || 0) + 1;
    }));
    out.conteo = conteo;
  }
  return out;
}

/* Votos de los integrantes: los alias que coinciden con los nombres de la columna A de la hoja "Integrantes"
   (sin distinguir mayúsculas, acentos ni espacios de más). La primera fila puede ser un encabezado. */
function integrantes_() {
  const ganadores = leerGanadores_();
  const ganadoresOut = {};
  Object.keys(ganadores).forEach(c => { ganadoresOut[c] = ganadores[c].ganador; });
  const nombres = leerIntegrantes_();
  const existe = nombres !== null;
  const votos = {};
  leerVotos_().forEach(v => { votos[norm_(v.alias)] = v; });
  const lista = [], sinVoto = [];
  (nombres || []).forEach(n => {
    const v = votos[norm_(n)];
    if (!v) { sinVoto.push(n); return; }
    let puntos = 0;
    Object.keys(ganadoresOut).forEach(c => { if (v.picks[c] === ganadoresOut[c]) puntos++; });
    lista.push({ alias: n, picks: v.picks, puntos: puntos });
  });
  return { ok: true, hoja: HOJA_INTEGRANTES, existeHoja: existe, integrantes: lista, sinVoto: sinVoto, ganadores: ganadoresOut };
}

function leerIntegrantes_() {
  const h = SpreadsheetApp.openById(sheetId_()).getSheetByName(HOJA_INTEGRANTES);
  if (!h) return null;
  if (h.getLastRow() < 1) return [];
  const vistos = {}, out = [];
  h.getRange(1, 1, h.getLastRow(), 1).getValues().forEach((r, i) => {
    const n = String(r[0] || '').trim().replace(/\s+/g, ' ');
    if (!n) return;
    if (i === 0 && ['nombre', 'nombres', 'integrante', 'integrantes', 'alias'].indexOf(norm_(n)) >= 0) return;
    if (vistos[norm_(n)]) return;
    vistos[norm_(n)] = true;
    out.push(n);
  });
  return out;
}

function norm_(s) {
  return String(s).normalize('NFD').replace(/\p{M}/gu, '').trim().replace(/\s+/g, ' ').toLowerCase();
}

/* Lee las respuestas del Form; si un alias votó más de una vez, queda el último envío. */
function leerVotos_() {
  const ss = SpreadsheetApp.openById(sheetId_());
  const hoja = ss.getSheets().find(h => [HOJA_GANADORES, HOJA_INTEGRANTES].indexOf(h.getName()) < 0 && h.getLastRow() > 0 && h.getRange(1, 1, 1, h.getLastColumn()).getValues()[0].indexOf('Alias') >= 0);
  if (!hoja || hoja.getLastRow() < 2) return [];
  const datos = hoja.getDataRange().getValues();
  const head = datos[0].map(String);
  const iAlias = head.indexOf('Alias');
  const porAlias = {};
  datos.slice(1).forEach(row => {
    const alias = String(row[iAlias] || '').trim().replace(/\s+/g, ' ');
    if (!alias) return;
    const ts = row[0] instanceof Date ? row[0].getTime() : 0;
    const k = alias.toLowerCase();
    if (porAlias[k] && porAlias[k].ts > ts) return;
    const picks = {};
    head.forEach((h, i) => { if (ORDEN_API.indexOf(h) >= 0 && row[i] !== '') picks[h] = String(row[i]); });
    porAlias[k] = { alias: alias, ts: ts, picks: picks };
  });
  return Object.keys(porAlias).map(k => porAlias[k]);
}

function leerGanadores_() {
  const h = hojaGanadores_();
  const out = {};
  if (h.getLastRow() < 2) return out;
  h.getRange(2, 1, h.getLastRow() - 1, 3).getValues().forEach(r => {
    if (r[0] && r[1]) out[String(r[0])] = { ganador: String(r[1]), fecha: r[2] instanceof Date ? r[2].getTime() : 0 };
  });
  return out;
}

function setGanador_(categoria, ganador) {
  const lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    const h = hojaGanadores_();
    const n = h.getLastRow();
    const cats = n >= 2 ? h.getRange(2, 1, n - 1, 1).getValues().map(r => String(r[0])) : [];
    const i = cats.indexOf(categoria);
    if (ganador) {
      if (i >= 0) h.getRange(i + 2, 2, 1, 2).setValues([[ganador, new Date()]]);
      else h.appendRow([categoria, ganador, new Date()]);
    } else if (i >= 0) {
      h.deleteRow(i + 2);
    }
  } finally {
    lock.releaseLock();
  }
}

function hojaGanadores_() {
  const ss = SpreadsheetApp.openById(sheetId_());
  let h = ss.getSheetByName(HOJA_GANADORES);
  if (!h) {
    h = ss.insertSheet(HOJA_GANADORES);
    h.getRange(1, 1, 1, 3).setValues([['Categoría', 'Ganador', 'Cargado']]).setFontWeight('bold');
  }
  return h;
}

function sheetId_() {
  return PropertiesService.getScriptProperties().getProperty('SHEET_ID') || SHEET_ID_DEFAULT;
}

function esAdmin_(key) {
  const k = PropertiesService.getScriptProperties().getProperty('ADMIN_KEY');
  return !!k && key === k;
}

function json_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}
