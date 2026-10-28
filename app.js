// Replace these placeholder values with approved product data when available.
// The fields are kept separate so a future commerce adapter can supply real variants and purchase state.
const catalog = [
  { id: "placeholder-01", handle: "product-01", name: "Product 01", price: null, currency: "EUR", availability: "coming-soon", purchasable: false, imagePosition: "left" },
  { id: "placeholder-02", handle: "product-02", name: "Product 02", price: null, currency: "EUR", availability: "coming-soon", purchasable: false, imagePosition: "center" },
  { id: "placeholder-03", handle: "product-03", name: "Product 03", price: null, currency: "EUR", availability: "coming-soon", purchasable: false, imagePosition: "right" }
];

const productBook = document.querySelector("#product-book");
const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

for (const [index, product] of catalog.entries()) {
  const entry = document.createElement("article");
  entry.className = "book-entry";
  entry.dataset.productId = product.id;
  entry.style.setProperty("--page-order", String(index + 1));

  const page = document.createElement("div");
  page.className = "book-page";

  const image = document.createElement("div");
  image.className = `book-page__image book-page__image--${index + 1}`;
  image.setAttribute("role", "img");
  image.setAttribute("aria-label", `Editorial placeholder image for ${product.name}`);

  const info = document.createElement("div");
  info.className = "book-page__info";

  const eyebrow = document.createElement("p");
  eyebrow.className = "eyebrow";
  eyebrow.textContent = `First release / 0${index + 1}`;

  const name = document.createElement("h2");
  name.textContent = product.name;

  const price = document.createElement("p");
  price.className = "book-page__price";
  price.textContent = product.price === null ? "€ —" : new Intl.NumberFormat("en-IE", { style: "currency", currency: product.currency }).format(product.price);

  const availability = document.createElement("p");
  availability.className = "book-page__availability";
  availability.textContent = product.availability === "coming-soon" ? "Coming soon" : product.availability;

  const link = document.createElement("a");
  link.className = "book-page__link";
  link.href = `${product.handle}.html`;
  link.textContent = "View product ↗";

  info.append(eyebrow, name, price, availability, link);
  page.append(image, info);
  entry.append(page);
  productBook.append(entry);
}

if (!reducedMotion) {
  document.documentElement.classList.add("motion-ready");

  const revealItems = document.querySelectorAll(".intro, .updates__inner, .join");
  revealItems.forEach((item) => item.classList.add("reveal"));

  const revealObserver = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        entry.target.classList.add("is-visible");
        revealObserver.unobserve(entry.target);
      }
    });
  }, { threshold: 0.12 });

  revealItems.forEach((item) => revealObserver.observe(item));

  const hero = document.querySelector(".hero");
  const scene = document.querySelector(".opening-scene");
  const setHeroPosition = (clientX, clientY) => {
    const bounds = hero.getBoundingClientRect();
    const x = (clientX - bounds.left) / bounds.width - 0.5;
    const y = (clientY - bounds.top) / bounds.height - 0.5;
    scene.style.setProperty("--hero-x", `${(x * 10).toFixed(2)}px`);
    scene.style.setProperty("--hero-y", `${(y * 7).toFixed(2)}px`);
    scene.style.setProperty("--hero-scale", "1.015");
  };
  const resetHeroPosition = () => {
    scene.style.setProperty("--hero-x", "0px");
    scene.style.setProperty("--hero-y", "0px");
    scene.style.setProperty("--hero-scale", "1");
  };

  hero.addEventListener("pointermove", (event) => setHeroPosition(event.clientX, event.clientY));
  hero.addEventListener("pointerleave", resetHeroPosition);
  hero.addEventListener("pointerup", resetHeroPosition);

}

const menuToggle = document.querySelector(".menu-toggle");
const siteNav = document.querySelector("#site-nav");

function setMenuOpen(open) {
  menuToggle.setAttribute("aria-expanded", String(open));
  siteNav.classList.toggle("is-open", open);
}

menuToggle.addEventListener("click", () => {
  setMenuOpen(menuToggle.getAttribute("aria-expanded") !== "true");
});

siteNav.addEventListener("click", (event) => {
  if (event.target.closest("a")) setMenuOpen(false);
});

document.addEventListener("keydown", (event) => {
  if (event.key === "Escape") setMenuOpen(false);
});

document.querySelector("#signup-form").addEventListener("submit", (event) => {
  event.preventDefault();
  document.querySelector("#signup-note").textContent = "Preview only — no email was stored. Connect a newsletter service before launch.";
});

document.querySelector("#year").textContent = new Date().getFullYear();
