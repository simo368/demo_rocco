import { loadPublicContent } from "./js/content.js";
import { renderPage } from "./js/render.js";

const root = document.querySelector("#app");
const preview = new URLSearchParams(location.search).get("preview") === "1";

loadPublicContent({ preview }).then((ctx) => {
  renderPage(root, ctx);
  document.documentElement.classList.remove("is-loading");
  // honour an in-page anchor once content exists (e.g. index.html#products)
  if (location.hash) document.getElementById(location.hash.slice(1))?.scrollIntoView();
});
