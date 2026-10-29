import { DEFAULT_SITE, SECTION_IDS, FONT_STACKS, LIMITS, AVAILABILITY } from "./defaults.js";

/* ---------- tiny DOM helper (always textContent, never innerHTML) ---------- */
export function h(tag, attrs = {}, ...children) {
  const el = document.createElement(tag);
  for (const [key, value] of Object.entries(attrs || {})) {
    if (value === undefined || value === null || value === false) continue;
    if (key === "class") el.className = value;
    else if (key === "dataset") Object.assign(el.dataset, value);
    else if (key === "style" && typeof value === "object") Object.assign(el.style, value);
    else if (key.startsWith("on") && typeof value === "function") el.addEventListener(key.slice(2).toLowerCase(), value);
    else if (value === true) el.setAttribute(key, "");
    else el.setAttribute(key, String(value));
  }
  for (const child of children.flat()) {
    if (child === null || child === undefined || child === false) continue;
    el.append(child instanceof Node ? child : document.createTextNode(String(child)));
  }
  return el;
}

/* ---------- value helpers ---------- */
export const clamp = (n, min, max) => Math.min(max, Math.max(min, Number.isFinite(+n) ? +n : min));
const isObj = (v) => v && typeof v === "object" && !Array.isArray(v);

export function deepMerge(base, over) {
  if (!isObj(base)) return over === undefined ? base : over;
  const out = { ...base };
  if (!isObj(over)) return out;
  for (const key of Object.keys(over)) {
    out[key] = isObj(base[key]) ? deepMerge(base[key], over[key]) : over[key];
  }
  return out;
}

export const clone = (v) => JSON.parse(JSON.stringify(v));
const str = (v, fallback = "", max = 5000) => (typeof v === "string" ? v.slice(0, max) : fallback);

/** Only allow in-page anchors, relative paths, http(s), mailto. Blocks javascript:/data: URLs. */
export function safeUrl(value, fallback = "") {
  const v = String(value ?? "").trim();
  if (!v) return fallback;
  if (v.startsWith("#") || v.startsWith("/") || v.startsWith("./")) return v;
  try {
    const u = new URL(v);
    return ["http:", "https:", "mailto:"].includes(u.protocol) ? u.href : fallback;
  } catch {
    return fallback;
  }
}

export const isHex = (v) => typeof v === "string" && /^#[0-9a-fA-F]{6}$/.test(v);

function luminance(hex) {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255).map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}
export function contrast(a, b) {
  const [l1, l2] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (l1 + 0.05) / (l2 + 0.05);
}

/** Returns a list of human-readable problems with an appearance object (empty = OK). */
export function appearanceProblems(a) {
  const problems = [];
  for (const key of ["paper", "ink", "muted", "surface"]) if (!isHex(a[key])) problems.push(`"${key}" must be a valid colour.`);
  if (problems.length) return problems;
  if (contrast(a.ink, a.paper) < 4.5) problems.push("Text colour on the page background needs a contrast ratio of at least 4.5:1.");
  if (contrast(a.ink, a.surface) < 4.5) problems.push("Text colour on the updates background needs a contrast ratio of at least 4.5:1.");
  if (contrast(a.muted, a.paper) < 3) problems.push("Secondary text colour needs a contrast ratio of at least 3:1 against the page background.");
  return problems;
}

/* ---------- site normalisation: never trust stored data ---------- */
export function normalizeSite(raw) {
  const site = deepMerge(clone(DEFAULT_SITE), isObj(raw) ? raw : {});
  const d = DEFAULT_SITE;

  // arrays
  site.nav = (Array.isArray(raw?.nav) ? raw.nav : d.nav).slice(0, 12).map((n, i) => ({
    id: str(n?.id, `nav-${i}`, 40) || `nav-${i}`,
    label: str(n?.label, "Link", 40) || "Link",
    target: safeUrl(n?.target, "#home"),
    visible: n?.visible !== false
  }));
  const seen = new Set();
  site.sections = (Array.isArray(raw?.sections) ? raw.sections : d.sections)
    .filter((s) => SECTION_IDS.includes(s?.id) && !seen.has(s.id) && seen.add(s.id))
    .map((s) => ({ id: s.id, visible: s.visible !== false }));
  for (const id of SECTION_IDS) if (!seen.has(id)) site.sections.push({ id, visible: true });

  site.updates.announcements = (Array.isArray(raw?.updates?.announcements) ? raw.updates.announcements : []).slice(0, 20).map((a, i) => ({
    id: str(a?.id, `a${i}`, 40),
    date: str(a?.date, "", 40),
    title: str(a?.title, "", 120),
    text: str(a?.text, "", 600),
    visible: a?.visible !== false
  }));
  site.footer.social = (Array.isArray(raw?.footer?.social) ? raw.footer.social : []).slice(0, 8)
    .map((s) => ({ label: str(s?.label, "", 40), url: safeUrl(s?.url) }))
    .filter((s) => s.label && s.url);

  // focal points
  for (const [obj, key] of [[site.hero, "focal"], [site.hero, "focalMobile"], [site.about, "focal"]]) {
    obj[key] = { x: clamp(obj[key]?.x, 0, 100), y: clamp(obj[key]?.y, 0, 100) };
  }
  site.hero.ctaTarget = safeUrl(site.hero.ctaTarget, "#products");

  // appearance: bounded + readable, otherwise fall back to the approved defaults
  const ap = site.appearance;
  ap.textScale = clamp(ap.textScale, LIMITS.textScale.min, LIMITS.textScale.max);
  ap.contentWidth = clamp(ap.contentWidth, LIMITS.contentWidth.min, LIMITS.contentWidth.max);
  ap.density = clamp(ap.density, LIMITS.density.min, LIMITS.density.max);
  ap.motion = clamp(ap.motion, LIMITS.motion.min, LIMITS.motion.max);
  if (!FONT_STACKS[ap.fontHeading]) ap.fontHeading = "sans";
  if (!FONT_STACKS[ap.fontBody]) ap.fontBody = "sans";
  if (appearanceProblems(ap).length) Object.assign(ap, { paper: d.appearance.paper, ink: d.appearance.ink, muted: d.appearance.muted, surface: d.appearance.surface });
  return site;
}

export function normalizeProduct(raw, id) {
  return {
    id,
    slug: str(raw?.slug, "", 80),
    name: str(raw?.name, "Untitled", 120) || "Untitled",
    description: str(raw?.description, "", 2000),
    images: (Array.isArray(raw?.images) ? raw.images : []).filter((x) => typeof x === "string").slice(0, 10),
    focal: { x: clamp(raw?.focal?.x ?? 50, 0, 100), y: clamp(raw?.focal?.y ?? 45, 0, 100) },
    price: typeof raw?.price === "number" && raw.price >= 0 ? raw.price : null,
    currency: ["EUR", "USD", "GBP", "CHF"].includes(raw?.currency) ? raw.currency : "EUR",
    availability: AVAILABILITY[raw?.availability] ? raw.availability : "coming-soon",
    status: ["draft", "published", "archived"].includes(raw?.status) ? raw.status : "draft",
    sortOrder: Number.isFinite(raw?.sortOrder) ? raw.sortOrder : 0
  };
}

export function slugify(text) {
  return String(text).toLowerCase().normalize("NFKD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 80);
}

export function formatPrice(product) {
  if (product.price === null || product.price === undefined) {
    const symbol = new Intl.NumberFormat("en-IE", { style: "currency", currency: product.currency }).formatToParts(0).find((p) => p.type === "currency")?.value || product.currency;
    return `${symbol} —`;
  }
  return new Intl.NumberFormat("en-IE", { style: "currency", currency: product.currency }).format(product.price);
}
export const availabilityLabel = (p) => AVAILABILITY[p.availability] || AVAILABILITY["coming-soon"];

/* ---------- appearance → CSS custom properties ---------- */
export function applyAppearance(ap, root = document.documentElement) {
  const s = root.style;
  s.setProperty("--paper", ap.paper);
  s.setProperty("--ink", ap.ink);
  s.setProperty("--muted", ap.muted);
  s.setProperty("--surface", ap.surface);
  s.setProperty("--font-heading", FONT_STACKS[ap.fontHeading].css);
  s.setProperty("--font-body", FONT_STACKS[ap.fontBody].css);
  s.setProperty("--text-scale", String(ap.textScale));
  s.setProperty("--content-width", `${ap.contentWidth}px`);
  s.setProperty("--density", String(ap.density));
  s.setProperty("--motion", String(ap.motion));
  root.dataset.motion = ap.motion === 0 ? "off" : "on";
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.content = ap.paper;
}

/* ---------- image references ----------
   "assets/…"  bundled file      "sprite:N" panel N of the original 3-panel placeholder
   "media:ID"  uploaded image stored in Firestore (resolved lazily through resolver)  */
export function imageElement(ref, { alt = "", focal = { x: 50, y: 50 }, className = "", resolver } = {}) {
  if (typeof ref === "string" && ref.startsWith("sprite:")) {
    const n = clamp(parseInt(ref.slice(7), 10) || 0, 0, 2);
    const el = h("div", { class: `${className} is-sprite`, style: { backgroundPosition: `${n * 50}% ${focal.y}%` } });
    if (alt) { el.setAttribute("role", "img"); el.setAttribute("aria-label", alt); } else el.setAttribute("aria-hidden", "true");
    return el;
  }
  const img = h("img", { class: className, alt, loading: "lazy", decoding: "async", style: { objectPosition: `${focal.x}% ${focal.y}%` } });
  if (typeof ref === "string" && ref.startsWith("media:")) {
    resolver?.(ref.slice(6)).then((src) => { if (src) img.src = src; else img.classList.add("is-missing"); }).catch(() => img.classList.add("is-missing"));
  } else if (typeof ref === "string" && /^assets\/[\w./-]+$/.test(ref)) {
    img.src = ref;
  } else img.classList.add("is-missing");
  return img;
}
