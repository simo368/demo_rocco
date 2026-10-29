import { h, imageElement, formatPrice, availabilityLabel, applyAppearance, safeUrl } from "./shared.js";
import { UPDATE_STATUS } from "./defaults.js";

const reducedMotion = () => window.matchMedia("(prefers-reduced-motion: reduce)").matches;

/* ---------- shared chrome ---------- */
export function renderHeader(site, { home = false } = {}) {
  const wordmark = h("a", { class: "wordmark", href: home ? "#home" : "index.html", "aria-label": `${site.brand.name}, home` }, site.brand.name);
  if (!home) return h("header", { class: "site-header" }, wordmark, h("a", { class: "back-to-top", href: "index.html#products" }, "Products"));

  const hidden = new Set(site.sections.filter((s) => !s.visible).map((s) => s.id));
  const links = site.nav.filter((n) => n.visible && !(n.target.startsWith("#") && hidden.has(n.target.slice(1))));
  const toggle = h("button", { class: "menu-toggle", type: "button", "aria-expanded": "false", "aria-controls": "site-nav" },
    h("span", { class: "menu-toggle__label" }, "Menu"), h("span", { class: "menu-toggle__icon", "aria-hidden": "true" }));
  const nav = h("nav", { class: "site-nav", id: "site-nav", "aria-label": "Main navigation" },
    links.map((n) => h("a", { href: n.target, ...(/^https?:/.test(n.target) ? { rel: "noopener" } : {}) }, n.label)));
  const setOpen = (open) => { toggle.setAttribute("aria-expanded", String(open)); nav.classList.toggle("is-open", open); };
  toggle.addEventListener("click", () => setOpen(toggle.getAttribute("aria-expanded") !== "true"));
  nav.addEventListener("click", (e) => { if (e.target.closest("a")) setOpen(false); });
  document.addEventListener("keydown", (e) => { if (e.key === "Escape") setOpen(false); });
  return h("header", { class: "site-header", id: "top" }, wordmark, toggle, nav);
}

export function renderFooter(site) {
  const text = site.footer.text.replaceAll("{year}", String(new Date().getFullYear())).replaceAll("{brand}", site.brand.name);
  const social = site.footer.social.length
    ? h("nav", { class: "site-footer__social", "aria-label": "Social links" },
        site.footer.social.map((s) => h("a", { href: s.url, rel: "noopener noreferrer", ...(s.url.startsWith("http") ? { target: "_blank" } : {}) }, s.label)))
    : null;
  return h("footer", { class: "site-footer" },
    h("a", { class: "wordmark", href: "#top" }, site.brand.name), h("p", {}, text), social,
    h("a", { class: "back-to-top", href: "#top" }, "Back to top ↑"));
}

/* ---------- sections ---------- */
function productCard(p, ctx) {
  const image = imageElement(p.images[0] ?? "", { className: "product-card__image", alt: p.images[0] ? `${p.name}` : "", focal: p.focal, resolver: ctx.resolver });
  const href = `product.html?slug=${encodeURIComponent(p.slug)}${ctx.preview ? "&preview=1" : ""}`;
  return h("a", { class: "product-card", href, "aria-label": `View ${p.name}`, dataset: { productId: p.id } },
    image,
    h("div", { class: "product-card__meta" }, h("p", { class: "product-card__name" }, p.name), h("p", { class: "product-card__price" }, formatPrice(p))),
    h("p", { class: "product-card__availability" }, availabilityLabel(p)));
}

function productsSection(site, ctx, overlap) {
  const s = site.productsSection;
  const grid = h("div", { class: "product-grid", id: "product-grid", "aria-live": "polite" });
  if (ctx.products.length) ctx.products.forEach((p) => grid.append(productCard(p, ctx)));
  else grid.append(h("p", { class: "empty-note" }, "Products will appear here soon."));
  return h("section", { class: `products${overlap ? " products--overlap" : ""}`, id: "products", "aria-labelledby": "products-title" },
    h("div", { class: "products__inner" },
      h("div", { class: "section-heading" },
        h("div", {}, h("p", { class: "eyebrow" }, s.eyebrow), h("h2", { id: "products-title" }, s.title)),
        s.note ? h("p", { class: "section-heading__note" }, s.note) : null),
      grid));
}

function aboutSection(site, ctx) {
  const a = site.about;
  const paragraphs = a.body.split(/\n{2,}/).map((t) => h("p", {}, t.trim())).filter((p) => p.textContent);
  return h("section", { class: "intro section-wrap", id: "about", "aria-labelledby": "about-title" },
    h("p", { class: "eyebrow" }, a.eyebrow),
    h("div", { class: "intro__body" }, h("h2", { id: "about-title" }, a.title), paragraphs,
      a.image ? h("figure", { class: "intro__figure" }, imageElement(a.image, { alt: a.imageAlt, focal: a.focal, resolver: ctx.resolver })) : null));
}

function updatesSection(site) {
  const u = site.updates;
  const items = u.announcements.filter((a) => a.visible && (a.title || a.text));
  return h("section", { class: "updates", id: "updates", "aria-labelledby": "updates-title" },
    h("div", { class: "updates__inner" },
      h("p", { class: "eyebrow" }, u.eyebrow),
      h("div", { class: "updates__row" },
        h("h2", { id: "updates-title" }, u.title),
        h("p", { class: "updates__status" }, h("span", { class: "status-dot", "aria-hidden": "true" }), ` ${UPDATE_STATUS[u.status] ?? ""}`)),
      u.body ? h("p", { class: "updates__copy" }, u.body) : null,
      items.length ? h("ul", { class: "announcements" }, items.map((a) => h("li", {},
        a.date ? h("span", { class: "announcements__date" }, a.date) : null,
        h("div", {}, a.title ? h("strong", {}, a.title) : null, a.text ? h("p", {}, a.text) : null)))) : null));
}

function joinSection(site, ctx) {
  const j = site.join;
  const live = ctx.backend.mode !== "none";
  const note = h("p", { class: "signup__note", id: "signup-note", "aria-live": "polite" }, j.note);
  const email = h("input", { id: "email", name: "email", type: "email", placeholder: j.placeholder, autocomplete: "email", required: true, maxlength: 254 });
  const consent = h("input", { id: "consent", name: "consent", type: "checkbox", required: true });
  const trap = h("input", { class: "signup__trap", name: "website", type: "text", tabindex: "-1", autocomplete: "off", "aria-hidden": "true" });
  const button = h("button", { type: "submit" }, j.button, " ", h("span", { "aria-hidden": "true" }, "↗"));
  const privacy = safeUrl(j.privacyUrl);
  const consentRow = h("div", { class: "signup__consent" }, consent,
    h("label", { for: "consent" }, j.consentText, privacy ? [" ", h("a", { href: privacy, rel: "noopener", target: privacy.startsWith("http") ? "_blank" : null }, j.privacyLabel)] : null));
  const form = h("form", { class: "signup", id: "signup-form", novalidate: true },
    h("label", { class: "visually-hidden", for: "email" }, "Email address"), email, button, consentRow, trap, note);

  if (!j.enabled || !live) {
    email.disabled = consent.disabled = button.disabled = true;
    note.textContent = !j.enabled ? "Sign-up is currently closed." : "Sign-up is not connected yet — no email address would be saved.";
  }
  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    if (form.hasAttribute("aria-busy")) return;
    const value = email.value.trim();
    if (trap.value) { note.textContent = "Could not send your request."; return; }
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(value)) { note.textContent = "Please enter a valid email address."; email.focus(); return; }
    if (!consent.checked) { note.textContent = "Please tick the consent box to join."; consent.focus(); return; }
    form.setAttribute("aria-busy", "true"); button.disabled = true; note.textContent = "Saving…";
    try {
      await ctx.backend.addSignup({ email: value.toLowerCase(), consentText: j.consentText });
      note.textContent = "Thank you — your email address has been saved to our list.";
      form.reset();
    } catch (error) {
      console.warn("Signup failed", error);
      note.textContent = error.code === "permission-denied"
        ? "Sign-up is not accepting entries right now. Please try again later."
        : "Something went wrong and your email was not saved. Please try again.";
    } finally { form.removeAttribute("aria-busy"); button.disabled = false; }
  });

  return h("section", { class: "join section-wrap", id: "join", "aria-labelledby": "join-title" },
    h("div", { class: "join__copy" }, h("p", { class: "eyebrow" }, j.eyebrow), h("h2", { id: "join-title" }, j.title)), form);
}

function heroSection(site, ctx) {
  const hero = site.hero;
  const style = { "--hero-pos": `${hero.focal.x}% ${hero.focal.y}%`, "--hero-pos-m": `${hero.focalMobile.x}% ${hero.focalMobile.y}%` };
  const backdrop = h("div", { class: "opening-backdrop", "aria-hidden": "true" },
    imageElement(hero.image, { className: "hero__image", alt: "", focal: hero.focal, resolver: ctx.resolver }), h("div", { class: "hero__shade" }));
  backdrop.querySelector(".hero__image").style.objectPosition = ""; // driven by CSS variables (desktop/mobile)
  const section = h("section", { class: "hero", id: "home", "aria-labelledby": "hero-title" },
    h("div", { class: "hero__copy" }, hero.eyebrow ? h("p", { class: "eyebrow" }, hero.eyebrow) : null, h("h1", { id: "hero-title" }, hero.title)),
    h("a", { class: "hero__scroll", href: hero.ctaTarget, "aria-label": hero.ctaLabel }, h("span", { "aria-hidden": "true" }, "↓")));
  return { backdrop, section, style };
}

/* ---------- page ---------- */
export function renderPage(root, ctx) {
  const { site } = ctx;
  applyAppearance(site.appearance);
  document.title = site.seo.title;
  document.querySelector('meta[name="description"]')?.setAttribute("content", site.seo.description);

  const visible = site.sections.filter((s) => s.visible).map((s) => s.id);
  const build = { products: (o) => productsSection(site, ctx, o), about: () => aboutSection(site, ctx), updates: () => updatesSection(site), join: () => joinSection(site, ctx) };
  const { backdrop, section: hero, style } = heroSection(site, ctx);

  const scene = h("div", { class: "opening-scene", style }, backdrop, hero);
  const rest = [];
  visible.forEach((id, i) => {
    if (i === 0 && id === "products") scene.append(build.products(true)); // original overlap treatment
    else rest.push(build[id](false));
  });

  const main = h("main", { id: "main" }, scene, rest);
  root.replaceChildren(
    ctx.preview ? h("p", { class: "preview-bar", role: "status" }, "Preview — showing unpublished changes, visible only to you.") : null,
    h("a", { class: "skip-link", href: "#main" }, "Skip to content"),
    renderHeader(site, { home: true }), main, renderFooter(site));
  initMotion(site, scene, main);
}

/* ---------- motion (intensity set from admin; always off for reduced-motion) ---------- */
export function initMotion(site, scene, main) {
  const intensity = site.appearance.motion;
  if (reducedMotion() || intensity === 0) return;
  document.documentElement.classList.add("motion-ready");
  const items = main.querySelectorAll(".products, .intro, .updates__inner, .join");
  items.forEach((i) => i.classList.add("reveal"));
  const io = new IntersectionObserver((entries) => entries.forEach((e) => {
    if (e.isIntersecting) { e.target.classList.add("is-visible"); io.unobserve(e.target); }
  }), { threshold: 0.12 });
  items.forEach((i) => io.observe(i));

  const hero = scene.querySelector(".hero");
  const set = (x, y, s) => { scene.style.setProperty("--hero-x", `${x}px`); scene.style.setProperty("--hero-y", `${y}px`); scene.style.setProperty("--hero-scale", s); };
  hero.addEventListener("pointermove", (e) => {
    const b = hero.getBoundingClientRect();
    set((((e.clientX - b.left) / b.width - 0.5) * 10 * intensity).toFixed(2), (((e.clientY - b.top) / b.height - 0.5) * 7 * intensity).toFixed(2), 1 + 0.015 * intensity);
  });
  ["pointerleave", "pointerup"].forEach((t) => hero.addEventListener(t, () => set(0, 0, 1)));

  if (window.matchMedia("(hover: hover) and (pointer: fine)").matches) {
    main.querySelectorAll(".product-card").forEach((card) => {
      card.addEventListener("pointermove", (e) => {
        const b = card.getBoundingClientRect();
        card.style.setProperty("--tilt-x", `${(((e.clientX - b.left) / b.width - 0.5) * 2.2 * intensity).toFixed(2)}deg`);
        card.style.setProperty("--tilt-y", `${(((e.clientY - b.top) / b.height - 0.5) * -2.2 * intensity).toFixed(2)}deg`);
      });
      card.addEventListener("pointerleave", () => { card.style.setProperty("--tilt-x", "0deg"); card.style.setProperty("--tilt-y", "0deg"); });
    });
  }
}
