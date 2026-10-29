import { h, applyAppearance, appearanceProblems, contrast } from "../js/shared.js";
import { DEFAULT_SITE, FONT_STACKS, LIMITS, SECTION_LABELS, UPDATE_STATUS } from "../js/defaults.js";
import { state, markDirty } from "./state.js";
import { textField, selectField, checkField, rangeField, colorField, targetField, section, row, toast } from "./ui.js";
import { imageField, focalEditor } from "./media.js";

const head = (title, text) => h("div", { class: "page-head" }, h("div", {}, h("h1", {}, title), text ? h("p", { class: "hint" }, text) : null));
const clone = (v) => JSON.parse(JSON.stringify(v));

/* ---------- Hero ---------- */
export function heroView(root) {
  const d = state.draft, hero = d.hero;
  const imageBox = h("div", { class: "stack" });
  const renderImage = () => imageBox.replaceChildren(
    imageField("Hero image", hero, "image", { onChange: (changed) => { markDirty(); if (changed) renderImage(); } }),
    hero.image ? row(
      focalEditor({ label: "Focal point — desktop", ref: hero.image, focal: hero.focal, onChange: markDirty, crops: [{ label: "Desktop crop (16:9)", aspect: "16 / 9" }] }),
      focalEditor({ label: "Focal point — mobile", ref: hero.image, focal: hero.focalMobile, onChange: markDirty, crops: [{ label: "Mobile crop (9:16)", aspect: "9 / 16", width: "8rem" }] })) : null);
  renderImage();
  root.replaceChildren(head("Hero", "The first screen visitors see."),
    section("Text", textField("Small heading", hero, "eyebrow", { onChange: markDirty, max: 60 }), textField("Title", hero, "title", { onChange: markDirty, max: 80 })),
    section("Image", textField("Image description (for screen readers; leave empty if purely decorative)", hero, "imageAlt", { onChange: markDirty, max: 160 }), imageBox),
    section("Scroll arrow", targetField("Arrow destination", hero, "ctaTarget", { onChange: markDirty }), textField("Arrow accessible label", hero, "ctaLabel", { onChange: markDirty, max: 60 })));
}

/* ---------- About ---------- */
export function aboutView(root) {
  const a = state.draft.about;
  const imageBox = h("div", { class: "stack" });
  const renderImage = () => imageBox.replaceChildren(
    imageField("Editorial image (optional)", a, "image", { allowNone: true, onChange: (changed) => { markDirty(); if (changed) renderImage(); } }),
    a.image ? textField("Image description", a, "imageAlt", { onChange: markDirty, max: 160 }) : null,
    a.image ? focalEditor({ label: "Focal point", ref: a.image, focal: a.focal, onChange: markDirty, crops: [{ label: "Displayed crop (4:5)", aspect: "4 / 5", width: "9rem" }] }) : null);
  renderImage();
  root.replaceChildren(head("About Us"),
    section("Copy", textField("Small heading", a, "eyebrow", { onChange: markDirty, max: 60 }), textField("Title", a, "title", { onChange: markDirty, max: 120 }),
      textField("Text", a, "body", { onChange: markDirty, multiline: true, max: 3000, rows: 7, hint: "Leave a blank line between paragraphs." })),
    section("Image", imageBox));
}

/* ---------- Info / Updates ---------- */
export function updatesView(root) {
  const u = state.draft.updates;
  const list = h("div", { class: "stack" });
  const renderList = () => list.replaceChildren(
    ...u.announcements.map((a, i) => h("div", { class: "subcard" },
      row(textField("Date / label", a, "date", { onChange: markDirty, max: 40, placeholder: "e.g. 12 March" }), textField("Title", a, "title", { onChange: markDirty, max: 120 })),
      textField("Text", a, "text", { onChange: markDirty, multiline: true, max: 600, rows: 3 }),
      h("div", { class: "actions" },
        checkField("Visible", a, "visible", { onChange: markDirty }),
        h("button", { type: "button", class: "btn btn--sm", disabled: i === 0, onclick: () => { [u.announcements[i - 1], u.announcements[i]] = [u.announcements[i], u.announcements[i - 1]]; markDirty(); renderList(); } }, "↑ Up"),
        h("button", { type: "button", class: "btn btn--sm", disabled: i === u.announcements.length - 1, onclick: () => { [u.announcements[i + 1], u.announcements[i]] = [u.announcements[i], u.announcements[i + 1]]; markDirty(); renderList(); } }, "↓ Down"),
        h("button", { type: "button", class: "btn btn--sm btn--danger-text", onclick: () => { if (confirm("Remove this announcement?")) { u.announcements.splice(i, 1); markDirty(); renderList(); } } }, "Remove")))),
    u.announcements.length < 20 ? h("button", { type: "button", class: "btn", onclick: () => { u.announcements.push({ id: `a${Date.now()}`, date: "", title: "", text: "", visible: true }); markDirty(); renderList(); } }, "Add announcement") : null);
  renderList();
  root.replaceChildren(head("Info / Updates", "Release information and announcements."),
    section("Release", textField("Small heading", u, "eyebrow", { onChange: markDirty, max: 60 }), textField("Title", u, "title", { onChange: markDirty, max: 100 }),
      selectField("Status", u, "status", UPDATE_STATUS, { onChange: markDirty }), textField("Details", u, "body", { onChange: markDirty, multiline: true, max: 600, rows: 3 })),
    section("Announcements", list));
}

/* ---------- Join ---------- */
export function joinView(root) {
  const j = state.draft.join;
  const warn = h("p", { class: "warning", hidden: true });
  const check = () => { warn.hidden = !(j.enabled && !j.privacyUrl.trim()); warn.textContent = "No privacy policy link is set. Add one before collecting real email addresses."; };
  root.replaceChildren(head("Join", "Email sign-up form."),
    section("Copy", textField("Small heading", j, "eyebrow", { onChange: markDirty, max: 60 }), textField("Title", j, "title", { onChange: markDirty, max: 100 }),
      row(textField("Input placeholder", j, "placeholder", { onChange: markDirty, max: 40 }), textField("Button label", j, "button", { onChange: markDirty, max: 30 })),
      textField("Note under the form (optional)", j, "note", { onChange: markDirty, max: 200 })),
    section("Sign-up settings",
      checkField("Accept sign-ups", j, "enabled", { onChange: () => { markDirty(); check(); }, hint: "When off, the form is shown disabled with a “closed” message." }),
      textField("Consent checkbox text", j, "consentText", { onChange: markDirty, multiline: true, max: 300, rows: 2, hint: "Visitors must tick this box to join. Have the wording reviewed for your jurisdiction — this tool does not provide legal advice or guarantee compliance." }),
      row(textField("Privacy policy link label", j, "privacyLabel", { onChange: markDirty, max: 40 }), textField("Privacy policy URL", j, "privacyUrl", { onChange: () => { markDirty(); check(); }, max: 300, placeholder: "https://… or /privacy.html" })),
      warn,
      h("div", { class: "notice" }, h("p", {}, "Submissions are stored in Firestore and listed under Sign-ups. No confirmation or newsletter email is sent until you connect an email provider."))));
  check();
}

/* ---------- Navigation & footer ---------- */
export function navView(root) {
  const d = state.draft;
  const navList = h("div", { class: "stack" });
  const social = h("div", { class: "stack" });
  const swap = (arr, i, j) => { [arr[i], arr[j]] = [arr[j], arr[i]]; markDirty(); };
  const renderNav = () => navList.replaceChildren(...d.nav.map((n, i) => h("div", { class: "subcard" },
    row(textField("Label", n, "label", { onChange: markDirty, max: 40 }), targetField("Destination", n, "target", { onChange: markDirty })),
    h("div", { class: "actions" }, checkField("Visible", n, "visible", { onChange: markDirty }),
      h("button", { type: "button", class: "btn btn--sm", disabled: i === 0, onclick: () => { swap(d.nav, i, i - 1); renderNav(); } }, "↑ Up"),
      h("button", { type: "button", class: "btn btn--sm", disabled: i === d.nav.length - 1, onclick: () => { swap(d.nav, i, i + 1); renderNav(); } }, "↓ Down"),
      h("button", { type: "button", class: "btn btn--sm btn--danger-text", onclick: () => { if (confirm(`Remove “${n.label}” from the navigation?`)) { d.nav.splice(i, 1); markDirty(); renderNav(); } } }, "Remove")))),
    d.nav.length < 12 ? h("button", { type: "button", class: "btn", onclick: () => { d.nav.push({ id: `n${Date.now()}`, label: "New link", target: "#home", visible: true }); markDirty(); renderNav(); } }, "Add link") : null);
  const renderSocial = () => social.replaceChildren(...d.footer.social.map((s, i) => h("div", { class: "subcard" },
    row(textField("Name", s, "label", { onChange: markDirty, max: 40, placeholder: "Instagram" }), textField("URL", s, "url", { onChange: markDirty, max: 300, placeholder: "https://instagram.com/…" })),
    h("button", { type: "button", class: "btn btn--sm btn--danger-text", onclick: () => { d.footer.social.splice(i, 1); markDirty(); renderSocial(); } }, "Remove"))),
    d.footer.social.length < 8 ? h("button", { type: "button", class: "btn", onclick: () => { d.footer.social.push({ label: "", url: "https://" }); markDirty(); renderSocial(); } }, "Add social link") : null);
  renderNav(); renderSocial();
  root.replaceChildren(head("Navigation & footer", "Links to sections that are hidden are removed from the menu automatically."),
    section("Brand", textField("Brand name", d.brand, "name", { onChange: markDirty, max: 60 }),
      textField("Page title (browser tab / search)", d.seo, "title", { onChange: markDirty, max: 70 }),
      textField("Page description (search results)", d.seo, "description", { onChange: markDirty, multiline: true, max: 170, rows: 2 })),
    section("Menu", navList),
    section("Footer", textField("Footer text", d.footer, "text", { onChange: markDirty, max: 120, hint: "Use {year} and {brand} to insert the current year and brand name." }), h("h3", {}, "Social links"), social));
}

/* ---------- Layout: section order & visibility ---------- */
export function layoutView(root) {
  const d = state.draft;
  const listEl = h("ol", { class: "list" });
  const render = () => {
    listEl.replaceChildren(h("li", { class: "list-row" }, h("div", { class: "list-row__main" }, h("strong", {}, SECTION_LABELS.home), h("p", { class: "hint" }, "Always first. Edit it under Hero.")), h("span", { class: "chip" }, "Fixed")),
      ...d.sections.map((s, i) => h("li", { class: "list-row" },
        h("div", { class: "list-row__main" }, h("strong", {}, SECTION_LABELS[s.id]), h("p", { class: "hint" }, s.visible ? "Visible" : "Hidden")),
        h("div", { class: "actions" },
          checkField("Show", s, "visible", { onChange: () => { markDirty(); render(); } }),
          h("button", { type: "button", class: "btn btn--sm", disabled: i === 0, "aria-label": `Move ${SECTION_LABELS[s.id]} up`, onclick: () => { [d.sections[i - 1], d.sections[i]] = [d.sections[i], d.sections[i - 1]]; markDirty(); render(); } }, "↑"),
          h("button", { type: "button", class: "btn btn--sm", disabled: i === d.sections.length - 1, "aria-label": `Move ${SECTION_LABELS[s.id]} down`, onclick: () => { [d.sections[i + 1], d.sections[i]] = [d.sections[i], d.sections[i + 1]]; markDirty(); render(); } }, "↓")))));
  };
  render();
  root.replaceChildren(head("Layout", "Show, hide and reorder the sections below the hero."), listEl,
    h("div", { class: "notice" }, h("p", {}, "The soft overlap between the hero and the Products panel is kept when Products is the first section.")),
    section("Products section heading", textField("Small heading", d.productsSection, "eyebrow", { onChange: markDirty, max: 60 }), textField("Title", d.productsSection, "title", { onChange: markDirty, max: 60 }),
      textField("Note (optional)", d.productsSection, "note", { onChange: markDirty, max: 120 })));
}

/* ---------- Appearance ---------- */
export function appearanceView(root) {
  const ap = state.draft.appearance;
  const problems = h("div", { class: "warning", role: "alert", hidden: true });
  const preview = h("div", { class: "ap-preview", "aria-label": "Appearance preview" },
    h("div", { class: "ap-preview__hero" }, h("p", { class: "eyebrow" }, "First collection"), h("h3", {}, "Coming soon.")),
    h("div", { class: "ap-preview__body" }, h("p", { class: "eyebrow" }, "Products"), h("h4", {}, "Product 01"), h("p", { class: "ap-preview__muted" }, "€ 120 · Available"),
      h("p", { class: "ap-preview__copy" }, "A short paragraph of body text to check readability.")),
    h("div", { class: "ap-preview__surface" }, h("p", { class: "eyebrow" }, "Info / Updates"), h("h4", {}, "Drop 01")));
  const refresh = (mark = true) => {
    if (mark !== false) markDirty();
    const list = appearanceProblems(ap);
    problems.hidden = !list.length; problems.replaceChildren(...list.map((t) => h("p", {}, t)));
    if (!list.length) {
      applyAppearance(ap, preview);   // scoped preview only; the admin chrome is not affected
      preview.style.fontSize = `${ap.textScale}rem`;
      preview.style.setProperty("--density", ap.density);
    }
    ratio.textContent = list.length ? "" : `Contrast: text ${contrast(ap.ink, ap.paper).toFixed(1)}:1 · secondary ${contrast(ap.muted, ap.paper).toFixed(1)}:1`;
  };
  const ratio = h("p", { class: "hint" });
  const fonts = Object.fromEntries(Object.entries(FONT_STACKS).map(([k, v]) => [k, v.label]));
  const L = LIMITS;
  root.replaceChildren(head("Appearance", "A few safe controls. Settings that would make text unreadable are blocked."),
    h("div", { class: "split" },
      h("div", { class: "stack" },
        section("Colours", colorField("Page background", ap, "paper", { onChange: refresh }), colorField("Text", ap, "ink", { onChange: refresh }),
          colorField("Secondary text", ap, "muted", { onChange: refresh }), colorField("Updates section background", ap, "surface", { onChange: refresh }), ratio, problems),
        section("Typography", selectField("Headings", ap, "fontHeading", fonts, { onChange: refresh }), selectField("Body & navigation", ap, "fontBody", fonts, { onChange: refresh }),
          rangeField("Text size", ap, "textScale", { ...L.textScale, format: (v) => `${Math.round(v * 100)}%`, onChange: refresh })),
        section("Layout", rangeField("Content width", ap, "contentWidth", { ...L.contentWidth, format: (v) => `${v}px`, onChange: refresh }),
          rangeField("Spacing", ap, "density", { ...L.density, format: (v) => (v < 0.95 ? "Compact" : v > 1.05 ? "Airy" : "Original"), onChange: refresh }),
          rangeField("Animation", ap, "motion", { ...L.motion, format: (v) => (v === 0 ? "Off" : v < 0.5 ? "Subtle" : v < 1 ? "Gentle" : "Original"), onChange: refresh,
            hint: "Visitors who enable “reduce motion” in their device settings never see animation." })),
        h("button", { type: "button", class: "btn", onclick: () => { Object.assign(ap, clone(DEFAULT_SITE.appearance)); markDirty(); appearanceView(root); toast("Appearance reset to the original design (not yet saved)."); } }, "Reset to original design")),
      h("div", { class: "sticky" }, h("h2", {}, "Preview"), preview)));
  refresh(false);
}
