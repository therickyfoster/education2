/*
  Forge Overlay — Cross‑Platform Core v0.1
  Single-file header script for a mythic, zero‑harm, offline‑first gamification layer.
  Paste into any webpage (as a module) or bundle in Electron/Capacitor/WebView shells.

  Goals:
  - Cross‑platform (Web/PWA/Electron/Android/iOS/Linux/Win/Mac) via one header.
  - Append‑only, tamper‑evident local progress log (hash‑chained entries) in IndexedDB.
  - Micro‑progress capture: every tiny action is logged (low overhead, backoff timers).
  - Tiny overlay UI: XP, Streak, Log button, and Sync/Export menu.
  - No network required; optional export/import for federated ranks later.

  Usage (HTML):
  <script type="module" src="/forge-overlay-core.js"></script>
  <script type="module">Forge.init({ profileId: "ricky:local", appId: "education", ui: true });</script>

  Public API:
    Forge.init(options)
    Forge.log(type, data)
    Forge.getState() => {xp, streak, lastHash, ...}
    Forge.exportLog() => Promise<{entries, rootHash, summary}>
    Forge.importLog(json) => Promise<{ok, merged}>
    Forge.verify() => Promise<{ok, errorIndex}>

  Notes:
  - “Tamper‑evident” != unhackable. Client‑side can’t be truly tamper‑proof; we ensure manipulation is detectable by linking entries with SHA‑256 over (prevHash+payload+timestamp+nonce).
  - Later, you can anchor root hashes to a public chain/IPFS/OTS for stronger guarantees.
*/

// Minimal helpers -----------------------------------------------------------
const _sleep = (ms) => new Promise(r => setTimeout(r, ms));

async function sha256Hex(str) {
  if (window.crypto && window.crypto.subtle) {
    const enc = new TextEncoder();
    const buf = await crypto.subtle.digest('SHA-256', enc.encode(str));
    const bytes = Array.from(new Uint8Array(buf));
    return bytes.map(b => b.toString(16).padStart(2, '0')).join('');
  } else {
    // Fallback (weaker): XOR rolling hash – only used on very old browsers.
    // Prefer to polyfill SubtleCrypto in production.
    let h = 0; for (let i=0;i<str.length;i++) h = (h ^ str.charCodeAt(i)) >>> 0;
    return ('00000000'+h.toString(16)).slice(-8).padEnd(64, '0');
  }
}

// IndexedDB tiny wrapper ----------------------------------------------------
const DB_NAME = 'forge_overlay_v1';
const STORE = 'events';
const META = 'meta';

function openDB() {
  return new Promise((resolve, reject) => {
    if (!('indexedDB' in window)) {
      resolve(null); // signal fallback
      return;
    }
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) {
        db.createObjectStore(STORE, { keyPath: 'id', autoIncrement: true });
      }
      if (!db.objectStoreNames.contains(META)) {
        db.createObjectStore(META);
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function idbPut(db, storeName, value, key) {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, 'readwrite');
    const store = tx.objectStore(storeName);
    const req = key !== undefined ? store.put(value, key) : store.put(value);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}
async function idbGet(db, storeName, key) {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, 'readonly');
    const store = tx.objectStore(storeName);
    const req = store.get(key);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}
async function idbGetAll(db, storeName) {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, 'readonly');
    const store = tx.objectStore(storeName);
    const req = store.getAll();
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

// LocalStorage fallback (rare) ----------------------------------------------
const LS_KEY_EVENTS = 'forge_events_v1';
const LS_KEY_META   = 'forge_meta_v1';

function lsRead(key, def) {
  try { const v = localStorage.getItem(key); return v ? JSON.parse(v) : def; } catch { return def; }
}
function lsWrite(key, val) { try { localStorage.setItem(key, JSON.stringify(val)); } catch {} }

// Core engine ---------------------------------------------------------------
const Forge = (() => {
  let options = { appId: 'app', profileId: 'anon', ui: true };
  let db = null;
  let lastHash = 'GENESIS';
  let state = { xp: 0, streak: 0, lastAt: 0, events: 0, rootHash: 'GENESIS' };
  let idleTimer = null;
  let heartbeat = null;

  function now() { return new Date().toISOString(); }

  function injectCSS() {
    const css = `
    .forge-bubble{position:fixed;right:12px;bottom:12px;z-index:2147483000;background:rgba(20,20,25,.9);color:#fff;padding:10px 12px;border-radius:16px;backdrop-filter:blur(8px);box-shadow:0 8px 24px rgba(0,0,0,.35);font-family:system-ui,Segoe UI,Roboto,Inter,sans-serif}
    .forge-bubble *{font-size:12px;line-height:1.2}
    .forge-row{display:flex;gap:8px;align-items:center}
    .forge-pill{background:#2b2f3a;border-radius:999px;padding:4px 8px}
    .forge-btn{cursor:pointer;border:0;border-radius:10px;padding:6px 8px;background:#4a7dff;color:#fff}
    .forge-menu{margin-top:8px;display:flex;gap:6px}
    `;
    const style = document.createElement('style');
    style.textContent = css; document.head.appendChild(style);
  }

  function renderUI() {
    if (!options.ui) return;
    injectCSS();
    const el = document.createElement('div');
    el.className = 'forge-bubble';
    el.innerHTML = `
      <div class="forge-row">
        <span class="forge-pill">XP <b id="forge-xp">0</b></span>
        <span class="forge-pill">Streak <b id="forge-streak">0</b></span>
        <button id="forge-log" class="forge-btn">Log</button>
      </div>
      <div class="forge-menu">
        <button id="forge-export" class="forge-btn">Export</button>
        <button id="forge-verify" class="forge-btn">Verify</button>
      </div>`;
    document.body.appendChild(el);
    el.querySelector('#forge-log').addEventListener('click', () => log('click', {path: location.pathname}));
    el.querySelector('#forge-export').addEventListener('click', async () => {
      const out = await api.exportLog();
      const blob = new Blob([JSON.stringify(out, null, 2)], {type:'application/json'});
      const url = URL.createObjectURL(blob);
      const a = Object.assign(document.createElement('a'), {href:url, download:`forge-log-${Date.now()}.json`});
      a.click();
      URL.revokeObjectURL(url);
    });
    el.querySelector('#forge-verify').addEventListener('click', async () => {
      const v = await api.verify();
      alert(v.ok ? 'Log verified ✅' : `Verification failed at index ${v.errorIndex}`);
    });
    updateUI();
  }

  function updateUI() {
    const xpEl = document.getElementById('forge-xp');
    const stEl = document.getElementById('forge-streak');
    if (xpEl) xpEl.textContent = String(state.xp);
    if (stEl) stEl.textContent = String(state.streak);
  }

  async function loadMeta() {
    if (db) {
      const meta = (await idbGet(db, META, 'state')) || {};
      Object.assign(state, meta.state || {});
      lastHash = meta.lastHash || 'GENESIS';
    } else {
      const meta = lsRead(LS_KEY_META, {});
      Object.assign(state, meta.state || {});
      lastHash = meta.lastHash || 'GENESIS';
    }
  }

  async function saveMeta() {
    const meta = { lastHash, state };
    if (db) await idbPut(db, META, meta, 'state');
    else lsWrite(LS_KEY_META, meta);
  }

  async function appendEvent(entry) {
    // Compute chained hash
    const payload = JSON.stringify(entry);
    const nonce = Math.random().toString(36).slice(2);
    const hash = await sha256Hex(lastHash + '|' + payload + '|' + nonce);
    const rec = { ...entry, prev: lastHash, nonce, hash };
    if (db) await idbPut(db, STORE, rec);
    else {
      const arr = lsRead(LS_KEY_EVENTS, []); arr.push(rec); lsWrite(LS_KEY_EVENTS, arr);
    }
    lastHash = hash; state.rootHash = hash; state.events++;
    await saveMeta();
    return rec;
  }

  async function rebuildFromZero() {
    // On init, derive lastHash/xp/streak from stored log
    let entries = [];
    if (db) entries = await idbGetAll(db, STORE);
    else entries = lsRead(LS_KEY_EVENTS, []);

    let ok = true, prev = 'GENESIS';
    let xp = 0, streak = 0, lastDay = null;

    for (let i=0;i<entries.length;i++) {
      const e = entries[i];
      const payload = JSON.stringify({type:e.type, data:e.data, t:e.t, appId:e.appId, profileId:e.profileId});
      const recomputed = await sha256Hex(e.prev + '|' + payload + '|' + e.nonce);
      if (e.prev !== prev || recomputed !== e.hash) { ok = false; break; }
      prev = e.hash;
      // Accrual rules (simple):
      if (e.type === 'xp') xp += (e.data && e.data.amount) || 1;
      if (e.type === 'heartbeat') xp += 0.1; // micro‑progress
      // Streak: daily presence
      const day = (e.t || '').slice(0,10);
      if (day && day !== lastDay) { streak += 1; lastDay = day; }
    }
    lastHash = prev; state.rootHash = prev; state.xp = Math.round(xp); state.streak = streak; state.events = entries.length;
    await saveMeta(); updateUI();
    return { ok };
  }

  async function log(type, data={}) {
    const entry = { type, data, t: now(), appId: options.appId, profileId: options.profileId };
    const rec = await appendEvent(entry);
    // Simple accrual for common events
    if (type === 'click' || type === 'quest:complete') state.xp += 1;
    updateUI();
    return rec;
  }

  function startHeartbeat() {
    if (heartbeat) clearInterval(heartbeat);
    heartbeat = setInterval(async () => {
      // Only when tab is visible to reduce noise
      if (document.visibilityState !== 'visible') return;
      await appendEvent({ type:'heartbeat', data:{path: location.pathname}, t: now(), appId: options.appId, profileId: options.profileId });
      state.xp += 0.1; updateUI();
    }, 15000); // every 15s -> micro‑progress
  }

  const api = {
    async init(opts={}) {
      options = { ...options, ...opts };
      db = await openDB();
      await loadMeta();
      await rebuildFromZero();
      if (typeof window !== 'undefined') {
        renderUI();
        startHeartbeat();
        window.addEventListener('visibilitychange', () => document.visibilityState==='visible' && log('focus', {path: location.pathname}));
        window.addEventListener('beforeunload', () => { /* flush best effort */ });
      }
      return api;
    },
    async log(type, data) { return log(type, data); },
    getState() { return JSON.parse(JSON.stringify({ ...state })); },
    async exportLog() {
      let entries = db ? await idbGetAll(db, STORE) : lsRead(LS_KEY_EVENTS, []);
      const summary = { appId: options.appId, profileId: options.profileId, entries: entries.length, xp: state.xp, streak: state.streak };
      return { entries, rootHash: state.rootHash, summary };
    },
    async importLog(json) {
      // Naive merge: append entries that extend current rootHash; otherwise keep separate branch (not stored here)
      if (!json || !json.entries) return { ok:false, merged:0 };
      let merged = 0; let prev = state.rootHash;
      for (const e of json.entries) {
        if (e.prev === prev) { // continues our chain
          if (db) await idbPut(db, STORE, e); else { const arr = lsRead(LS_KEY_EVENTS, []); arr.push(e); lsWrite(LS_KEY_EVENTS, arr); }
          prev = e.hash; merged++;
        } else {
          // skip divergent branches for now
        }
      }
      await rebuildFromZero();
      return { ok:true, merged };
    },
    async verify() {
      let entries = db ? await idbGetAll(db, STORE) : lsRead(LS_KEY_EVENTS, []);
      let prev = 'GENESIS';
      for (let i=0;i<entries.length;i++) {
        const e = entries[i];
        const payload = JSON.stringify({type:e.type, data:e.data, t:e.t, appId:e.appId, profileId:e.profileId});
        const recomputed = await sha256Hex(e.prev + '|' + payload + '|' + e.nonce);
        if (e.prev !== prev || recomputed !== e.hash) return { ok:false, errorIndex:i };
        prev = e.hash;
      }
      return { ok:true };
    }
  };

  return api;
})();

// Expose globally for non-module usage
if (typeof window !== 'undefined') {
  window.Forge = Forge;
}

export default Forge;
