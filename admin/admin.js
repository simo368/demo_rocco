import { getBackend } from "../js/backend.js";
import { makeResolver } from "../js/content.js";
import { DEFAULT_SITE, DEFAULT_PRODUCTS } from "../js/defaults.js";
import { h, normalizeSite, normalizeProduct, appearanceProblems, safeUrl, clone } from "../js/shared.js";
import { state, markDirty, markClean, hasUnpublishedChanges } from "./state.js";
import { toast, describeError, confirmDialog, withBusy } from "./ui.js";
import { mediaView } from "./media.js";
import { productsView, refreshProducts } from "./products.js";
import { signupsView } from "./signups.js";
import { heroView, aboutView, updatesView, joinView, navView, layoutView, appearanceView } from "./site-views.js";

const app = document.querySelector("#root");

/* route table: site views edit the shared draft (with Save / Preview / Publish bar) */
const SITE_ROUTES = {
  hero: ["Hero", heroView], about: ["About Us", aboutView], updates: ["Info / Updates", updatesView],
  join: ["Join", joinView], navigation: ["Navigation & footer", navView], layout: ["Layout", layoutView], appearance: ["Appearance", appearanceView]
};
const OTHER_ROUTES = { products: ["Products"], media: ["Media library"], signups: ["Sign-ups"] };

boot();

async function boot() {
  const backend = await getBackend();
  state.backend = backend;
  const cache = new Map();
  const resolver = makeResolver(backend);
  state.resolver = (id) => { if (!cache.has(id)) cache.set(id, resolver(id)); return cache.get(id); };
  state.clearResolver = () => { cache.clear(); const fresh = makeResolver(backend); state.resolver = (id) => { if (!cache.has(id)) cache.set(id, fresh(id)); return cache.get(id); }; };

  if (backend.mode === "none") return renderSetup(backend);
  backend.onAuth(async (user, isAdmin) => {
    state.user = user;
    if (!user) return renderLogin();
    if (!isAdmin) return renderNoAccess(user);
    try { await loadAll(); renderShell(); } catch (e) { renderFatal(e); }
  });
}

/* ---------- screens before the admin shell ---------- */
const screen = (...children) => app.replaceChildren(h("main", { class: "auth" }, h("div", { class: "auth__card" }, ...children)));
const mockBanner = () => state.backend.mode === "mock" ? h("p", { class: "warning" }, "DEV MOCK BACKEND (localhost only, data kept in this browser). Admin: admin@example.test / Test-Password-123 · Non-admin: visitor@example.test (same password).") : null;

function renderSetup(backend) {
  screen(h("h1", {}, "Admin setup required"),
    h("p", {}, backend.error ? `Firebase could not be initialised: ${backend.error.message}` : "Firebase is not configured yet, so there is nothing to sign in to and no changes can be saved."),
    h("ol", { class: "steps" }, h("li", {}, "Create a Firebase project and enable Email/Password sign-in, Firestore."), h("li", {}, "Paste the web app config into firebase-config.js."), h("li", {}, "Deploy firestore.rules and add your admin user (see README.md).")),
    h("p", { class: "hint" }, "The public website keeps working with its built-in content in the meantime."));
}

function renderLogin() {
  const error = h("p", { class: "error", role: "alert", hidden: true });
  const email = h("input", { id: "login-email", type: "email", autocomplete: "username", required: true });
  const password = h("input", { id: "login-password", type: "password", autocomplete: "current-password", required: true });
  const submit = h("button", { type: "submit", class: "btn btn--primary btn--block" }, "Sign in");
  const form = h("form", { class: "stack", novalidate: true, onsubmit: async (e) => {
    e.preventDefault(); error.hidden = true;
    if (!email.value || !password.value) { error.textContent = "Enter your email and password."; error.hidden = false; return; }
    try { await withBusy(submit, () => state.backend.signIn(email.value.trim(), password.value)); }
    catch (err) { error.textContent = describeError(err); error.hidden = false; password.value = ""; password.focus(); }
  } },
    h("div", { class: "field" }, h("label", { for: "login-email" }, "Email"), email), h("div", { class: "field" }, h("label", { for: "login-password" }, "Password"), password), error, submit,
    h("button", { type: "button", class: "link", onclick: async () => {
      if (!email.value) { error.textContent = "Enter your email above first, then choose “Forgot password”."; error.hidden = false; return; }
      try { await state.backend.resetPassword(email.value.trim()); } catch { /* do not reveal whether the account exists */ }
      error.hidden = true; toast("If an account exists for this address, a password-reset email has been sent.");
    } }, "Forgot password?"));
  screen(h("h1", {}, "Admin sign in"), mockBanner(), form, h("p", { class: "hint" }, h("a", { href: "../index.html" }, "← Back to the website")));
  email.focus();
}

function renderNoAccess(user) {
  screen(h("h1", {}, "No admin access"),
    h("p", {}, `You are signed in as ${user.email}, but this account is not authorised to manage the site.`),
    h("p", { class: "hint" }, "To grant access, add a document to the Firestore collection “admins” whose ID is the user ID below (see README.md)."),
    h("code", { class: "code" }, user.uid),
    h("button", { type: "button", class: "btn btn--block", onclick: () => state.backend.signOut() }, "Sign out"));
}

function renderFatal(error) {
  screen(h("h1", {}, "Could not load the admin"), h("p", { class: "error" }, describeError(error)),
    h("p", { class: "hint" }, "If this says “permission denied”, deploy firestore.rules from this project to Firebase."),
    h("button", { type: "button", class: "btn", onclick: () => location.reload() }, "Try again"),
    h("button", { type: "button", class: "btn", onclick: () => state.backend.signOut() }, "Sign out"));
}

/* ---------- data loading, first-run migration ---------- */
const stripped = (site) => { const s = normalizeSite(site); delete s.updatedAt; return s; };

async function loadAll() {
  const b = state.backend;
  let [draft, published] = await Promise.all([b.getSite("draft"), b.getSite("published")]);
  await refreshProducts();
  if (!draft && !published) {
    // First run: migrate the approved original content so the public site stays complete.
    const seed = stripped(DEFAULT_SITE);
    await b.saveSite("published", seed); await b.saveSite("draft", seed);
    if (!state.products.length) for (const p of DEFAULT_PRODUCTS) await b.saveProduct(null, p);
    await refreshProducts();
    [draft, published] = [seed, seed];
    state.seeded = true;
  }
  state.published = published ? stripped(published) : null;
  state.draft = stripped(draft ?? published);
  markClean();
}

/* ---------- shell ---------- */
let current = "";
function renderShell() {
  const nav = (id, label) => h("a", { href: `#${id}`, id: `nav-${id}`, class: "side__link" }, label);
  const bar = h("div", { class: "actionbar", id: "actionbar" });
  const view = h("div", { class: "view", id: "view", tabindex: "-1" });
  const side = h("nav", { class: "side", id: "side", "aria-label": "Admin sections" },
    h("p", { class: "side__group" }, "Site"), ...Object.entries(SITE_ROUTES).map(([id, [label]]) => nav(id, label)),
    h("p", { class: "side__group" }, "Catalog"), nav("products", "Products"), nav("media", "Media library"),
    h("p", { class: "side__group" }, "Audience"), nav("signups", "Sign-ups"));
  const toggle = h("button", { class: "btn btn--sm menu-btn", type: "button", "aria-expanded": "false", "aria-controls": "side", onclick: () => { const o = side.classList.toggle("is-open"); toggle.setAttribute("aria-expanded", String(o)); } }, "Menu");
  app.replaceChildren(
    h("div", { class: "shell" },
      h("header", { class: "topbar" }, toggle, h("strong", {}, "Admin"), state.backend.mode === "mock" ? h("span", { class: "chip chip--draft" }, "DEV MOCK") : null,
        h("span", { class: "spacer" }), h("a", { class: "btn btn--sm", href: "../index.html", target: "_blank", rel: "noopener" }, "View site ↗"),
        h("span", { class: "who" }, state.user.email), h("button", { class: "btn btn--sm", type: "button", onclick: signOut }, "Sign out")),
      side, h("main", { class: "main" }, bar, view)));
  if (state.seeded) { toast("First run: the original site content and 3 products were imported."); state.seeded = false; }
  window.removeEventListener("hashchange", route); window.addEventListener("hashchange", route);
  document.removeEventListener("admin:dirty", renderBar); document.addEventListener("admin:dirty", renderBar);
  route();
}

async function signOut() {
  if (state.dirty && !(await confirmDialog({ title: "Sign out with unsaved changes?", message: "Your unsaved edits to the site draft will be lost.", confirmLabel: "Sign out", danger: true }))) return;
  state.dirty = false; await state.backend.signOut();
}

async function route() {
  const [id, sub] = (location.hash.slice(1) || "hero").split("/");
  const view = document.querySelector("#view");
  if (!view) return;
  if (!SITE_ROUTES[id] && !OTHER_ROUTES[id]) { location.hash = "#hero"; return; }
  current = id;
  document.querySelector("#side")?.classList.remove("is-open");
  document.querySelectorAll(".side__link").forEach((a) => a.setAttribute("aria-current", a.id === `nav-${id}` ? "page" : "false"));
  renderBar();
  view.replaceChildren();
  if (SITE_ROUTES[id]) SITE_ROUTES[id][1](view);
  else if (id === "products") await productsView(view, sub);
  else if (id === "media") await mediaView(view);
  else if (id === "signups") await signupsView(view);
  document.title = `${(SITE_ROUTES[id] ?? OTHER_ROUTES[id])[0]} — Admin`;
  view.focus({ preventScroll: true });
}

/* ---------- draft / preview / publish bar (site views only) ---------- */
function renderBar() {
  const bar = document.querySelector("#actionbar");
  if (!bar) return;
  if (!SITE_ROUTES[current]) { bar.hidden = true; return; }
  bar.hidden = false;
  const unpublished = hasUnpublishedChanges();
  const label = state.dirty ? "Unsaved changes" : unpublished ? "Draft saved — not published" : "All changes published";
  const saveBtn = h("button", { type: "button", class: "btn", id: "save-draft", disabled: !state.dirty, onclick: (e) => withBusy(e.target, saveDraft) }, "Save draft");
  const prevBtn = h("button", { type: "button", class: "btn", id: "preview", onclick: preview }, "Preview ↗");
  const pubBtn = h("button", { type: "button", class: "btn btn--primary", id: "publish", disabled: !state.dirty && !unpublished, onclick: publish }, "Publish");
  bar.replaceChildren(h("span", { class: `status status--${state.dirty ? "dirty" : unpublished ? "draft" : "live"}`, role: "status" }, label), h("span", { class: "spacer" }), saveBtn, prevBtn, pubBtn);
}

function validateDraft() {
  const d = state.draft, problems = [];
  if (!d.brand.name.trim()) problems.push("Brand name is required (Navigation & footer).");
  if (!d.hero.title.trim()) problems.push("Hero title is required.");
  if (d.nav.some((n) => !n.label.trim())) problems.push("Every navigation link needs a label.");
  if (d.nav.some((n) => !safeUrl(n.target))) problems.push("A navigation link has an invalid destination. Use a section, an https:// address or a /path.");
  if (!safeUrl(d.hero.ctaTarget)) problems.push("The hero arrow has an invalid destination.");
  if (d.footer.social.some((s) => !s.label.trim() || !safeUrl(s.url))) problems.push("Every social link needs a name and a valid URL.");
  if (d.join.privacyUrl.trim() && !safeUrl(d.join.privacyUrl)) problems.push("The privacy policy URL is not valid.");
  if (d.join.enabled && !d.join.consentText.trim()) problems.push("Consent text is required while sign-ups are accepted.");
  problems.push(...appearanceProblems(d.appearance));
  return problems;
}

async function saveDraft() {
  const problems = validateDraft();
  if (problems.length) { toast(problems[0] + (problems.length > 1 ? ` (+${problems.length - 1} more)` : ""), "error"); throw new Error("invalid"); }
  try {
    state.draft = stripped(state.draft);
    await state.backend.saveSite("draft", state.draft);
    markClean(); toast("Draft saved.");
  } catch (e) { if (e.message !== "invalid") toast(describeError(e), "error"); throw e; }
}

async function preview() {
  if (state.dirty) { try { await saveDraft(); } catch { return; } }
  window.open("../index.html?preview=1", "_blank");
}

async function publish(event) {
  const ok = await confirmDialog({ title: "Publish to the live site?", message: "Visitors will see the current draft immediately.", confirmLabel: "Publish", danger: false });
  if (!ok) return;
  await withBusy(event.target, async () => {
    try {
      const problems = validateDraft();
      if (problems.length) { toast(problems[0], "error"); return; }
      state.draft = stripped(state.draft);
      await state.backend.saveSite("draft", state.draft);
      await state.backend.saveSite("published", state.draft);
      state.published = clone(state.draft); markClean(); toast("Published — the live site is updated.");
      route();
    } catch (e) { toast(describeError(e), "error"); }
  });
}

window.addEventListener("beforeunload", (e) => { if (state.dirty) { e.preventDefault(); e.returnValue = ""; } });
