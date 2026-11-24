/* Lokalna "baza" – sve se sprema samo na ovom uređaju (IndexedDB). Zamjenjuje Firebase. */
(function () {
  const DEL = { __del: true };
  const DBN = 'mjerenje_obrt', STORE = 'docs';
  let idb = null, ready = null;
  const mem = {};            // { kolekcija: { id: data } }
  const listeners = [];      // { col, id|null, cb, sort }
  function openDb() {
    if (ready) return ready;
    ready = new Promise((res) => {
      let r; try { r = indexedDB.open(DBN, 1); } catch (e) { res(); return; }
      r.onupgradeneeded = () => r.result.createObjectStore(STORE);
      r.onsuccess = () => {
        idb = r.result;
        const tx = idb.transaction(STORE, 'readonly'), st = tx.objectStore(STORE);
        const q = st.openCursor();
        q.onsuccess = () => {
          const c = q.result;
          if (c) { const [col, id] = String(c.key).split('/'); (mem[col] = mem[col] || {})[id] = c.value; c.continue(); }
          else res();
        };
        q.onerror = () => res();
      };
      r.onerror = () => res();
    });
    return ready;
  }
  function persist(col, id) {
    if (!idb) return;
    try {
      const tx = idb.transaction(STORE, 'readwrite'), st = tx.objectStore(STORE);
      const v = mem[col] && mem[col][id];
      if (v === undefined) st.delete(col + '/' + id); else st.put(v, col + '/' + id);
    } catch (e) { console.error('Spremanje nije uspjelo', e); }
  }
  const clone = v => JSON.parse(JSON.stringify(v === undefined ? null : v));
  function setPath(obj, path, val) {
    const parts = path.split('.'); let o = obj;
    for (let i = 0; i < parts.length - 1; i++) { if (typeof o[parts[i]] !== 'object' || o[parts[i]] === null) o[parts[i]] = {}; o = o[parts[i]]; }
    const k = parts[parts.length - 1];
    if (val === DEL) delete o[k]; else o[k] = clone(val);
  }
  function snapDoc(col, id) { const d = mem[col] && mem[col][id]; return { id, exists: d !== undefined, data: () => clone(d) }; }
  function notify(col) {
    listeners.filter(l => l.col === col).forEach(l => {
      try {
        if (l.id) l.cb(snapDoc(col, l.id));
        else {
          let docs = Object.keys(mem[col] || {}).map(id => snapDoc(col, id));
          if (l.sort) docs.sort((a, b) => { const x = a.data()[l.sort.f] || 0, y = b.data()[l.sort.f] || 0; return l.sort.dir === 'desc' ? y - x : x - y; });
          l.cb({ docs, size: docs.length, empty: !docs.length, forEach: fn => docs.forEach(fn) });
        }
      } catch (e) { console.error(e); }
    });
  }
  function docRef(col, id) {
    return {
      id,
      async get() { await openDb(); return snapDoc(col, id); },
      async set(data) { await openDb(); (mem[col] = mem[col] || {})[id] = clone(data); persist(col, id); notify(col); },
      async update(data) {
        await openDb(); const cur = (mem[col] = mem[col] || {})[id] || {};
        Object.keys(data).forEach(k => setPath(cur, k, data[k]));
        mem[col][id] = cur; persist(col, id); notify(col);
      },
      async delete() { await openDb(); if (mem[col]) delete mem[col][id]; persist(col, id); notify(col); },
      onSnapshot(cb) { const l = { col, id, cb }; listeners.push(l); openDb().then(() => cb(snapDoc(col, id))); return () => listeners.splice(listeners.indexOf(l), 1); }
    };
  }
  function query(col, sort) {
    return {
      orderBy(f, dir) { return query(col, { f, dir }); },
      onSnapshot(cb) { const l = { col, id: null, cb, sort }; listeners.push(l); openDb().then(() => notify(col)); return () => listeners.splice(listeners.indexOf(l), 1); },
      doc(id) { return docRef(col, id); },
      async add(data) { await openDb(); const id = Date.now().toString(36) + Math.random().toString(36).slice(2, 8); (mem[col] = mem[col] || {})[id] = clone(data); persist(col, id); notify(col); return docRef(col, id); }
    };
  }
  const db = { collection: (c) => query(c, null) };
  function blobToDataURL(b) { return new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(r.result); r.onerror = rej; r.readAsDataURL(b); }); }
  const files = {};
  const storage = {
    ref(path) {
      return {
        async put(blob) { files[path] = await blobToDataURL(blob); return {}; },
        async putString(s) { files[path] = s; return {}; },
        async getDownloadURL() { return files[path] || ''; },
        async delete() { delete files[path]; }
      };
    }
  };
  const fs = () => db; fs.FieldValue = { delete: () => DEL, serverTimestamp: () => Date.now() };
  window.firebase = { initializeApp() {}, firestore: fs, storage: () => storage };
  // korisnik: pita ime jednom, bez PIN-a
  try {
    let ime = localStorage.getItem('teren_worker_name');
    if (!ime) { ime = (prompt('Upiši svoje ime (piše se na mjerenjima):') || 'MJERNIK').trim().toUpperCase() || 'MJERNIK'; localStorage.setItem('teren_worker_name', ime); }
    openDb().then(() => { const c = (mem.postavke = mem.postavke || {}); c.pinovi = { pins: { [ime]: '0000' } }; notify('postavke'); });
  } catch (e) {}
})();
