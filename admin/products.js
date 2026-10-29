import { h, normalizeProduct, slugify, formatPrice, clone } from "../js/shared.js";
import { AVAILABILITY, CURRENCIES } from "../js/defaults.js";
import { state } from "./state.js";
import { toast, describeError, confirmDialog, withBusy, textField, selectField, section, row } from "./ui.js";
import { imageField, focalEditor, pickImage, thumbFor } from "./media.js";

const STATUS = { draft: "Draft", published: "Published", archived: "Archived" };
let tab = "active";

export async function refreshProducts() {
  state.products = (await state.backend.listProducts({ all: true })).map((p) => normalizeProduct(p, p.id));
  return state.products;
}

export async function productsView(root, edit) {
  if (edit !== undefined) return editView(root, edit);
  root.replaceChildren(h("p", { class: "hint", role: "status" }, "Loading products…"));
  try { await refreshProducts(); } catch (e) { root.replaceChildren(h("p", { class: "error" }, describeError(e))); return; }
  const reload = () => productsView(root);
  const list = state.products.filter((p) => (tab === "archived" ? p.status === "archived" : p.status !== "archived"));
  const active = state.products.filter((p) => p.status !== "archived");

  const move = async (p, dir) => {
    const ids = active.map((x) => x.id); const i = ids.indexOf(p.id); const j = i + dir;
    if (j < 0 || j >= ids.length) return;
    [ids[i], ids[j]] = [ids[j], ids[i]];
    try { await state.backend.reorderProducts(ids); toast("Order saved."); await reload(); } catch (e) { toast(describeError(e), "error"); }
  };

  const items = list.map((p, idx) => h("li", { class: "list-row" },
    h("span", { class: "list-row__thumb" }, p.images[0] ? thumbFor(p.images[0]) : h("span", { class: "muted" }, "No image")),
    h("div", { class: "list-row__main" },
      h("a", { href: `#products/${p.id}`, class: "list-row__title" }, p.name),
      h("p", { class: "hint" }, `/${p.slug} · ${formatPrice(p)} · ${AVAILABILITY[p.availability]}`),
      h("span", { class: `chip chip--${p.status}` }, STATUS[p.status])),
    h("div", { class: "actions" },
      tab === "active" ? [
        h("button", { type: "button", class: "btn btn--sm", "aria-label": `Move ${p.name} up`, disabled: idx === 0, onclick: () => move(p, -1) }, "↑"),
        h("button", { type: "button", class: "btn btn--sm", "aria-label": `Move ${p.name} down`, disabled: idx === list.length - 1, onclick: () => move(p, 1) }, "↓")] : null,
      h("a", { class: "btn btn--sm", href: `#products/${p.id}` }, "Edit"),
      h("button", { type: "button", class: "btn btn--sm", onclick: async (e) => {
        const copy = { ...clone(p), name: `${p.name} (copy)`, slug: uniqueSlug(`${p.slug}-copy`), status: "draft", sortOrder: nextOrder() };
        try { await withBusy(e.target, () => state.backend.saveProduct(null, copy)); toast("Duplicated as a draft."); await reload(); } catch (err) { toast(describeError(err), "error"); }
      } }, "Duplicate"),
      h("button", { type: "button", class: "btn btn--sm", onclick: async (e) => {
        const archive = p.status !== "archived";
        try { await withBusy(e.target, () => state.backend.saveProduct(p.id, { ...p, status: archive ? "archived" : "draft" })); toast(archive ? "Archived. It is no longer visible on the site." : "Restored as a draft."); await reload(); } catch (err) { toast(describeError(err), "error"); }
      } }, p.status === "archived" ? "Restore" : "Archive"),
      h("button", { type: "button", class: "btn btn--sm btn--danger-text", onclick: async (e) => {
        if (!(await confirmDialog({ title: `Delete "${p.name}"?`, message: "The product is removed permanently and its page will stop working. Consider archiving instead. This cannot be undone.", confirmLabel: "Delete product" }))) return;
        try { await withBusy(e.target, () => state.backend.deleteProduct(p.id)); toast("Product deleted."); await reload(); } catch (err) { toast(describeError(err), "error"); }
      } }, "Delete"))));

  root.replaceChildren(
    h("div", { class: "page-head" }, h("div", {}, h("h1", {}, "Products"),
      h("p", { class: "hint" }, "Only “Published” products appear on the public site. Purchase and checkout controls stay hidden until a commerce integration is connected.")),
      h("a", { class: "btn btn--primary", href: "#products/new" }, "New product")),
    h("div", { class: "tabs", role: "tablist" }, ["active", "archived"].map((t) => h("button", { type: "button", role: "tab", "aria-selected": String(tab === t), class: "tab", onclick: () => { tab = t; reload(); } }, t === "active" ? `Active (${active.length})` : `Archived (${state.products.length - active.length})`))),
    list.length ? h("ul", { class: "list" }, items) : h("div", { class: "empty" }, h("p", {}, tab === "active" ? "No products yet. Click “New product” to add one." : "Nothing archived.")));
}

const nextOrder = () => Math.max(0, ...state.products.map((p) => p.sortOrder)) + 1;
function uniqueSlug(base, ignoreId) {
  let slug = base || "product", n = 2;
  while (state.products.some((p) => p.slug === slug && p.id !== ignoreId)) slug = `${base}-${n++}`;
  return slug;
}

async function editView(root, id) {
  const isNew = id === "new";
  if (!state.products.length && !isNew) await refreshProducts().catch(() => {});
  const found = isNew ? null : state.products.find((p) => p.id === id);
  if (!isNew && !found) { root.replaceChildren(h("p", { class: "error" }, "Product not found."), h("a", { href: "#products" }, "← Back to products")); return; }
  const p = found ? clone(found) : { name: "", slug: "", description: "", images: [], focal: { x: 50, y: 45 }, price: null, currency: "EUR", availability: "coming-soon", status: "draft", sortOrder: nextOrder() };
  let slugTouched = !isNew;
  const errors = h("div", { class: "error", role: "alert", hidden: true });
  const priceInput = h("input", { id: "price", type: "number", min: 0, max: 1000000, step: "0.01", inputmode: "decimal" });
  priceInput.value = p.price ?? "";
  priceInput.addEventListener("input", () => { p.price = priceInput.value === "" ? null : Number(priceInput.value); });

  const slugField = textField("URL slug", p, "slug", { max: 80, hint: "Lowercase letters, numbers and hyphens. Used in the product link." });
  const nameField = textField("Name", p, "name", { max: 120, onChange: () => { if (!slugTouched) { p.slug = slugify(p.name); slugField.querySelector("input").value = p.slug; } } });
  slugField.querySelector("input").addEventListener("input", () => { slugTouched = true; });

  const imagesBox = h("div", { class: "field" });
  const renderImages = () => {
    imagesBox.replaceChildren(h("span", { class: "label" }, "Images"),
      h("p", { class: "hint" }, "The first image is used on the catalog and as the main product image."),
      h("ul", { class: "list list--tight" }, p.images.map((ref, i) => h("li", { class: "list-row" },
        h("span", { class: "list-row__thumb" }, thumbFor(ref)), h("div", { class: "list-row__main" }, i === 0 ? "Main image" : `Image ${i + 1}`),
        h("div", { class: "actions" },
          h("button", { type: "button", class: "btn btn--sm", disabled: i === 0, "aria-label": "Move image up", onclick: () => { [p.images[i - 1], p.images[i]] = [p.images[i], p.images[i - 1]]; renderImages(); } }, "↑"),
          h("button", { type: "button", class: "btn btn--sm", disabled: i === p.images.length - 1, "aria-label": "Move image down", onclick: () => { [p.images[i + 1], p.images[i]] = [p.images[i], p.images[i + 1]]; renderImages(); } }, "↓"),
          h("button", { type: "button", class: "btn btn--sm btn--danger-text", onclick: () => { p.images.splice(i, 1); renderImages(); } }, "Remove"))))),
      p.images.length < 10 ? h("button", { type: "button", class: "btn", onclick: async () => { const ref = await pickImage(); if (ref) { p.images.push(ref); renderImages(); } } }, "Add image") : null,
      p.images[0] ? focalEditor({ label: "Focal point of the main image", ref: p.images[0], focal: p.focal, crops: [{ label: "Catalog", aspect: "1 / 1", width: "9rem" }, { label: "Catalog (mobile)", aspect: "0.76", width: "7rem" }] }) : null);
  };
  renderImages();

  const validate = () => {
    const problems = [];
    if (!p.name.trim()) problems.push("Name is required.");
    if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(p.slug)) problems.push("Slug may only contain lowercase letters, numbers and single hyphens.");
    else if (state.products.some((x) => x.slug === p.slug && x.id !== id)) problems.push(`Another product already uses the slug “${p.slug}”.`);
    if (p.price !== null && (!Number.isFinite(p.price) || p.price < 0 || p.price > 1000000)) problems.push("Price must be between 0 and 1,000,000.");
    if (p.status === "published" && !p.images.length) problems.push("Add at least one image before publishing.");
    return problems;
  };

  const save = async (event) => {
    const problems = validate();
    errors.hidden = !problems.length;
    errors.replaceChildren(...problems.map((t) => h("p", {}, t)));
    if (problems.length) { errors.focus?.(); return; }
    try {
      const clean = normalizeProduct({ ...p, price: p.price === null ? null : Math.round(p.price * 100) / 100 }, undefined);
      delete clean.id;
      await withBusy(event.submitter ?? event.target, () => state.backend.saveProduct(isNew ? null : id, clean));
      toast(p.status === "published" ? "Saved — live on the site." : "Saved.");
      location.hash = "#products";
    } catch (e) { toast(describeError(e), "error"); }
  };

  const form = h("form", { class: "stack", novalidate: true, onsubmit: (e) => { e.preventDefault(); save(e); } },
    h("div", { class: "page-head" }, h("div", {}, h("a", { href: "#products" }, "← Products"), h("h1", {}, isNew ? "New product" : p.name || "Edit product")),
      h("button", { type: "submit", class: "btn btn--primary" }, "Save product")),
    errors,
    section("Details", nameField, slugField, textField("Description", p, "description", { multiline: true, max: 2000, rows: 5 })),
    section("Price & availability",
      row(h("div", { class: "field" }, h("label", { for: "price" }, "Price"), priceInput, h("p", { class: "hint" }, "Leave empty to show “—”.")),
        selectField("Currency", p, "currency", Object.fromEntries(CURRENCIES.map((c) => [c, c])))),
      selectField("Availability", p, "availability", AVAILABILITY, { hint: "Shown identically on the catalog and the product page. No purchase button is shown." }),
      selectField("Visibility", p, "status", { draft: "Draft (hidden)", published: "Published (visible)", archived: "Archived (hidden)" })),
    section("Images", imagesBox),
    !isNew && p.slug ? h("p", { class: "hint" }, h("a", { href: `../product.html?slug=${encodeURIComponent(p.slug)}&preview=1`, target: "_blank", rel: "noopener" }, "Open preview in a new tab ↗"), " (shows the last saved version)") : null);
  root.replaceChildren(form);
}
