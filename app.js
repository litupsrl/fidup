/* FidUP! — PWA con archivio cifrato locale (AES-256-GCM, chiave da PBKDF2-SHA256). */
'use strict';

const APP_VERSION = '1.0.0';
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

function validateVault(v) {
  if (!v || v.app !== 'fidup' || v.version !== 1 || !v.kdf || !v.iv || !v.ct) throw new Error('File non valido');
  const it = v.kdf.iterations;
  if (!Number.isInteger(it) || it < 100000 || it > 10000000) throw new Error('Parametri di cifratura non validi');
  return v;
}

/** Prova a decifrare un archivio con la password. Ritorna {key, data} o lancia errore. */
async function openVault(vault, password) {
  validateVault(vault);
  const key = await Crypto.deriveKey(password, unb64(vault.kdf.salt), vault.kdf.iterations);
  try {
    const data = await Crypto.decrypt(key, vault.iv, vault.ct);
    return { key, data: normalizeData(data) };
  } catch { throw new Error('Password errata'); }
}

function normalizeData(d) {
  d = d && typeof d === 'object' ? d : {};
  return {
    cards: Array.isArray(d.cards) ? d.cards.filter((c) => c && c.id && typeof c.name === 'string') : [],
    settings: Object.assign({ autoLock: 5 }, d.settings || {}),
    meta: Object.assign({}, d.meta || {})
  };
}

/* ---------- Stato ---------- */
const S = {
  key: null,       // CryptoKey non estraibile, solo in memoria
  vault: null,     // record cifrato {app, version, kdf, iv, ct, updatedAt}
  data: null,      // dati in chiaro (solo in memoria mentre sbloccato)
  currentId: null,
  editingId: null,
  hiddenAt: 0,
  suspendLock: false
};

async function persist() {
  const { iv, ct } = await Crypto.encrypt(S.key, S.data);
  S.vault = Object.assign({}, S.vault, { iv, ct, updatedAt: new Date().toISOString() });
  await DB.set('vault', S.vault);
}

async function createVault(password, data) {
  const salt = rnd(16);
  const key = await Crypto.deriveKey(password, salt, KDF_ITERATIONS);
  S.key = key; S.data = normalizeData(data);
  S.vault = { app: 'fidup', version: 1, kdf: { alg: 'PBKDF2-SHA256', iterations: KDF_ITERATIONS, salt: b64(salt) } };
  await persist();
}

function lock() {
  S.key = null; S.data = null; S.currentId = null; S.editingId = null;
  $('#card-list').replaceChildren();
  $('#detail-code').replaceChildren();
  stopScanner();
  document.querySelectorAll('dialog[open]').forEach((d) => d.close('cancel'));
  showView('lock');
  history.replaceState({ view: 'lock' }, '');
}

/* ---------- Navigazione ---------- */
const VIEWS = ['setup', 'lock', 'list', 'detail', 'edit', 'settings'];
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
  if (!S.key) return;
  if (name === 'list') renderList();
  if (name === 'detail') renderDetail();
  if (name === 'edit') renderEdit();
  if (name === 'settings') renderSettings();
  showView(name);
}
window.addEventListener('popstate', (e) => {
  if (!S.key) { history.replaceState({ view: 'lock' }, ''); return; }
  const v = (e.state && e.state.view) || 'list';
  renderView(['setup', 'lock'].includes(v) ? 'list' : v);
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
function safeColor(c) { return /^#[0-9a-f]{6}$/i.test(c || '') ? c : '#1e3a5f'; }

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
  $('#f-color').value = c ? safeColor(c.color) : randomColor();
  $('#f-note').value = c ? (c.note || '') : '';
  $('#btn-delete').hidden = !c;
  updatePreview();
}
function randomColor() {
  const pal = ['#1e3a5f', '#b91c1c', '#047857', '#7c3aed', '#c2410c', '#0f766e', '#be185d', '#374151', '#a16207', '#1d4ed8'];
  return pal[Math.floor(Math.random() * pal.length)];
}
function updatePreview() { renderCode($('#edit-preview'), $('#f-number').value.trim(), $('#f-format').value, false); }
['#f-number', '#f-format'].forEach((s) => $(s).addEventListener('input', updatePreview));

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
  if (navigator.vibrate) navigator.vibrate(60);
  toast('Codice letto ✔');
}

async function startScanner() {
  S.suspendLock = true;
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
          try { const r = await det.detect(video); if (r.length) return onScanResult(r[0].rawValue, r[0].format); } catch {}
        }
        scanner.raf = requestAnimationFrame(loop);
      };
      scanner.raf = requestAnimationFrame(loop);
    } else {
      await loadZXing();
      const reader = new ZXing.BrowserMultiFormatReader();
      scanner = { reader };
      await reader.decodeFromConstraints({ video: { facingMode: 'environment' }, audio: false }, video, (res) => {
        if (res && scanner) onScanResult(res.getText(), ZXing.BarcodeFormat[res.getBarcodeFormat()]);
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
  S.suspendLock = false;
}

async function scanFromPhoto(file) {
  try {
    const bmp = await createImageBitmap(file);
    const det = await nativeDetector();
    if (det) {
      const r = await det.detect(bmp);
      if (r.length) return onScanResult(r[0].rawValue, r[0].format);
    } else {
      await loadZXing();
      // ridimensiona: le foto grandi rallentano/peggiorano la lettura
      const scale = Math.min(1, 1600 / Math.max(bmp.width, bmp.height));
      const cv = document.createElement('canvas');
      cv.width = Math.round(bmp.width * scale); cv.height = Math.round(bmp.height * scale);
      cv.getContext('2d').drawImage(bmp, 0, 0, cv.width, cv.height);
      const hints = new Map([[ZXing.DecodeHintType.TRY_HARDER, true]]);
      const reader = new ZXing.BrowserMultiFormatReader(hints);
      const url = cv.toDataURL('image/png');
      try {
        const res = await reader.decodeFromImageUrl(url);
        return onScanResult(res.getText(), ZXing.BarcodeFormat[res.getBarcodeFormat()]);
      } catch {}
    }
    toast('Nessun codice trovato nella foto', 4000);
  } catch (e) { toast('Impossibile leggere la foto'); }
}
$('#scan-photo').addEventListener('change', (e) => { const f = e.target.files[0]; e.target.value = ''; S.suspendLock = false; if (f) scanFromPhoto(f); });
$('#scan-photo').addEventListener('click', () => { S.suspendLock = true; });

/* ---------- Impostazioni ---------- */
function renderSettings() {
  $('#s-autolock').value = String(S.data.settings.autoLock);
  const lb = S.data.meta.lastBackup;
  $('#last-backup').textContent = lb ? `Ultimo backup: ${fmtDate(lb.date)} (${lb.where})` : 'Nessun backup ancora eseguito.';
  $('#app-version').textContent = 'Versione ' + APP_VERSION + ' · ' + S.data.cards.length + ' carte';
}
$('#s-autolock').addEventListener('change', async (e) => { S.data.settings.autoLock = Number(e.target.value); await persist(); toast('Salvato'); });

async function markBackup(where) {
  S.data.meta.lastBackup = { date: new Date().toISOString(), where };
  await persist();
  if (!$('#view-settings').hidden) renderSettings();
}

/* ---------- Backup su file ---------- */
function backupBlob() { return new Blob([JSON.stringify(S.vault)], { type: 'application/json' }); }

async function backupShare() {
  await markBackup('file'); // aggiorna prima, così il file contiene anche la data del backup
  const name = `fidup-backup-${today()}.json`;
  const file = new File([backupBlob()], name, { type: 'application/json' });
  S.suspendLock = true;
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
  } catch (e) { if (e.name !== 'AbortError') toast('Errore: ' + e.message); }
  finally { S.suspendLock = false; }
}

function pickRestoreFile() {
  S.suspendLock = true;
  const inp = $('#restore-input'); inp.value = ''; inp.click();
}
$('#restore-input').addEventListener('change', async (e) => {
  S.suspendLock = false;
  const f = e.target.files[0]; if (!f) return;
  if (f.size > 20 * 1024 * 1024) return toast('File troppo grande');
  try { await restoreFromVault(JSON.parse(await f.text()), 'file'); }
  catch (err) { toast(err.message || 'File non valido', 4000); }
});

/** Ripristino comune (file o cloud). */
async function restoreFromVault(vault, source) {
  validateVault(vault);
  const r = await ask({ title: 'Password del backup', text: 'Inserisci la password con cui è stato creato il backup.', fields: [{ id: 'pw', type: 'password', placeholder: 'Password' }], ok: 'Decifra' });
  if (!r) return;
  let opened;
  try { opened = await openVault(vault, r.pw); } catch (e) { toast(e.message, 4000); return; }

  if (!S.key) {
    // nuovo dispositivo / archivio vuoto: adotta direttamente l'archivio del backup
    S.key = opened.key; S.data = opened.data; S.vault = vault;
    await DB.set('vault', vault);
    await persist();
    toast(`Ripristinate ${S.data.cards.length} carte`);
    enterApp();
    return;
  }
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
    const rep = await ask({ title: 'Sostituire tutte le carte?', text: 'Le carte attuali verranno eliminate e sostituite da quelle del backup. La password resta quella attuale.', ok: 'Sostituisci', danger: true });
    if (!rep) return;
    S.data.cards = opened.data.cards;
  }
  await persist();
  toast('Ripristino completato (' + source + ')');
  renderView('list'); history.replaceState({ view: 'list' }, '');
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
      if (!S.key) throw new Error('Sblocca prima l\'app');
      await markBackup(P.label);
      toast('Caricamento su ' + P.label + '…');
      await P.upload(token, JSON.stringify(S.vault));
      toast('Backup salvato su ' + P.label + ' ✔');
    } else {
      toast('Download da ' + P.label + '…');
      const vault = await P.download(token);
      await restoreFromVault(vault, P.label);
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
  if (pending.action === 'backup' && !S.key) return; // aspetta lo sblocco
  sessionStorage.removeItem('pending_cloud');
  cloudAction(pending.provider, pending.action);
}

/* ---------- Azioni ---------- */
async function changePassword() {
  const r = await ask({ title: 'Cambia password', fields: [
    { id: 'old', type: 'password', placeholder: 'Password attuale' },
    { id: 'n1', type: 'password', placeholder: 'Nuova password (min. 8)' },
    { id: 'n2', type: 'password', placeholder: 'Ripeti nuova password' }] });
  if (!r) return;
  if (r.n1.length < 8) return toast('La nuova password deve avere almeno 8 caratteri');
  if (r.n1 !== r.n2) return toast('Le password non coincidono');
  try { await openVault(S.vault, r.old); } catch { return toast('Password attuale errata'); }
  await createVault(r.n1, S.data);
  toast('Password cambiata. Ricorda di rifare il backup.', 4000);
}

async function wipe() {
  const r = await ask({ title: 'Cancellare tutto?', text: 'Scrivi CANCELLA per eliminare definitivamente tutte le carte da questo dispositivo. I backup già salvati non vengono toccati.', fields: [{ id: 'c', placeholder: 'CANCELLA' }], ok: 'Elimina', danger: true });
  if (!r || r.c.trim().toUpperCase() !== 'CANCELLA') return;
  await DB.del('vault');
  sessionStorage.clear();
  S.key = null; S.data = null; S.vault = null;
  showView('setup');
  history.replaceState({ view: 'setup' }, '');
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
    case 'lock': lock(); break;
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
    case 'change-pw': changePassword(); break;
    case 'wipe': wipe(); break;
  }
});

$('#form-setup').addEventListener('submit', async (e) => {
  e.preventDefault();
  const p1 = $('#setup-pw').value, p2 = $('#setup-pw2').value;
  if (p1.length < 8) return toast('Almeno 8 caratteri');
  if (p1 !== p2) return toast('Le password non coincidono');
  const btn = e.submitter; if (btn) btn.disabled = true;
  try { await createVault(p1, {}); $('#form-setup').reset(); enterApp(); }
  finally { if (btn) btn.disabled = false; }
});

$('#form-unlock').addEventListener('submit', async (e) => {
  e.preventDefault();
  const btn = e.submitter; if (btn) btn.disabled = true;
  $('#unlock-error').hidden = true;
  try {
    const { key, data } = await openVault(S.vault, $('#unlock-pw').value);
    S.key = key; S.data = data;
    $('#unlock-pw').value = '';
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

/* ---------- Blocco automatico ---------- */
document.addEventListener('visibilitychange', () => {
  if (!S.key) return;
  if (document.hidden) {
    S.hiddenAt = Date.now();
    if (S.data.settings.autoLock === 0 && !S.suspendLock) lock();
  } else if (S.hiddenAt && !S.suspendLock) {
    const mins = S.data.settings.autoLock;
    if (Date.now() - S.hiddenAt >= mins * 60000) lock();
    S.hiddenAt = 0;
  }
});

/* ---------- Avvio ---------- */
(async function init() {
  if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js').catch(() => {});
  if (navigator.storage && navigator.storage.persist) navigator.storage.persist().catch(() => {});
  if (!window.isSecureContext || !crypto.subtle) {
    document.body.innerHTML = '<p style="padding:24px">Questa app richiede HTTPS (Web Crypto non disponibile).</p>';
    return;
  }
  await handleOAuthReturn();
  S.vault = await DB.get('vault');
  if (S.vault) { showView('lock'); history.replaceState({ view: 'lock' }, ''); }
  else { showView('setup'); history.replaceState({ view: 'setup' }, ''); runPendingCloud(); }
})();
