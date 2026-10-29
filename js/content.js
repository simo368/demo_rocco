import { getBackend } from "./backend.js";
import { DEFAULT_SITE, DEFAULT_PRODUCTS } from "./defaults.js";
import { normalizeSite, normalizeProduct, clone } from "./shared.js";

export function makeResolver(backend) {
  const cache = new Map();
  return (id) => {
    if (!cache.has(id)) cache.set(id, backend.getMediaData(id).catch(() => null));
    return cache.get(id);
  };
}

const firstAuth = (backend) => new Promise((resolve) => {
  const off = backend.onAuth((user, admin) => { off?.(); resolve({ user, admin }); });
});

/** Loads what a visitor (or, with ?preview=1, a signed-in admin) should see. Never throws. */
export async function loadPublicContent({ preview = false } = {}) {
  const backend = await getBackend();
  const fallback = () => ({
    backend, source: "defaults", preview: false,
    site: normalizeSite(clone(DEFAULT_SITE)),
    products: DEFAULT_PRODUCTS.map((p, i) => normalizeProduct(p, p.slug)),
    resolver: makeResolver(backend)
  });
  if (backend.mode === "none") return fallback();

  try {
    let usePreview = false;
    if (preview) usePreview = (await firstAuth(backend)).admin;
    const published = await backend.getSite("published");
    if (!published && !usePreview) return fallback(); // never published yet → approved original content

    const raw = usePreview ? (await backend.getSite("draft")) ?? published : published;
    const list = published || usePreview
      ? (await backend.listProducts({ all: usePreview })).filter((p) => p.status !== "archived")
      : [];
    return {
      backend, source: backend.mode, preview: usePreview,
      site: normalizeSite(raw ?? DEFAULT_SITE),
      products: list.map((p) => normalizeProduct(p, p.id)),
      resolver: makeResolver(backend)
    };
  } catch (error) {
    console.warn("Content could not be loaded, showing bundled content instead:", error);
    return fallback();
  }
}
