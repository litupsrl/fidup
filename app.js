/*! FidUP! — Copyright LITUP S.r.l.
 * SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
 * Required Notice: Copyright LITUP S.r.l. (https://github.com/litupsrl/fidup)
 * https://polyformproject.org/licenses/noncommercial/1.0.0 */
/* FidUP! — PWA con archivio cifrato locale (AES-256-GCM, chiave da PBKDF2-SHA256). */
'use strict';

const APP_VERSION = '1.11.0';
const KDF_ITERATIONS = 600000;
const CFG = Object.assign({ googleClientId: '', microsoftClientId: '', cloudFileName: 'fidup-backup.json' }, window.APP_CONFIG || {});

const $ = (s) => document.querySelector(s);
const enc = new TextEncoder();
const dec = new TextDecoder();

/* ---------- util ---------- */
function b64(buf) {
  const bytes = buf instanceof Uint8Array ? buf : new Uint8Array(buf);
  let s = '';
  for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
  return btoa(s);
}
function unb64(str) { return Uint8Array.from(atob(str), (c) => c.charCodeAt(0)); }
function b64url(buf) { return b64(buf).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, ''); }
function rnd(n) { return crypto.getRandomValues(new Uint8Array(n)); }
function uid() { return b64url(rnd(12)); }
function today() { return new Date().toISOString().slice(0, 10); }
function fmtDate(iso) { try { return new Date(iso).toLocaleString('it-IT', { dateStyle: 'medium', timeStyle: 'short' }); } catch { return iso; } }

let toastTimer;
function toast(msg, ms = 2800) {
  const t = $('#toast');
  t.textContent = msg; t.hidden = false;
  clearTimeout(toastTimer); toastTimer = setTimeout(() => { t.hidden = true; }, ms);
}

/* ---------- IndexedDB (solo dati cifrati) ---------- */
const DB = {
  _db: null,
  open() {
    if (this._db) return Promise.resolve(this._db);
    return new Promise((res, rej) => {
      const r = indexedDB.open('fidup', 1);
      r.onupgradeneeded = () => r.result.createObjectStore('kv');
      r.onsuccess = () => { this._db = r.result; res(r.result); };
      r.onerror = () => rej(r.error);
    });
  },
  async tx(mode, fn) {
    const db = await this.open();
    return new Promise((res, rej) => {
      const t = db.transaction('kv', mode);
      const req = fn(t.objectStore('kv'));
      t.oncomplete = () => res(req && req.result);
      t.onerror = () => rej(t.error);
    });
  },
  get(k) { return this.tx('readonly', (s) => s.get(k)); },
  set(k, v) { return this.tx('readwrite', (s) => s.put(v, k)); },
  del(k) { return this.tx('readwrite', (s) => s.delete(k)); }
};

/* ---------- Crittografia ---------- */
const Crypto = {
  async deriveKey(password, salt, iterations) {
    const base = await crypto.subtle.importKey('raw', enc.encode(password.normalize('NFC')), 'PBKDF2', false, ['deriveKey']);
    return crypto.subtle.deriveKey(
      { name: 'PBKDF2', hash: 'SHA-256', salt, iterations },
      base, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
  },
  async encrypt(key, obj) {
    const iv = rnd(12);
    const ct = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, enc.encode(JSON.stringify(obj)));
    return { iv: b64(iv), ct: b64(ct) };
  },
  async decrypt(key, iv, ct) {
    const pt = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: unb64(iv) }, key, unb64(ct));
    return JSON.parse(dec.decode(pt));
  }
};

/* Archivio locale: cifrato con una chiave del dispositivo (AES-256, NON esportabile),
   generata al primo avvio e conservata in IndexedDB. Nessun codice da digitare.
   Backup: cifrati con una "password di backup" scelta dall'utente (PBKDF2 → AES-256). */

async function getDeviceKey() {
  let k = await DB.get('devkey');
  if (k) return k;
  k = await crypto.subtle.generateKey({ name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
  await DB.set('devkey', k);
  return k;
}

function validateBackup(v) {
  if (!v || v.app !== 'fidup' || ![1, 2].includes(v.version) || !v.kdf || !v.iv || !v.ct) throw new Error('File di backup non valido');
  const it = v.kdf.iterations;
  if (!Number.isInteger(it) || it < 100000 || it > 10000000) throw new Error('Parametri di cifratura non validi');
  return v;
}

/** Decifra un backup (o il vecchio archivio v1) con la password. Ritorna {key, data}. */
async function openBackup(b, password) {
  validateBackup(b);
  const key = await Crypto.deriveKey(password, unb64(b.kdf.salt), b.kdf.iterations);
  try {
    const data = await Crypto.decrypt(key, b.iv, b.ct);
    return { key, data: normalizeData(data) };
  } catch { throw new Error('Password errata'); }
}

function normalizeData(d) {
  d = d && typeof d === 'object' ? d : {};
  return {
    cards: Array.isArray(d.cards) ? d.cards.filter((c) => c && c.id && typeof c.name === 'string') : [],
    meta: Object.assign({}, d.meta || {})
  };
}

/* ---------- Stato ---------- */
const S = {
  key: null,       // chiave del dispositivo (non esportabile)
  data: null,      // dati in chiaro, solo in memoria
  currentId: null,
  editingId: null
};

async function persist() {
  const { iv, ct } = await Crypto.encrypt(S.key, S.data);
  await DB.set('store', { app: 'fidup', version: 2, iv, ct, updatedAt: new Date().toISOString() });
}

/** Chiave per i backup: chiesta una sola volta e poi ricordata (non esportabile). */
async function setBackupPassword(password) {
  const salt = rnd(16);
  const key = await Crypto.deriveKey(password, salt, KDF_ITERATIONS);
  await DB.set('backupkey', { key, salt: b64(salt), iterations: KDF_ITERATIONS });
}
async function askNewBackupPassword(title) {
  const r = await ask({
    title,
    text: 'Serve a cifrare i backup nel cloud. Ti verrà chiesta SOLO per ripristinare su un altro telefono: annotala in un posto sicuro, senza di essa il backup è illeggibile.',
    fields: [{ id: 'p1', type: 'password', placeholder: 'Password di backup (min. 8)' }, { id: 'p2', type: 'password', placeholder: 'Ripeti password' }],
    ok: 'Salva'
  });
  if (!r) return false;
  if (r.p1.length < 8) { toast('Almeno 8 caratteri'); return false; }
  if (r.p1 !== r.p2) { toast('Le password non coincidono'); return false; }
  await setBackupPassword(r.p1);
  return true;
}
async function makeBackup() {
  let bk = await DB.get('backupkey');
  if (!bk) {
    if (!(await askNewBackupPassword('Scegli la password di backup'))) return null;
    bk = await DB.get('backupkey');
  }
  const { iv, ct } = await Crypto.encrypt(bk.key, S.data);
  return { app: 'fidup', type: 'backup', version: 2, kdf: { alg: 'PBKDF2-SHA256', iterations: bk.iterations, salt: bk.salt }, iv, ct, createdAt: new Date().toISOString() };
}

/* ---------- Navigazione ---------- */
const VIEWS = ['gate', 'lock', 'list', 'detail', 'edit', 'settings'];
function showView(name) {
  VIEWS.forEach((v) => { $('#view-' + v).hidden = v !== name; });
  window.scrollTo(0, 0);
  if (name === 'lock') setTimeout(() => $('#unlock-pw').focus(), 50);
}
function go(name) {
  history.pushState({ view: name }, '');
  renderView(name);
}
function renderView(name) {
  if (!S.data) return;
  if (name === 'list') renderList();
  if (name === 'detail') renderDetail();
  if (name === 'edit') renderEdit();
  if (name === 'settings') renderSettings();
  showView(name);
}
window.addEventListener('popstate', (e) => {
  if (!$('#view-gate').hidden) { history.replaceState({ view: 'gate' }, ''); return; }
  if (!S.data) { history.replaceState({ view: 'lock' }, ''); return; }
  const v = (e.state && e.state.view) || 'list';
  renderView(v === 'lock' ? 'list' : v);
});

/* ---------- Elenco ---------- */
function sortedCards() {
  return [...S.data.cards].sort((a, b) => (b.lastUsed || '').localeCompare(a.lastUsed || '') || a.name.localeCompare(b.name, 'it'));
}
function renderList() {
  const q = $('#search').value.trim().toLowerCase();
  const list = $('#card-list');
  const cards = sortedCards().filter((c) => !q || c.name.toLowerCase().includes(q) || (c.note || '').toLowerCase().includes(q));
  list.replaceChildren(...cards.map((c) => {
    const li = document.createElement('li');
    li.className = 'card-tile';
    li.style.background = safeColor(c.color);
    li.dataset.id = c.id;
    const n = document.createElement('div'); n.className = 'name'; n.textContent = c.name;
    const num = document.createElement('div'); num.className = 'num'; num.textContent = c.number;
    li.append(n, num);
    return li;
  }));
  $('#empty').hidden = S.data.cards.length > 0;
}
function safeColor(c) { return /^#[0-9a-f]{6}$/i.test(c || '') ? c : '#3A3A3A'; }

$('#card-list').addEventListener('click', async (e) => {
  const li = e.target.closest('.card-tile');
  if (!li) return;
  S.currentId = li.dataset.id;
  go('detail');
  const c = S.data.cards.find((x) => x.id === S.currentId);
  if (c) { c.lastUsed = new Date().toISOString(); persist().catch(() => {}); }
});
$('#search').addEventListener('input', renderList);

/* ---------- Codici a barre ---------- */
function renderCode(box, number, format, large) {
  box.replaceChildren();
  box.classList.remove('qr');
  if (!number) return;
  if (format === 'NONE') { if (!large) return; const p = document.createElement('p'); p.textContent = 'Solo numero (nessun codice grafico)'; p.className = 'muted'; box.append(p); return; }
  try {
    if (format === 'QR') {
      const qr = qrcode(0, 'M'); qr.addData(unescape(encodeURIComponent(number)), 'Byte'); qr.make();
      const img = new Image(); img.src = qr.createDataURL(large ? 8 : 4, 4); img.alt = 'QR';
      box.classList.add('qr'); box.append(img);
      return;
    }
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    let ok = true;
    JsBarcode(svg, number, { format, displayValue: false, height: large ? 130 : 50, width: large ? 2.4 : 1.6, margin: 12, background: '#ffffff', lineColor: '#000000', valid: (v) => { ok = v; } });
    if (!ok) throw new Error('invalid');
    svg.removeAttribute('width'); svg.style.width = '100%'; svg.style.maxWidth = large ? '520px' : '300px';
    box.append(svg);
  } catch {
    const p = document.createElement('p'); p.className = 'error';
    p.textContent = 'Il numero non è valido per il formato ' + format + '. Prova "Code 128".';
    box.append(p);
  }
}

/* ---------- Dettaglio ---------- */
function renderDetail() {
  const c = S.data.cards.find((x) => x.id === S.currentId);
  if (!c) { history.back(); return; }
  $('#detail-title').textContent = c.name;
  $('#detail-number').textContent = c.number;
  $('#detail-note').textContent = c.note || '';
  renderCode($('#detail-code'), c.number, c.format, true);
}

/* ---------- Modifica ---------- */
function renderEdit() {
  const c = S.editingId ? S.data.cards.find((x) => x.id === S.editingId) : null;
  $('#edit-title').textContent = c ? 'Modifica carta' : 'Nuova carta';
  $('#f-name').value = c ? c.name : '';
  $('#f-number').value = c ? c.number : '';
  $('#f-format').value = c ? c.format : 'CODE128';
  $('#f-color').value = c ? safeColor(c.color) : '#3A3A3A';
  $('#f-note').value = c ? (c.note || '') : '';
  $('#btn-delete').hidden = !c;
  $('#name-suggest').hidden = true;
  ocrRun++; ocrStatus('');
  updatePreview();
  updateChainHint();
}
function updatePreview() { renderCode($('#edit-preview'), $('#f-number').value.trim(), $('#f-format').value, false); }
['#f-number', '#f-format'].forEach((s) => $(s).addEventListener('input', updatePreview));

/* ---------- Suggerimento della catena (tutto locale) ---------- */
const norm = (t) => String(t || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]/g, '');
const CHAIN_LIST = (window.CHAINS || []).map((c) => Object.assign({ key: norm(c.n) }, c));
function chainByName(name) { const k = norm(name); return CHAIN_LIST.find((c) => c.key === k || c.k.includes(k)) || null; }

/** Catena dal sito web contenuto nel codice (QR con link). */
function chainFromUrl(text) {
  let host;
  try { host = new URL(/^[a-z][a-z0-9+.-]*:\/\//i.test(text) ? text : 'https://' + text).hostname.toLowerCase(); } catch { return null; }
  if (!/\./.test(host) || /\s/.test(text.trim().split('/')[0])) return null;
  if (!/^https?:\/\//i.test(text) && !/^www\./i.test(text)) return null; // solo veri link
  const labels = host.replace(/^www\./, '').split('.');
  const tokens = new Set(labels.flatMap((l) => [l, ...l.split('-'), l.replace(/-/g, '')]));
  const joined = labels.join('').replace(/-/g, '');
  for (const c of CHAIN_LIST) {
    for (const k of c.k) {
      if (tokens.has(k) || (k.length >= 5 && joined.includes(k))) return { name: c.n, color: c.c, why: 'sito' };
    }
  }
  // catena non in elenco: propone il nome del sito (es. "negozio-bello.it" → "Negozio Bello")
  const base = labels.length >= 2 ? labels[labels.length - 2] : labels[0];
  if (!base || base.length < 3) return null;
  return { name: base.split('-').map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(' '), color: null, why: 'sito' };
}

/** Catena dalle cifre iniziali: prefissi verificati + carte già salvate dall'utente. */
function chainFromNumber(num) {
  const n = num.replace(/\s/g, '');
  if (n.length < 6) return null;
  for (const p of (window.CHAIN_PREFIXES || [])) {
    if (n.startsWith(p.p) && (!p.len || p.len === n.length)) { const c = chainByName(p.n); return { name: p.n, color: c ? c.c : null, why: 'prefisso' }; }
  }
  const minPrefix = /^\d+$/.test(n) ? 6 : 5;
  let best = null, bestLen = 0;
  for (const c of S.data.cards) {
    if (c.id === S.editingId) continue;
    const m = String(c.number).replace(/\s/g, '');
    if (m.length !== n.length || m === n) continue;
    let i = 0; while (i < n.length && n[i] === m[i]) i++;
    if (i >= minPrefix && (i > bestLen || (i === bestLen && (c.updatedAt || '') > (best.updatedAt || '')))) { best = c; bestLen = i; }
  }
  return best ? { name: best.name, color: best.color, format: best.format, why: 'carte' } : null;
}

let chainSuggestion = null;
function updateChainHint() {
  const num = $('#f-number').value.trim();
  const sug = num ? (chainFromUrl(num) || chainFromNumber(num)) : null;
  const current = norm($('#f-name').value);
  chainSuggestion = sug && norm(sug.name) !== current ? sug : null;
  $('#chain-hint').hidden = !chainSuggestion;
  if (chainSuggestion) $('#chain-hint-name').textContent = chainSuggestion.name;
}
function applyChain(sug) {
  $('#f-name').value = sug.name;
  const cat = chainByName(sug.name);
  const color = sug.color || (cat && cat.c);
  if (color && /^#[0-9a-f]{6}$/i.test(color)) $('#f-color').value = color;
  if (sug.format && [...$('#f-format').options].some((o) => o.value === sug.format)) $('#f-format').value = sug.format;
  $('#name-suggest').hidden = true;
  updatePreview(); updateChainHint();
}

/* Elenco a comparsa mentre si scrive il nome */
function renderNameSuggest() {
  const box = $('#name-suggest');
  const q = norm($('#f-name').value);
  if (q.length < 2) { box.hidden = true; return; }
  const own = [...new Map(S.data.cards.map((c) => [norm(c.name), { n: c.name, c: c.color, own: true }])).values()];
  const pool = [...own, ...CHAIN_LIST.filter((c) => !own.some((o) => norm(o.n) === c.key))];
  const score = (c) => { const k = norm(c.n); if (k === q) return -1; if (k.startsWith(q)) return 0; if ((c.k || []).some((x) => x.startsWith(q))) return 1; if (k.includes(q)) return 2; return 9; };
  const hits = pool.map((c) => [score(c), c]).filter(([s]) => s >= 0 && s < 9).sort((x, y) => x[0] - y[0]).slice(0, 5).map(([, c]) => c);
  if (!hits.length) { box.hidden = true; return; }
  box.replaceChildren(...hits.map((c) => {
    const b = document.createElement('button');
    b.type = 'button'; b.className = 'name-opt';
    const dot = document.createElement('span'); dot.className = 'dot'; dot.style.background = safeColor(c.c);
    b.append(dot, document.createTextNode(c.n));
    b.addEventListener('pointerdown', (e) => { e.preventDefault(); applyChain({ name: c.n, color: c.c }); });
    return b;
  }));
  box.hidden = false;
}
$('#f-name').addEventListener('input', () => { renderNameSuggest(); updateChainHint(); });
$('#f-name').addEventListener('blur', () => setTimeout(() => { $('#name-suggest').hidden = true; }, 150));
let hintTimer;
$('#f-number').addEventListener('input', () => { clearTimeout(hintTimer); hintTimer = setTimeout(updateChainHint, 300); });
document.addEventListener('click', (e) => { if (e.target.closest('[data-action="chain-use"]') && chainSuggestion) applyChain(chainSuggestion); });

$('#form-edit').addEventListener('submit', async (e) => {
  e.preventDefault();
  const now = new Date().toISOString();
  const fields = {
    name: $('#f-name').value.trim(), number: $('#f-number').value.trim(), format: $('#f-format').value,
    color: $('#f-color').value, note: $('#f-note').value.trim(), updatedAt: now
  };
  if (!fields.name || !fields.number) return;
  if (S.editingId) {
    Object.assign(S.data.cards.find((x) => x.id === S.editingId), fields);
  } else {
    S.data.cards.push(Object.assign({ id: uid(), createdAt: now }, fields));
  }
  await persist();
  toast('Carta salvata');
  history.back();
});

/* ---------- Dialog ---------- */
function ask({ title, text = '', fields = [], ok = 'OK', cancel = 'Annulla', danger = false }) {
  const dlg = $('#dlg');
  $('#dlg-title').textContent = title;
  $('#dlg-text').textContent = text;
  $('#dlg-ok').textContent = ok;
  $('#dlg-ok').className = 'btn ' + (danger ? 'danger' : 'primary');
  $('#dlg-cancel').textContent = cancel;
  $('#dlg-cancel').hidden = cancel === null;
  const box = $('#dlg-fields');
  box.replaceChildren(...fields.map((f) => {
    const i = document.createElement('input');
    i.type = f.type || 'text'; i.placeholder = f.placeholder || ''; i.dataset.k = f.id;
    i.autocomplete = f.type === 'password' ? 'off' : 'off';
    return i;
  }));
  return new Promise((resolve) => {
    dlg.onclose = () => {
      if (dlg.returnValue !== 'ok') return resolve(null);
      const out = {}; box.querySelectorAll('input').forEach((i) => { out[i.dataset.k] = i.value; });
      resolve(out);
    };
    dlg.returnValue = '';
    dlg.showModal();
    const first = box.querySelector('input'); if (first) first.focus();
  });
}

/* ---------- Scanner ---------- */
const FORMAT_MAP = {
  EAN13: 'EAN13', EAN8: 'EAN8', UPCA: 'UPC', UPCE: 'UPCE', CODE128: 'CODE128', CODE39: 'CODE39',
  ITF: 'ITF', CODABAR: 'codabar', QRCODE: 'QR', QR: 'QR'
};
function normFormat(f) { return FORMAT_MAP[String(f || '').toUpperCase().replace(/[^A-Z0-9]/g, '')] || null; }

let scanner = null; // {stream, raf, reader}
let zxingLoaded = null;
function loadZXing() {
  if (window.ZXing) return Promise.resolve();
  if (!zxingLoaded) zxingLoaded = new Promise((res, rej) => {
    const s = document.createElement('script'); s.src = 'vendor/zxing.min.js'; s.onload = res; s.onerror = rej; document.head.append(s);
  });
  return zxingLoaded;
}
async function nativeDetector() {
  if (!('BarcodeDetector' in window)) return null;
  try {
    const formats = await BarcodeDetector.getSupportedFormats();
    return formats.length ? new BarcodeDetector({ formats }) : null;
  } catch { return null; }
}

function onScanResult(text, rawFormat) {
  stopScanner();
  if (!text) return;
  $('#f-number').value = text.trim();
  const f = normFormat(rawFormat);
  if (f) $('#f-format').value = f;
  else { $('#f-format').value = /^\d+$/.test(text) ? 'CODE128' : 'QR'; toast('Formato ' + rawFormat + ' non riproducibile: scelto un formato alternativo, verificalo.', 5000); }
  updatePreview();
  updateChainHint();
  if (navigator.vibrate) navigator.vibrate(60);
  toast(chainSuggestion ? 'Codice letto ✔ Sembra una carta ' + chainSuggestion.name : 'Codice letto ✔');
}

async function startScanner() {
  $('#scanner').hidden = false;
  $('#scanner-msg').textContent = 'Inquadra il codice a barre';
  const video = $('#scanner-video');
  try {
    const det = await nativeDetector();
    if (det) {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment', width: { ideal: 1280 } }, audio: false });
      video.srcObject = stream; await video.play();
      scanner = { stream };
      let last = 0;
      const loop = async (t) => {
        if (!scanner) return;
        if (t - last > 200 && video.readyState >= 2) {
          last = t;
          try { const r = await det.detect(video); if (r.length) { const frame = grabFrame(video); onScanResult(r[0].rawValue, r[0].format); return readBrandFrom(frame); } } catch {}
        }
        scanner.raf = requestAnimationFrame(loop);
      };
      scanner.raf = requestAnimationFrame(loop);
    } else {
      await loadZXing();
      const reader = new ZXing.BrowserMultiFormatReader();
      scanner = { reader };
      await reader.decodeFromConstraints({ video: { facingMode: 'environment' }, audio: false }, video, (res) => {
        if (res && scanner) { const frame = grabFrame(video); onScanResult(res.getText(), ZXing.BarcodeFormat[res.getBarcodeFormat()]); readBrandFrom(frame); }
      });
    }
  } catch (err) {
    stopScanner();
    toast('Fotocamera non disponibile: ' + (err && err.name === 'NotAllowedError' ? 'permesso negato' : (err.message || err)), 5000);
  }
}
function stopScanner() {
  if (scanner) {
    if (scanner.raf) cancelAnimationFrame(scanner.raf);
    if (scanner.stream) scanner.stream.getTracks().forEach((t) => t.stop());
    if (scanner.reader) try { scanner.reader.reset(); } catch {}
  }
  scanner = null;
  const v = $('#scanner-video'); if (v.srcObject) { v.srcObject.getTracks().forEach((t) => t.stop()); v.srcObject = null; }
  $('#scanner').hidden = true;
}

function grabFrame(src, max = 1600) {
  const w = src.videoWidth || src.width, h = src.videoHeight || src.height;
  if (!w || !h) return null;
  const s = Math.min(1, max / Math.max(w, h));
  const cv = document.createElement('canvas');
  cv.width = Math.round(w * s); cv.height = Math.round(h * s);
  cv.getContext('2d').drawImage(src, 0, 0, cv.width, cv.height);
  return cv;
}
async function scanFromPhoto(file) {
  let cv;
  try { cv = grabFrame(await createImageBitmap(file)); } catch { return toast('Impossibile leggere la foto'); }
  let found = false;
  try {
    const det = await nativeDetector();
    if (det) {
      const r = await det.detect(cv);
      if (r.length) { onScanResult(r[0].rawValue, r[0].format); found = true; }
    } else {
      await loadZXing();
      const reader = new ZXing.BrowserMultiFormatReader(new Map([[ZXing.DecodeHintType.TRY_HARDER, true]]));
      try {
        const res = await reader.decodeFromImageUrl(cv.toDataURL('image/png'));
        onScanResult(res.getText(), ZXing.BarcodeFormat[res.getBarcodeFormat()]); found = true;
      } catch {}
    }
  } catch {}
  if (!found) toast('Nessun codice trovato nella foto: cerco almeno il nome', 4000);
  readBrandFrom(cv);
}

/* ---------- Nome del negozio letto dalla foto (OCR locale con Tesseract) ---------- */
let ocrWorker = null, ocrRun = 0;
async function getOcr() {
  if (ocrWorker) return ocrWorker;
  if (!window.Tesseract) {
    await new Promise((res, rej) => { const s = document.createElement('script'); s.src = 'vendor/tesseract/tesseract.min.js'; s.onload = res; s.onerror = rej; document.head.append(s); });
  }
  const base = new URL('vendor/tesseract/', location.href).href;
  ocrWorker = await Tesseract.createWorker('ita', 1, {
    workerPath: base + 'worker.min.js', corePath: base + 'core', langPath: base + 'lang',
    workerBlobURL: false, gzip: true, cacheMethod: 'none'
  });
  return ocrWorker;
}
function lev(a, b) {
  if (Math.abs(a.length - b.length) > 1) return 9;
  const d = Array.from({ length: a.length + 1 }, (_, i) => [i]);
  for (let j = 1; j <= b.length; j++) d[0][j] = j;
  for (let i = 1; i <= a.length; i++) for (let j = 1; j <= b.length; j++)
    d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
  return d[a.length][b.length];
}
/** Cerca nel testo letto una catena dell'elenco o il nome di una carta già salvata. */
function brandFromText(text) {
  const tokens = String(text).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').split(/[^a-z0-9]+/).filter(Boolean);
  const joined = tokens.join('');
  const cands = [];
  for (const c of S.data.cards) cands.push({ name: c.name, color: c.color, keys: [norm(c.name)] });
  for (const c of CHAIN_LIST) cands.push({ name: c.n, color: c.c, keys: [c.key, ...c.k] });
  let best = null, bestLen = 0;
  for (const c of cands) {
    for (const k of c.keys) {
      if (!k || k.length < 3) continue;
      const hit = k.length >= 6
        ? joined.includes(k) || tokens.some((t) => t.length >= 5 && lev(t, k) <= 1)
        : tokens.includes(k);
      if (hit && k.length > bestLen) { best = c; bestLen = k.length; }
    }
  }
  return best ? { name: best.name, color: best.color, why: 'foto' } : null;
}
function ocrStatus(msg) { const el = $('#ocr-status'); el.textContent = msg || ''; el.hidden = !msg; }
/** Prepara l'immagine per l'OCR: scala di grigi e dimensione moderata (le scritte enormi vengono lette male). */
function ocrImage(src, max, invert) {
  const cv = grabFrame(src, max); const x = cv.getContext('2d');
  const id = x.getImageData(0, 0, cv.width, cv.height); const d = id.data;
  for (let i = 0; i < d.length; i += 4) { let g = 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2]; if (invert) g = 255 - g; d[i] = d[i + 1] = d[i + 2] = g; }
  x.putImageData(id, 0, 0);
  return cv;
}
const OCR_GENERIC = /^(carta|card|fedelta|fidelity|socio|soci|club|member|membership|tessera|punti|premium|gold|plus|cliente|clienti|loyalty|valida|www|http|https)$/;
/** Scritta più grande della carta (probabile nome del negozio), se non è in elenco. */
function biggestLine(data) {
  let best = null;
  for (const bl of data.blocks || []) for (const pa of bl.paragraphs || []) for (const li of pa.lines || []) {
    const words = li.words.filter((w) => w.confidence > 60 && /[A-Za-zÀ-ÿ]{2,}/.test(w.text) && !OCR_GENERIC.test(norm(w.text)));
    const text = words.map((w) => w.text).join(' ').replace(/[^\p{L}\p{N}&' .-]/gu, '').trim();
    if (text.replace(/[^\p{L}]/gu, '').length < 3 || text.length > 30) continue;
    const h = li.bbox.y1 - li.bbox.y0;
    if (!best || h > best.h) best = { text, h };
  }
  return best ? best.text : null;
}
async function readBrandFrom(canvas) {
  if (!canvas) return;
  const run = ++ocrRun;
  const firstTime = !ocrWorker;
  ocrStatus('🔎 Cerco il nome del negozio nella foto…' + (firstTime ? ' (la prima volta può richiedere qualche secondo)' : ''));
  try {
    const w = await getOcr();
    let match = null, guess = null;
    for (const [max, inv] of [[1000, false], [640, false], [1000, true]]) {
      const { data } = await w.recognize(ocrImage(canvas, max, inv), {}, { text: true, blocks: true });
      if (run !== ocrRun) return;
      match = brandFromText(data.text || '');
      if (match) break;
      if (!guess) guess = biggestLine(data);
    }
    if ($('#view-edit').hidden) return;
    ocrStatus('');
    const nameEmpty = !$('#f-name').value.trim();
    if (match && nameEmpty) { applyChain(match); toast('Nome trovato nella foto: ' + match.name, 3500); return; }
    const sug = match || (guess ? { name: guess, color: null, why: 'foto' } : null);
    if (sug && norm(sug.name) !== norm($('#f-name').value)) {
      chainSuggestion = sug; $('#chain-hint-name').textContent = sug.name; $('#chain-hint').hidden = false;
    } else if (!sug) toast('Nome del negozio non riconosciuto: scrivilo tu', 3500);
  } catch (e) {
    if (run === ocrRun) ocrStatus('');
    if (!navigator.onLine && firstTime) toast('La lettura del nome richiede internet la prima volta', 4000);
  }
}
$('#scan-photo').addEventListener('change', (e) => { const f = e.target.files[0]; e.target.value = ''; if (f) scanFromPhoto(f); });

/* ---------- Impostazioni ---------- */
async function renderSettings() {
  const lb = S.data.meta.lastBackup;
  $('#last-backup').textContent = lb ? `Ultimo backup: ${fmtDate(lb.date)} (${lb.where})` : 'Nessun backup ancora eseguito.';
  $('#app-version').textContent = 'Versione ' + APP_VERSION + ' · ' + S.data.cards.length + ' carte';
  $('#btn-backup-pw').textContent = (await DB.get('backupkey')) ? '🔑 Cambia password di backup' : '🔑 Imposta password di backup';
}

async function markBackup(where) {
  S.data.meta.lastBackup = { date: new Date().toISOString(), where };
  await persist();
  if (!$('#view-settings').hidden) renderSettings();
}

/* ---------- Backup su file ---------- */
async function backupShare() {
  const backup = await makeBackup();
  if (!backup) return;
  const name = `fidup-backup-${today()}.json`;
  const file = new File([JSON.stringify(backup)], name, { type: 'application/json' });
  try {
    if (navigator.canShare && navigator.canShare({ files: [file] })) {
      await navigator.share({ files: [file], title: 'Backup FidUP!' });
      toast('Backup condiviso');
    } else {
      const a = document.createElement('a');
      a.href = URL.createObjectURL(file); a.download = name; document.body.append(a); a.click();
      setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
      toast('Backup scaricato');
    }
    await markBackup('file');
  } catch (e) { if (e.name !== 'AbortError') toast('Errore: ' + e.message); }
}

function pickRestoreFile() {
  const inp = $('#restore-input'); inp.value = ''; inp.click();
}
$('#restore-input').addEventListener('change', async (e) => {
  const f = e.target.files[0]; if (!f) return;
  if (f.size > 20 * 1024 * 1024) return toast('File troppo grande');
  try { await restoreFromBackup(JSON.parse(await f.text()), 'file'); }
  catch (err) { toast(err.message || 'File non valido', 4000); }
});

/** Ripristino comune (file o cloud). */
async function restoreFromBackup(backup, source) {
  validateBackup(backup);
  const r = await ask({ title: 'Password di backup', text: 'Inserisci la password con cui è stato creato il backup.', fields: [{ id: 'pw', type: 'password', placeholder: 'Password' }], ok: 'Decifra' });
  if (!r) return;
  let opened;
  try { opened = await openBackup(backup, r.pw); } catch (e) { toast(e.message, 4000); return; }

  if (S.data.cards.length === 0) {
    S.data.cards = opened.data.cards;
  } else {
    const choice = await ask({
      title: `Backup con ${opened.data.cards.length} carte`,
      text: 'Unisci: aggiunge le carte del backup a quelle attuali (tiene la versione più recente). Sostituisci: elimina le carte attuali.',
      ok: 'Unisci', cancel: 'Altre opzioni'
    });
    if (choice) {
      const map = new Map(S.data.cards.map((c) => [c.id, c]));
      for (const c of opened.data.cards) {
        const cur = map.get(c.id);
        if (!cur || (c.updatedAt || '') > (cur.updatedAt || '')) map.set(c.id, c);
      }
      S.data.cards = [...map.values()];
    } else {
      const rep = await ask({ title: 'Sostituire tutte le carte?', text: 'Le carte attuali verranno eliminate e sostituite da quelle del backup.', ok: 'Sostituisci', danger: true });
      if (!rep) return;
      S.data.cards = opened.data.cards;
    }
  }
  // se su questo telefono non c'è ancora una password di backup, usa quella appena inserita
  if (!(await DB.get('backupkey'))) await DB.set('backupkey', { key: opened.key, salt: backup.kdf.salt, iterations: backup.kdf.iterations });
  await persist();
  toast(`Ripristino completato: ${S.data.cards.length} carte (${source})`);
  history.replaceState({ view: 'list' }, ''); renderView('list');
}

/* ---------- Cloud (Google Drive / OneDrive) via OAuth2 nel browser ---------- */
const REDIRECT_URI = location.origin + location.pathname;
const Cloud = {
  google: {
    label: 'Google Drive',
    enabled: () => !!CFG.googleClientId,
    async authorize() {
      const state = b64url(rnd(16));
      sessionStorage.setItem('oauth_state', state);
      const p = new URLSearchParams({
        client_id: CFG.googleClientId, redirect_uri: REDIRECT_URI, response_type: 'token', state,
        scope: 'https://www.googleapis.com/auth/drive.file', include_granted_scopes: 'true', prompt: 'select_account'
      });
      location.assign('https://accounts.google.com/o/oauth2/v2/auth?' + p);
    },
    async api(token, url, opts = {}) {
      const r = await fetch(url, Object.assign({}, opts, { headers: Object.assign({ Authorization: 'Bearer ' + token }, opts.headers || {}) }));
      if (r.status === 401) { clearToken('google'); throw new Error('Sessione Google scaduta, riprova'); }
      if (!r.ok) throw new Error('Google Drive: errore ' + r.status);
      return r;
    },
    async find(token) {
      const q = encodeURIComponent(`name='${CFG.cloudFileName}' and trashed=false`);
      const r = await this.api(token, `https://www.googleapis.com/drive/v3/files?q=${q}&spaces=drive&orderBy=modifiedTime desc&fields=files(id,modifiedTime)`);
      return (await r.json()).files[0] || null;
    },
    async upload(token, body) {
      const existing = await this.find(token);
      if (existing) {
        await this.api(token, `https://www.googleapis.com/upload/drive/v3/files/${existing.id}?uploadType=media`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body });
      } else {
        const boundary = 'b' + b64url(rnd(12));
        const meta = JSON.stringify({ name: CFG.cloudFileName, mimeType: 'application/json' });
        const multipart = `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${meta}\r\n--${boundary}\r\nContent-Type: application/json\r\n\r\n${body}\r\n--${boundary}--`;
        await this.api(token, 'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart', { method: 'POST', headers: { 'Content-Type': 'multipart/related; boundary=' + boundary }, body: multipart });
      }
    },
    async download(token) {
      const f = await this.find(token);
      if (!f) throw new Error('Nessun backup trovato su Google Drive');
      return (await this.api(token, `https://www.googleapis.com/drive/v3/files/${f.id}?alt=media`)).json();
    }
  },
  microsoft: {
    label: 'OneDrive',
    enabled: () => !!CFG.microsoftClientId,
    async authorize() {
      const state = b64url(rnd(16));
      const verifier = b64url(rnd(32));
      const challenge = b64url(await crypto.subtle.digest('SHA-256', enc.encode(verifier)));
      sessionStorage.setItem('oauth_state', state);
      sessionStorage.setItem('pkce_verifier', verifier);
      const p = new URLSearchParams({
        client_id: CFG.microsoftClientId, redirect_uri: REDIRECT_URI, response_type: 'code', response_mode: 'query',
        scope: 'Files.ReadWrite.AppFolder', state, code_challenge: challenge, code_challenge_method: 'S256', prompt: 'select_account'
      });
      location.assign('https://login.microsoftonline.com/common/oauth2/v2.0/authorize?' + p);
    },
    async exchange(code) {
      const body = new URLSearchParams({
        client_id: CFG.microsoftClientId, grant_type: 'authorization_code', code, redirect_uri: REDIRECT_URI,
        code_verifier: sessionStorage.getItem('pkce_verifier') || '', scope: 'Files.ReadWrite.AppFolder'
      });
      sessionStorage.removeItem('pkce_verifier');
      const r = await fetch('https://login.microsoftonline.com/common/oauth2/v2.0/token', { method: 'POST', body });
      const j = await r.json();
      if (!r.ok) throw new Error('Login Microsoft fallito: ' + (j.error_description || j.error || r.status));
      return j;
    },
    url() { return `https://graph.microsoft.com/v1.0/me/drive/special/approot:/${encodeURIComponent(CFG.cloudFileName)}`; },
    async api(token, url, opts = {}) {
      const r = await fetch(url, Object.assign({}, opts, { headers: Object.assign({ Authorization: 'Bearer ' + token }, opts.headers || {}) }));
      if (r.status === 401) { clearToken('microsoft'); throw new Error('Sessione Microsoft scaduta, riprova'); }
      if (r.status === 404) throw new Error('Nessun backup trovato su OneDrive');
      if (!r.ok) throw new Error('OneDrive: errore ' + r.status);
      return r;
    },
    async upload(token, body) {
      await this.api(token, this.url() + ':/content', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body });
    },
    async download(token) {
      const meta = await (await this.api(token, this.url())).json();
      const dl = meta['@microsoft.graph.downloadUrl'];
      if (!dl) throw new Error('OneDrive: link di download non disponibile');
      const r = await fetch(dl);
      if (!r.ok) throw new Error('OneDrive: download fallito');
      return r.json();
    }
  }
};

function getToken(p) {
  try {
    const t = JSON.parse(sessionStorage.getItem('tok_' + p) || 'null');
    return t && t.exp > Date.now() + 60000 ? t.token : null;
  } catch { return null; }
}
function setToken(p, token, expiresIn) { sessionStorage.setItem('tok_' + p, JSON.stringify({ token, exp: Date.now() + (Number(expiresIn) || 3000) * 1000 })); }
function clearToken(p) { sessionStorage.removeItem('tok_' + p); }

async function cloudAction(provider, action) {
  const P = Cloud[provider];
  if (!P.enabled()) {
    await ask({ title: P.label + ' non configurato', text: `Per il collegamento diretto serve un ID client in config.js (vedi README). In alternativa usa "Esporta backup" e scegli ${P.label} dal foglio di condivisione / "Salva su File".`, cancel: null });
    return;
  }
  const token = getToken(provider);
  if (!token) {
    sessionStorage.setItem('pending_cloud', JSON.stringify({ provider, action }));
    toast('Reindirizzamento a ' + P.label + '…');
    return P.authorize();
  }
  try {
    if (action === 'backup') {
      const backup = await makeBackup();
      if (!backup) return;
      toast('Caricamento su ' + P.label + '…');
      await P.upload(token, JSON.stringify(backup));
      await markBackup(P.label);
      toast('Backup salvato su ' + P.label + ' ✔');
    } else {
      toast('Download da ' + P.label + '…');
      const backup = await P.download(token);
      await restoreFromBackup(backup, P.label);
    }
  } catch (e) { toast(e.message || String(e), 5000); }
}

/** Gestisce il ritorno dal login OAuth (redirect). */
async function handleOAuthReturn() {
  const hash = new URLSearchParams(location.hash.slice(1));
  const query = new URLSearchParams(location.search);
  const expected = sessionStorage.getItem('oauth_state');
  let handled = false;
  try {
    if (hash.get('access_token') || hash.get('error')) {
      handled = true;
      if (hash.get('error')) throw new Error('Accesso Google annullato');
      if (!expected || hash.get('state') !== expected) throw new Error('Stato OAuth non valido');
      setToken('google', hash.get('access_token'), hash.get('expires_in'));
    } else if (query.get('code') || query.get('error')) {
      handled = true;
      if (query.get('error')) throw new Error('Accesso Microsoft annullato');
      if (!expected || query.get('state') !== expected) throw new Error('Stato OAuth non valido');
      const j = await Cloud.microsoft.exchange(query.get('code'));
      setToken('microsoft', j.access_token, j.expires_in);
    }
  } catch (e) {
    sessionStorage.removeItem('pending_cloud');
    setTimeout(() => toast(e.message, 5000), 300);
  } finally {
    if (handled) {
      sessionStorage.removeItem('oauth_state');
      history.replaceState(null, '', REDIRECT_URI); // rimuove token/codice dall'URL
    }
  }
}
function runPendingCloud() {
  const pending = JSON.parse(sessionStorage.getItem('pending_cloud') || 'null');
  if (!pending || !getToken(pending.provider)) return;
  sessionStorage.removeItem('pending_cloud');
  cloudAction(pending.provider, pending.action);
}

/* ---------- Azioni ---------- */
async function wipe() {
  const r = await ask({ title: 'Cancellare tutto?', text: 'Scrivi CANCELLA per eliminare definitivamente tutte le carte e la password di backup da questo dispositivo. I backup già salvati non vengono toccati.', fields: [{ id: 'c', placeholder: 'CANCELLA' }], ok: 'Elimina', danger: true });
  if (!r || r.c.trim().toUpperCase() !== 'CANCELLA') return;
  await DB.del('store'); await DB.del('backupkey');
  sessionStorage.clear();
  S.data = normalizeData({});
  await persist();
  history.replaceState({ view: 'list' }, ''); renderView('list');
  toast('Dati cancellati');
}

document.addEventListener('click', async (e) => {
  const b = e.target.closest('[data-action]');
  if (!b) return;
  const a = b.dataset.action;
  switch (a) {
    case 'new': S.editingId = null; go('edit'); break;
    case 'edit': S.editingId = S.currentId; go('edit'); break;
    case 'back': case 'cancel-edit': history.back(); break;
    case 'settings': go('settings'); break;
    case 'scan': startScanner(); break;
    case 'close-scan': stopScanner(); break;
    case 'delete': {
      const c = S.data.cards.find((x) => x.id === S.editingId);
      if (!c || !(await ask({ title: 'Eliminare "' + c.name + '"?', ok: 'Elimina', danger: true }))) return;
      S.data.cards = S.data.cards.filter((x) => x.id !== c.id);
      await persist();
      toast('Carta eliminata');
      history.replaceState({ view: 'list' }, ''); renderView('list');
      break;
    }
    case 'backup-share': backupShare(); break;
    case 'restore-file': pickRestoreFile(); break;
    case 'cloud-backup': cloudAction(b.dataset.provider, 'backup'); break;
    case 'cloud-restore': cloudAction(b.dataset.provider, 'restore'); break;
    case 'backup-pw':
      if (await askNewBackupPassword('Nuova password di backup')) { toast('Password di backup salvata. I prossimi backup useranno questa.', 4000); renderSettings(); }
      break;
    case 'wipe': wipe(); break;
    case 'migrate-reset': {
      const ok = await ask({ title: 'Ricominciare da zero?', text: 'Le carte salvate con la vecchia versione verranno eliminate da questo telefono.', ok: 'Ricomincia', danger: true });
      if (!ok) return;
      await DB.del('vault');
      S.data = normalizeData({}); await persist(); enterApp();
      break;
    }
  }
});

/* Migrazione una tantum dalla versione 1.0 (che chiedeva una password all'apertura). */
$('#form-unlock').addEventListener('submit', async (e) => {
  e.preventDefault();
  const btn = e.submitter; if (btn) btn.disabled = true;
  $('#unlock-error').hidden = true;
  try {
    const old = await DB.get('vault');
    const { key, data } = await openBackup(old, $('#unlock-pw').value);
    S.data = data;
    await persist();
    // la vecchia password diventa la password di backup
    await DB.set('backupkey', { key, salt: old.kdf.salt, iterations: old.kdf.iterations });
    await DB.del('vault');
    $('#unlock-pw').value = '';
    toast('Aggiornamento completato: da ora l\'app si apre senza codice', 4000);
    enterApp();
  } catch (err) {
    $('#unlock-error').textContent = err.message; $('#unlock-error').hidden = false;
    $('#unlock-pw').select();
  } finally { if (btn) btn.disabled = false; }
});

function enterApp() {
  history.replaceState({ view: 'list' }, '');
  renderView('list');
  runPendingCloud();
}

/* ---------- Avvio ---------- */
(async function init() {
  if ('serviceWorker' in navigator) {
    // quando arriva una nuova versione, ricarica una volta per mostrarla subito
    const hadController = !!navigator.serviceWorker.controller;
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      if (hadController && !sessionStorage.getItem('sw_reloaded')) { sessionStorage.setItem('sw_reloaded', '1'); location.reload(); }
    });
    navigator.serviceWorker.register('sw.js', { updateViaCache: 'none' }).then((r) => r.update()).catch(() => {});
  }
  if (navigator.storage && navigator.storage.persist) navigator.storage.persist().catch(() => {});
  if (!window.isSecureContext || !crypto.subtle) {
    document.body.innerHTML = '<p style="padding:24px">Questa app richiede HTTPS (Web Crypto non disponibile).</p>';
    return;
  }
  await handleOAuthReturn();
  S.key = await getDeviceKey();
  const store = await DB.get('store');
  if (store) {
    try { S.data = normalizeData(await Crypto.decrypt(S.key, store.iv, store.ct)); }
    catch { S.data = normalizeData({}); toast('Impossibile leggere i dati salvati', 5000); }
  } else if (await DB.get('vault')) {
    showView('lock'); history.replaceState({ view: 'lock' }, '');
    return;
  } else {
    S.data = normalizeData({});
    await persist();
  }
  if (Install.needsGate()) return showGate();
  enterApp();
})();

/** iPhone nel browser: niente carte, solo installazione dell'app (profilo). */
function showGate() {
  const ua = navigator.userAgent;
  const n = S.data.cards.length;
  let which;
  if (Install.isInApp()) which = 'inapp';
  else if (/CriOS/.test(ua)) which = 'chrome';
  else if (/FxiOS|EdgiOS|OPiOS|DuckDuckGo|YaBrowser/.test(ua)) which = 'browser';
  else {
    // Safari: da iOS 26 (Safari 26) "Condividi" è dentro il menu ···
    const v = parseInt((ua.match(/Version\/(\d+)/) || [])[1] || '0', 10);
    which = v >= 26 || v === 0 ? 'safari-new' : 'safari-old';
  }
  ['safari-new', 'safari-old', 'chrome', 'browser', 'inapp'].forEach((k) => { $('#gate-' + k).hidden = k !== which; });
  $('#gate-legacy').hidden = n === 0;
  $('#gate-count').textContent = n === 1 ? '1 carta' : n + ' carte';
  showView('gate');
  history.replaceState({ view: 'gate' }, '');
}


/* ---------- Versione in basso al centro ---------- */
$('#version-footer').textContent = 'FidUP! v' + APP_VERSION;

/* ---------- Slogan: nome del dispositivo ---------- */
(function deviceWord() {
  const ua = navigator.userAgent;
  const ipad = /iPad/.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  let w = 'dispositivo';
  if (ipad) w = 'iPad';
  else if (/iPhone|iPod/.test(ua)) w = 'iPhone';
  else if (/Android/.test(ua)) w = /Mobile/.test(ua) ? 'smartphone' : 'tablet';
  document.querySelectorAll('.device-word').forEach((el) => { el.textContent = w; });
})();

/* ---------- Installazione come app ---------- */
const Install = {
  deferred: null,
  standalone() {
    // app installata: modalità standalone, oppure avviata con ?app=1 (profilo iPhone / manifest)
    const app = matchMedia('(display-mode: standalone)').matches || navigator.standalone === true
      || new URLSearchParams(location.search).get('app') === '1' || localStorage.getItem('is_app') === '1';
    if (app) localStorage.setItem('is_app', '1');
    return app;
  },
  isSafari: () => /Safari\//.test(navigator.userAgent) && !/CriOS|FxiOS|EdgiOS|OPiOS|GSA\/|DuckDuckGo|YaBrowser/.test(navigator.userAgent),
  needsGate() { return this.isIOS() && !this.standalone(); },
  isIOS: () => /iPhone|iPad|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1),
  isAndroid: () => /Android/.test(navigator.userAgent),
  isInApp: () => /FBAN|FBAV|Instagram|Line\/|LinkedInApp|GSA\/|TikTok|Snapchat/.test(navigator.userAgent),
  dismissed() { return Number(localStorage.getItem('install_dismissed') || 0) > Date.now() - 7 * 864e5; },
  render(force) {
    const banner = $('#install-banner');
    $('#settings-install').hidden = this.standalone();
    if (this.standalone() || (!force && this.dismissed())) { banner.hidden = true; return; }
    const show = new Set();
    if (this.isInApp()) show.add('inapp');
    else if (this.isIOS()) show.add(this.deferred ? 'prompt' : 'ios');
    else if (this.isAndroid()) show.add(this.deferred ? 'prompt' : 'android');
    else { show.add('desktop'); if (this.deferred) show.add('prompt'); } // computer: QR per lo smartphone (+ installazione sul computer se possibile)
    ['prompt', 'android', 'ios', 'inapp', 'desktop'].forEach((m) => { $('#install-' + m).hidden = !show.has(m); });
    $('#install-prompt button').textContent = show.has('desktop') ? '💻 Installa su questo computer' : '📲 Installa';
    banner.hidden = show.size === 0;
  }
};
window.addEventListener('beforeinstallprompt', (e) => { e.preventDefault(); Install.deferred = e; Install.render(); });
window.addEventListener('appinstalled', () => { Install.deferred = null; $('#install-banner').hidden = true; toast('FidUP! installata ✔ Aprila dalla schermata Home'); });
document.addEventListener('click', async (e) => {
  const b = e.target.closest('[data-action]');
  if (!b) return;
  switch (b.dataset.action) {
    case 'install':
      if (!Install.deferred) return;
      Install.deferred.prompt();
      await Install.deferred.userChoice.catch(() => {});
      Install.deferred = null; Install.render();
      break;
    case 'install-dismiss':
      localStorage.setItem('install_dismissed', String(Date.now()));
      $('#install-banner').hidden = true;
      break;
    case 'install-show':
      localStorage.removeItem('install_dismissed');
      history.back(); setTimeout(() => { Install.render(true); window.scrollTo(0, 0); }, 50);
      break;
    case 'copy-link':
      try { await navigator.clipboard.writeText(REDIRECT_URI); toast('Link copiato: incollalo in Safari o Chrome'); }
      catch { toast(REDIRECT_URI, 6000); }
      break;
  }
});
Install.render();
