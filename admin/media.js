import { h, imageElement, clamp } from "../js/shared.js";
import { BUILTIN_IMAGES, LIMITS } from "../js/defaults.js";
import { state, mediaUsage } from "./state.js";
import { toast, describeError, confirmDialog, withBusy, fmtBytes, fmtDate } from "./ui.js";

const ALLOWED = ["image/jpeg", "image/png", "image/webp"];
export const ACCEPT = ALLOWED.join(",");

/* ---------- client-side validation + compression (stored in Firestore, so must stay < ~900 KB) ---------- */
function loadBitmap(file) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => { URL.revokeObjectURL(url); resolve(img); };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error("This file could not be read as an image. It may be corrupted.")); };
    img.src = url;
  });
}
const encode = (canvas, type, q) => canvas.toDataURL(type, q);

export async function processImage(file) {
  if (!ALLOWED.includes(file.type)) throw new Error(`"${file.name}" is not supported. Use JPG, PNG or WebP.`);
  if (file.size > LIMITS.maxImageBytes) throw new Error(`"${file.name}" is ${fmtBytes(file.size)}. The maximum upload size is ${fmtBytes(LIMITS.maxImageBytes)}.`);
  const img = await loadBitmap(file);
  let max = Math.min(2400, Math.max(img.naturalWidth, img.naturalHeight));
  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d");
  const draw = (m) => {
    const s = Math.min(1, m / Math.max(img.naturalWidth, img.naturalHeight));
    canvas.width = Math.max(1, Math.round(img.naturalWidth * s)); canvas.height = Math.max(1, Math.round(img.naturalHeight * s));
    ctx.clearRect(0, 0, canvas.width, canvas.height); ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
  };
  let data = "";
  let type = "image/webp";
  for (let attempt = 0; attempt < 12; attempt++) {
    draw(max);
    for (const q of [0.88, 0.78, 0.68, 0.58]) {
      data = encode(canvas, "image/webp", q);
      if (!data.startsWith("data:image/webp")) { type = "image/jpeg"; data = encode(canvas, "image/jpeg", q); } else type = "image/webp";
      if (data.length <= LIMITS.maxStoredChars) break;
    }
    if (data.length <= LIMITS.maxStoredChars) break;
    max = Math.round(max * 0.8);
  }
  if (data.length > LIMITS.maxStoredChars) throw new Error(`"${file.name}" is too detailed to compress below 900 KB. Try a smaller image.`);
  const width = canvas.width, height = canvas.height;
  const t = Math.min(1, 320 / Math.max(width, height));
  canvas.width = Math.round(width * t); canvas.height = Math.round(height * t); ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
  return { name: file.name.replace(/\.[^.]+$/, "").slice(0, 100), type, size: Math.round(data.length * 0.75), width, height, thumb: encode(canvas, "image/jpeg", 0.7), data };
}

export async function refreshMedia() {
  state.media = await state.backend.listMedia();
  return state.media;
}

/* ---------- reference rendering inside admin ---------- */
export const thumbFor = (ref, cls = "thumb") => imageElement(ref, { className: cls, alt: "", focal: { x: 50, y: 50 }, resolver: state.resolver });

/* ---------- image picker (modal) ---------- */
export function pickImage({ allowNone = false } = {}) {
  return new Promise(async (resolve) => {
    const dialog = h("dialog", { class: "dialog dialog--wide", "aria-labelledby": "pick-title" });
    const finish = (value) => { dialog.close(); dialog.remove(); resolve(value); };
    const grid = h("div", { class: "media-grid" });
    const status = h("p", { class: "hint", role: "status" });
    const upload = h("input", { type: "file", accept: ACCEPT, class: "visually-hidden", id: "pick-upload" });

    const choice = (ref, label, thumb) => h("button", { type: "button", class: "media-card media-card--pick", onclick: () => finish(ref) },
      h("span", { class: "media-card__img" }, thumb), h("span", { class: "media-card__name" }, label));

    async function fill() {
      grid.replaceChildren(...BUILTIN_IMAGES.map((b) => choice(b.ref, b.label, thumbFor(b.ref))));
      try {
        await refreshMedia();
        state.media.forEach((m) => grid.append(choice(`media:${m.id}`, m.name, h("img", { src: m.thumb, alt: "" }))));
        if (!state.media.length) status.textContent = "No uploaded images yet — upload one below.";
      } catch (e) { status.textContent = describeError(e); }
    }
    upload.addEventListener("change", async () => {
      const file = upload.files[0]; upload.value = ""; if (!file) return;
      status.textContent = "Processing image…";
      try {
        const item = await processImage(file);
        const id = await state.backend.addMedia(item);
        finish(`media:${id}`);
      } catch (e) { status.textContent = ""; toast(describeError(e), "error"); status.textContent = describeError(e); }
    });
    dialog.append(h("div", { class: "dialog__body" },
      h("h2", { id: "pick-title" }, "Choose an image"), status, grid,
      h("div", { class: "dialog__actions" },
        h("button", { type: "button", class: "btn", onclick: () => finish(null) }, "Cancel"),
        allowNone ? h("button", { type: "button", class: "btn", onclick: () => finish("") }, "No image") : null,
        h("label", { class: "btn btn--primary", for: "pick-upload", tabindex: "0", onkeydown: (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); upload.click(); } } }, "Upload new image"), upload)));
    dialog.addEventListener("cancel", (e) => { e.preventDefault(); finish(null); });
    document.body.append(dialog); dialog.showModal();
    fill();
  });
}

/* ---------- focal point editor with live crop previews ---------- */
export function focalEditor({ label, ref, focal, crops, onChange }) {
  const box = h("div", { class: "focal" });
  const dot = h("span", { class: "focal__dot", "aria-hidden": "true" });
  const sprite = ref.startsWith("sprite:");
  const pic = imageElement(ref, { className: "focal__img", alt: "", focal: { x: 50, y: 50 }, resolver: state.resolver });
  if (sprite) pic.style.aspectRatio = "0.81"; else { pic.style.objectFit = "contain"; pic.style.height = "auto"; }
  box.append(pic, dot);
  const previews = crops.map((c) => {
    const frame = h("div", { class: "crop", style: { aspectRatio: c.aspect, width: c.width ?? "100%" } });
    return { c, frame };
  });
  const update = () => {
    dot.style.left = `${focal.x}%`; dot.style.top = `${focal.y}%`;
    previews.forEach(({ c, frame }) => frame.replaceChildren(imageElement(ref, { className: "crop__img", alt: "", focal, resolver: state.resolver })));
  };
  const set = (event) => {
    const b = box.getBoundingClientRect();
    focal.x = sprite ? focal.x : Math.round(clamp(((event.clientX - b.left) / b.width) * 100, 0, 100));
    focal.y = Math.round(clamp(((event.clientY - b.top) / b.height) * 100, 0, 100));
    update(); onChange?.();
  };
  box.addEventListener("pointerdown", (e) => { box.setPointerCapture(e.pointerId); set(e); box.onpointermove = set; });
  box.addEventListener("pointerup", () => { box.onpointermove = null; });
  box.tabIndex = 0;
  box.setAttribute("role", "group"); box.setAttribute("aria-label", `${label}: click or use arrow keys to set the focal point`);
  box.addEventListener("keydown", (e) => {
    const d = { ArrowLeft: [-5, 0], ArrowRight: [5, 0], ArrowUp: [0, -5], ArrowDown: [0, 5] }[e.key];
    if (!d) return; e.preventDefault();
    focal.x = clamp(focal.x + d[0], 0, 100); focal.y = clamp(focal.y + d[1], 0, 100); update(); onChange?.();
  });
  update();
  return h("div", { class: "field" }, h("span", { class: "label" }, label),
    h("p", { class: "hint" }, sprite ? "Click to set the vertical focus. This original panel can only be adjusted up/down." : "Click the image (or use arrow keys) to choose the point that must stay visible when the image is cropped."),
    h("div", { class: "focal-wrap" }, box, h("div", { class: "crops" }, previews.map(({ c, frame }) => h("figure", {}, frame, h("figcaption", {}, c.label))))));
}

/** Image chooser bound to obj[key] (a ref string). */
export function imageField(label, obj, key, { onChange, allowNone = false, hint } = {}) {
  const holder = h("div", { class: "field" });
  const render = () => {
    const ref = obj[key];
    holder.replaceChildren(
      h("span", { class: "label" }, label),
      h("div", { class: "image-field" },
        ref ? h("span", { class: "image-field__thumb" }, thumbFor(ref)) : h("span", { class: "image-field__thumb image-field__thumb--empty" }, "No image"),
        h("div", { class: "image-field__actions" },
          h("button", { type: "button", class: "btn", onclick: async () => {
            const picked = await pickImage({ allowNone });
            if (picked === null) return;
            obj[key] = picked; onChange?.(true); render();
          } }, ref ? "Replace image" : "Choose image"),
          ref && allowNone ? h("button", { type: "button", class: "btn", onclick: () => { obj[key] = ""; onChange?.(true); render(); } }, "Remove") : null)),
      hint ? h("p", { class: "hint" }, hint) : null);
  };
  render();
  return holder;
}

/* ---------- media library view ---------- */
export async function mediaView(root) {
  root.replaceChildren(h("p", { class: "hint", role: "status" }, "Loading media…"));
  try { await refreshMedia(); } catch (e) { root.replaceChildren(h("p", { class: "error" }, describeError(e))); return; }
  const upload = h("input", { type: "file", accept: ACCEPT, multiple: true, id: "media-upload", class: "visually-hidden" });
  const status = h("p", { class: "hint", role: "status" });

  const render = () => {
    const grid = h("div", { class: "media-grid" });
    for (const m of state.media) {
      const used = mediaUsage(m.id);
      const replace = h("input", { type: "file", accept: ACCEPT, class: "visually-hidden", id: `rep-${m.id}`, "aria-label": `Replace ${m.name}` });
      replace.addEventListener("change", async () => {
        const file = replace.files[0]; replace.value = ""; if (!file) return;
        try { status.textContent = "Replacing…"; const item = await processImage(file); await state.backend.replaceMedia(m.id, { ...item, name: m.name }); state.clearResolver?.(); toast("Image replaced. Every place that uses it now shows the new file."); await mediaView(root); }
        catch (e) { status.textContent = ""; toast(describeError(e), "error"); }
      });
      grid.append(h("article", { class: "media-card" },
        h("span", { class: "media-card__img" }, h("img", { src: m.thumb, alt: m.name })),
        h("div", { class: "media-card__info" },
          h("p", { class: "media-card__name" }, m.name),
          h("p", { class: "hint" }, `${m.width}×${m.height} · ${fmtBytes(m.size)} · ${fmtDate(m.createdAt?.toDate?.().toISOString?.() ?? m.createdAt)}`),
          h("p", { class: "hint" }, used.length ? `In use — ${used.join(", ")}` : "Not used anywhere"),
          h("div", { class: "actions" },
            h("label", { class: "btn btn--sm", for: `rep-${m.id}`, tabindex: "0", onkeydown: (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); replace.click(); } } }, "Replace"), replace,
            h("button", { type: "button", class: "btn btn--sm btn--danger-text", onclick: async (e) => {
              const ok = await confirmDialog({ title: `Delete "${m.name}"?`, message: used.length ? `This image is used in: ${used.join(", ")}. Those places will show an empty image until you choose another one. This cannot be undone.` : "This cannot be undone.", confirmLabel: "Delete image" });
              if (!ok) return;
              try { await withBusy(e.target, () => state.backend.deleteMedia(m.id)); toast("Image deleted."); await mediaView(root); } catch (err) { toast(describeError(err), "error"); }
            } }, "Delete")))));
    }
    root.replaceChildren(
      h("div", { class: "page-head" }, h("div", {}, h("h1", {}, "Media library"), h("p", { class: "hint" }, "JPG, PNG or WebP up to 8 MB. Images are resized and compressed automatically before saving.")),
        h("label", { class: "btn btn--primary", for: "media-upload", tabindex: "0", onkeydown: (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); upload.click(); } } }, "Upload images"), upload),
      status,
      state.media.length ? grid : h("p", { class: "empty" }, "No uploaded images yet. The original site photographs remain available when choosing images."));
  };
  upload.addEventListener("change", async () => {
    const files = [...upload.files]; upload.value = "";
    for (const file of files) {
      status.textContent = `Processing ${file.name}…`;
      try { const item = await processImage(file); await state.backend.addMedia(item); toast(`Uploaded ${file.name}`); }
      catch (e) { toast(describeError(e), "error"); }
    }
    await mediaView(root);
  });
  render();
}
