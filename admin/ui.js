import { h } from "../js/shared.js";

/* ---------- toasts ---------- */
export function toast(message, type = "ok") {
  const region = document.querySelector("#toasts");
  const el = h("div", { class: `toast toast--${type}`, role: type === "error" ? "alert" : "status" }, message);
  region.append(el);
  setTimeout(() => el.remove(), type === "error" ? 9000 : 3500);
}

export function describeError(error) {
  const code = error?.code ?? "";
  const map = {
    "permission-denied": "Permission denied. Your account is not an authorised admin, or the Firestore rules have not been deployed.",
    "unavailable": "Could not reach Firebase. Check your connection and try again.",
    "resource-exhausted": "Storage limit reached. Remove unused media or try a smaller file.",
    "auth/invalid-credential": "Email or password is incorrect.",
    "auth/invalid-email": "That email address is not valid.",
    "auth/too-many-requests": "Too many attempts. Wait a few minutes and try again.",
    "auth/network-request-failed": "Network error. Check your connection and try again."
  };
  return map[code] ?? error?.message ?? "Something went wrong.";
}

/* ---------- confirm dialog (destructive actions) ---------- */
export function confirmDialog({ title, message, confirmLabel = "Delete", danger = true }) {
  return new Promise((resolve) => {
    const dialog = h("dialog", { class: "dialog", "aria-labelledby": "dlg-title" });
    const close = (value) => { dialog.close(); dialog.remove(); resolve(value); };
    dialog.append(h("form", { method: "dialog", class: "dialog__body", onsubmit: (e) => e.preventDefault() },
      h("h2", { id: "dlg-title" }, title), h("p", {}, message),
      h("div", { class: "dialog__actions" },
        h("button", { type: "button", class: "btn", onclick: () => close(false) }, "Cancel"),
        h("button", { type: "button", class: `btn ${danger ? "btn--danger" : "btn--primary"}`, onclick: () => close(true) }, confirmLabel))));
    dialog.addEventListener("cancel", (e) => { e.preventDefault(); close(false); });
    document.body.append(dialog);
    dialog.showModal();
    dialog.querySelector(".btn").focus();
  });
}

/* ---------- busy button helper ---------- */
export async function withBusy(button, task) {
  const label = button.textContent;
  button.disabled = true; button.textContent = "Working…";
  try { return await task(); } finally { button.disabled = false; button.textContent = label; }
}

/* ---------- form fields bound to an object ---------- */
let uid = 0;
const nextId = () => `f${++uid}`;
const wrap = (label, control, hint, id) =>
  h("div", { class: "field" }, h("label", { for: id }, label), control, hint ? h("p", { class: "hint", id: `${id}-hint` }, hint) : null);

export function textField(label, obj, key, { onChange, multiline = false, max = 200, hint, placeholder, type = "text", rows = 4 } = {}) {
  const id = nextId();
  const el = h(multiline ? "textarea" : "input", { id, maxlength: max, placeholder, rows: multiline ? rows : null, type: multiline ? null : type, "aria-describedby": hint ? `${id}-hint` : null });
  el.value = obj[key] ?? "";
  el.addEventListener("input", () => { obj[key] = el.value; onChange?.(); });
  return wrap(label, el, hint, id);
}

export function selectField(label, obj, key, options, { onChange, hint } = {}) {
  const id = nextId();
  const el = h("select", { id }, Object.entries(options).map(([value, text]) => h("option", { value }, text)));
  el.value = obj[key];
  el.addEventListener("change", () => { obj[key] = el.value; onChange?.(); });
  return wrap(label, el, hint, id);
}

export function checkField(label, obj, key, { onChange, hint } = {}) {
  const id = nextId();
  const el = h("input", { id, type: "checkbox" });
  el.checked = !!obj[key];
  el.addEventListener("change", () => { obj[key] = el.checked; onChange?.(); });
  return h("div", { class: "field field--check" }, el, h("label", { for: id }, label), hint ? h("p", { class: "hint" }, hint) : null);
}

export function rangeField(label, obj, key, { min, max, step, format = (v) => v, onChange, hint }) {
  const id = nextId();
  const out = h("output", { for: id }, format(obj[key]));
  const el = h("input", { id, type: "range", min, max, step });
  el.value = obj[key];
  el.addEventListener("input", () => { obj[key] = +el.value; out.textContent = format(obj[key]); onChange?.(); });
  return h("div", { class: "field" }, h("label", { for: id }, label, " ", out), el, hint ? h("p", { class: "hint" }, hint) : null);
}

export function colorField(label, obj, key, { onChange, hint } = {}) {
  const id = nextId();
  const picker = h("input", { id, type: "color", "aria-label": label });
  const hex = h("input", { type: "text", maxlength: 7, class: "hex", "aria-label": `${label} (hex)`, spellcheck: "false" });
  picker.value = hex.value = obj[key];
  picker.addEventListener("input", () => { hex.value = obj[key] = picker.value; onChange?.(); });
  hex.addEventListener("input", () => {
    if (/^#[0-9a-fA-F]{6}$/.test(hex.value)) { obj[key] = picker.value = hex.value.toLowerCase(); onChange?.(); }
  });
  return h("div", { class: "field" }, h("label", { for: id }, label), h("div", { class: "color-row" }, picker, hex), hint ? h("p", { class: "hint" }, hint) : null);
}

/** Destination chooser: in-page sections or a custom URL. Stores a string in obj[key]. */
export function targetField(label, obj, key, { onChange } = {}) {
  const presets = { "#home": "Hero (top of page)", "#products": "Products", "#updates": "Info / Updates", "#about": "About Us", "#join": "Join" };
  const holder = h("div", { class: "field" });
  const render = () => {
    const id = nextId();
    const custom = !(obj[key] in presets);
    const select = h("select", { id }, [...Object.entries({ ...presets, "": "Custom URL…" })].map(([v, t]) => h("option", { value: v }, t)));
    select.value = custom ? "" : obj[key];
    const input = h("input", { type: "text", placeholder: "https://… or /page", maxlength: 300, "aria-label": `${label} custom URL`, hidden: !custom });
    input.value = custom ? obj[key] : "";
    select.addEventListener("change", () => {
      if (select.value) { obj[key] = select.value; input.hidden = true; } else { input.hidden = false; obj[key] = input.value || "https://"; input.value = obj[key]; input.focus(); }
      onChange?.();
    });
    input.addEventListener("input", () => { obj[key] = input.value; onChange?.(); });
    holder.replaceChildren(h("label", { for: id }, label), select, input);
  };
  render();
  return holder;
}

export const section = (title, ...children) => h("section", { class: "card" }, title ? h("h2", {}, title) : null, ...children);
export const row = (...children) => h("div", { class: "row" }, ...children);
export const fmtBytes = (n) => (n > 1024 * 1024 ? `${(n / 1048576).toFixed(1)} MB` : `${Math.max(1, Math.round(n / 1024))} KB`);
export const fmtDate = (iso) => (iso ? new Date(iso).toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short" }) : "—");
