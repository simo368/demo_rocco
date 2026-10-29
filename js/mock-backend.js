// DEV-ONLY mock of js/backend.js. Only loadable on localhost with ?mock=1 (see backend.js).
// It mimics Firestore security rules (public vs admin) so the UI can be exercised without Firebase.
// It is NOT a production backend and must never be used to store real data.
const KEY = "dev-mock-db-v1";
const USER_KEY = "dev-mock-user";
export const MOCK_USERS = {
  "admin@example.test": { password: "Test-Password-123", uid: "mock-admin", admin: true },
  "visitor@example.test": { password: "Test-Password-123", uid: "mock-visitor", admin: false }
};

const load = () => JSON.parse(localStorage.getItem(KEY) || '{"site":{},"products":{},"media":{},"mediaData":{},"signups":{}}');
const save = (db) => localStorage.setItem(KEY, JSON.stringify(db));
const denied = () => Object.assign(new Error("Missing or insufficient permissions."), { code: "permission-denied" });
const now = () => new Date().toISOString();
const rid = () => Math.random().toString(36).slice(2, 12);

export function createMockBackend() {
  const listeners = new Set();
  const current = () => { const e = localStorage.getItem(USER_KEY); return e ? { email: e, ...MOCK_USERS[e] } : null; };
  const isAdmin = () => !!current()?.admin;
  const needAdmin = () => { if (!isAdmin()) throw denied(); };
  const emit = () => { const u = current(); listeners.forEach((cb) => cb(u, !!u?.admin)); };
  const tick = () => new Promise((r) => setTimeout(r, 40));
  const copy = (v) => JSON.parse(JSON.stringify(v));

  return {
    mode: "mock",
    onAuth(cb) { listeners.add(cb); queueMicrotask(() => { const u = current(); cb(u, !!u?.admin); }); return () => listeners.delete(cb); },
    async signIn(email, password) {
      await tick();
      const u = MOCK_USERS[email];
      if (!u || u.password !== password) throw Object.assign(new Error("Invalid credentials"), { code: "auth/invalid-credential" });
      localStorage.setItem(USER_KEY, email); emit();
    },
    async resetPassword() { await tick(); },
    async signOut() { localStorage.removeItem(USER_KEY); emit(); },

    async getSite(kind) { await tick(); if (kind === "draft") needAdmin(); return copy(load().site[kind] ?? null); },
    async saveSite(kind, data) { await tick(); needAdmin(); const db = load(); db.site[kind] = { ...copy(data), updatedAt: now() }; save(db); },

    async listProducts({ all = false } = {}) {
      await tick(); if (all) needAdmin();
      return Object.entries(load().products).map(([id, p]) => ({ id, ...p })).filter((p) => all || p.status === "published").sort((a, b) => a.sortOrder - b.sortOrder).map(copy);
    },
    async getProductBySlug(slug, { preview = false } = {}) {
      await tick(); if (preview) needAdmin();
      const hit = Object.entries(load().products).find(([, p]) => p.slug === slug && (preview || p.status === "published"));
      return hit ? copy({ id: hit[0], ...hit[1] }) : null;
    },
    async saveProduct(id, data) {
      await tick(); needAdmin(); const db = load(); const key = id || rid();
      const { id: _d, ...clean } = copy(data); db.products[key] = { ...clean, updatedAt: now() }; save(db); return key;
    },
    async deleteProduct(id) { await tick(); needAdmin(); const db = load(); delete db.products[id]; save(db); },
    async reorderProducts(ids) { await tick(); needAdmin(); const db = load(); ids.forEach((id, i) => { db.products[id].sortOrder = i + 1; }); save(db); },

    async getMediaData(id) { await tick(); return load().mediaData[id]?.data ?? null; },
    async listMedia() { await tick(); needAdmin(); return Object.entries(load().media).map(([id, m]) => ({ id, ...m })).sort((a, b) => b.createdAt.localeCompare(a.createdAt)); },
    async addMedia({ data, ...meta }) {
      await tick(); needAdmin(); const db = load(); const id = rid();
      db.media[id] = { ...meta, createdAt: now() }; db.mediaData[id] = { data, type: meta.type };
      try { save(db); } catch { throw Object.assign(new Error("Mock storage quota exceeded"), { code: "resource-exhausted" }); }
      return id;
    },
    async replaceMedia(id, { data, ...meta }) {
      await tick(); needAdmin(); const db = load();
      if (!db.media[id]) throw Object.assign(new Error("Not found"), { code: "not-found" });
      db.media[id] = { ...db.media[id], ...meta, updatedAt: now() }; db.mediaData[id] = { data, type: meta.type };
      try { save(db); } catch { throw Object.assign(new Error("Mock storage quota exceeded"), { code: "resource-exhausted" }); }
    },
    async deleteMedia(id) { await tick(); needAdmin(); const db = load(); delete db.media[id]; delete db.mediaData[id]; save(db); },

    async addSignup({ email, consentText }) {
      await tick(); const db = load();
      db.signups[rid()] = { email, consent: true, consentText, source: "website", createdAt: now() }; save(db);
    },
    async listSignups() { await tick(); needAdmin(); return Object.entries(load().signups).map(([id, s]) => ({ id, ...s })).sort((a, b) => b.createdAt.localeCompare(a.createdAt)); },
    async deleteSignup(id) { await tick(); needAdmin(); const db = load(); delete db.signups[id]; save(db); }
  };
}
