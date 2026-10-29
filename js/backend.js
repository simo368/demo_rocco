// Data layer. Public pages and the admin panel talk ONLY to this interface.
// Implementations: Firebase (production) · dev mock (localhost only, ?mock=1) · none (not configured).
import { firebaseConfig } from "../firebase-config.js";

const SDK = "https://www.gstatic.com/firebasejs/10.14.1";

export class NotConfiguredError extends Error {
  constructor() { super("Firebase is not configured yet. Add the web config to firebase-config.js (see README)."); this.code = "not-configured"; }
}

let cached;

export function getBackend() {
  cached ??= create();
  return cached;
}

async function create() {
  const isLocal = ["localhost", "127.0.0.1"].includes(location.hostname);
  const flag = new URLSearchParams(location.search).get("mock");
  if (isLocal && flag === "1") localStorage.setItem("dev-mock", "1");
  if (isLocal && flag === "0") localStorage.removeItem("dev-mock");
  if (isLocal && localStorage.getItem("dev-mock") === "1") {
    const { createMockBackend } = await import("./mock-backend.js");
    return createMockBackend();
  }
  if (!firebaseConfig || !firebaseConfig.projectId) return createNone();
  try {
    return await createFirebase();
  } catch (error) {
    console.warn("Firebase could not be initialised:", error);
    return createNone(error);
  }
}

function createNone(error) {
  const fail = async () => { throw error ?? new NotConfiguredError(); };
  return {
    mode: "none", error,
    getSite: fail, saveSite: fail, listProducts: fail, getProductBySlug: fail, saveProduct: fail, deleteProduct: fail,
    reorderProducts: fail, getMediaData: fail, listMedia: fail, addMedia: fail, replaceMedia: fail, deleteMedia: fail,
    addSignup: fail, listSignups: fail, deleteSignup: fail, signIn: fail, resetPassword: fail, signOut: async () => {},
    onAuth: (cb) => { queueMicrotask(() => cb(null, false)); return () => {}; }
  };
}

async function createFirebase() {
  const [{ initializeApp }, auth, fs] = await Promise.all([
    import(`${SDK}/firebase-app.js`), import(`${SDK}/firebase-auth.js`), import(`${SDK}/firebase-firestore.js`)
  ]);
  const app = initializeApp(firebaseConfig);
  const authInstance = auth.getAuth(app);
  const db = fs.getFirestore(app);
  const { doc, getDoc, setDoc, getDocs, addDoc, deleteDoc, collection, query, where, orderBy, writeBatch, serverTimestamp } = fs;

  const withId = (d) => ({ id: d.id, ...d.data() });
  const stamp = (data) => ({ ...data, updatedAt: serverTimestamp() });

  return {
    mode: "firebase",

    /* auth — admin status comes from the admins/{uid} document, which only the console can write */
    onAuth(callback) {
      return auth.onAuthStateChanged(authInstance, async (user) => {
        if (!user) return callback(null, false);
        try {
          const snap = await getDoc(doc(db, "admins", user.uid));
          callback(user, snap.exists());
        } catch { callback(user, false); }
      });
    },
    signIn: (email, password) => auth.signInWithEmailAndPassword(authInstance, email, password),
    resetPassword: (email) => auth.sendPasswordResetEmail(authInstance, email),
    signOut: () => auth.signOut(authInstance),

    /* site content: site/published (public) and site/draft (admin only) */
    async getSite(kind) {
      const snap = await getDoc(doc(db, "site", kind));
      return snap.exists() ? snap.data() : null;
    },
    saveSite: (kind, data) => setDoc(doc(db, "site", kind), stamp(data)),

    /* products */
    async listProducts({ all = false } = {}) {
      const q = all ? collection(db, "products") : query(collection(db, "products"), where("status", "==", "published"));
      const snap = await getDocs(q);
      return snap.docs.map(withId).sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0));
    },
    async getProductBySlug(slug, { preview = false } = {}) {
      const base = [collection(db, "products"), where("slug", "==", slug)];
      if (!preview) base.push(where("status", "==", "published"));
      const snap = await getDocs(query(...base));
      return snap.empty ? null : withId(snap.docs[0]);
    },
    async saveProduct(id, data) {
      const { id: _drop, ...clean } = data;
      if (id) { await setDoc(doc(db, "products", id), stamp(clean), { merge: true }); return id; }
      const ref = await addDoc(collection(db, "products"), { ...clean, createdAt: serverTimestamp(), updatedAt: serverTimestamp() });
      return ref.id;
    },
    deleteProduct: (id) => deleteDoc(doc(db, "products", id)),
    async reorderProducts(ids) {
      const batch = writeBatch(db);
      ids.forEach((id, i) => batch.update(doc(db, "products", id), { sortOrder: i + 1, updatedAt: serverTimestamp() }));
      await batch.commit();
    },

    /* media: metadata+thumbnail in media/{id}; full image in mediaData/{id} (public get, admin list) */
    async getMediaData(id) {
      const snap = await getDoc(doc(db, "mediaData", id));
      return snap.exists() ? snap.data().data : null;
    },
    async listMedia() {
      const snap = await getDocs(query(collection(db, "media"), orderBy("createdAt", "desc")));
      return snap.docs.map(withId);
    },
    async addMedia({ data, ...meta }) {
      const ref = doc(collection(db, "media"));
      const batch = writeBatch(db);
      batch.set(ref, { ...meta, createdAt: serverTimestamp() });
      batch.set(doc(db, "mediaData", ref.id), { data, type: meta.type });
      await batch.commit();
      return ref.id;
    },
    async replaceMedia(id, { data, ...meta }) {
      const batch = writeBatch(db);
      batch.update(doc(db, "media", id), { ...meta, updatedAt: serverTimestamp() });
      batch.set(doc(db, "mediaData", id), { data, type: meta.type });
      await batch.commit();
    },
    async deleteMedia(id) {
      const batch = writeBatch(db);
      batch.delete(doc(db, "media", id));
      batch.delete(doc(db, "mediaData", id));
      await batch.commit();
    },

    /* signups (public create-only; admin read/delete) */
    addSignup: ({ email, consentText }) => addDoc(collection(db, "signups"), { email, consent: true, consentText, source: "website", createdAt: serverTimestamp() }),
    async listSignups() {
      const snap = await getDocs(query(collection(db, "signups"), orderBy("createdAt", "desc")));
      return snap.docs.map((d) => { const v = d.data(); return { id: d.id, ...v, createdAt: v.createdAt?.toDate?.().toISOString() ?? "" }; });
    },
    deleteSignup: (id) => deleteDoc(doc(db, "signups", id))
  };
}
