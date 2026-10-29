import { loadPublicContent } from "./content.js";
import { renderHeader, renderFooter } from "./render.js";
import { applyAppearance, h, imageElement, formatPrice, availabilityLabel } from "./shared.js";

const params = new URLSearchParams(location.search);
const slug = params.get("slug") ?? "";
const root = document.querySelector("#app");

const ctx = await loadPublicContent({ preview: params.get("preview") === "1" });
const { site } = ctx;
applyAppearance(site.appearance);

const product = ctx.products.find((p) => p.slug === slug);
document.documentElement.classList.remove("is-loading");

if (!product) {
  document.title = `Product not found — ${site.brand.name}`;
  root.replaceChildren(renderHeader(site), h("main", { class: "product-missing" },
    h("p", { class: "eyebrow" }, "404"), h("h1", {}, "Product not found."),
    h("p", {}, "This product does not exist or is no longer available."),
    h("a", { class: "product-banner__back", href: "index.html#products" }, "← Back to products")), renderFooter(site));
} else {
  document.title = `${product.name} — ${site.brand.name}`;
  document.querySelector('meta[name="description"]')?.setAttribute("content", (product.description || product.name).slice(0, 160));
  const images = product.images.length ? product.images : [""];
  const gallery = h("div", { class: "product-banner__gallery" }, images.map((ref, i) =>
    imageElement(ref, { className: "product-banner__image", alt: ref ? `${product.name}${images.length > 1 ? ` — image ${i + 1}` : ""}` : "", focal: product.focal, resolver: ctx.resolver })));
  root.replaceChildren(
    ctx.preview ? h("p", { class: "preview-bar", role: "status" }, "Preview — showing unpublished changes, visible only to you.") : null,
    renderHeader(site),
    h("main", { class: "product-banner" }, gallery,
      h("section", { class: "product-banner__info", "aria-labelledby": "product-title" },
        h("a", { class: "product-banner__back", href: "index.html#products" }, "← Back to products"),
        h("p", { class: "eyebrow" }, site.productsSection.eyebrow),
        h("h1", { id: "product-title" }, product.name),
        h("p", { class: "product-banner__price" }, formatPrice(product)),
        h("p", { class: "product-banner__availability" }, availabilityLabel(product)),
        product.description ? h("p", { class: "product-banner__note" }, product.description) : null)),
    renderFooter(site));
}
