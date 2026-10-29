export const state = {
  backend: null,
  user: null,
  draft: null,      // working copy of site content (draft)
  published: null,  // last published site content (or null)
  products: [],
  media: [],
  resolver: null,
  dirty: false      // unsaved edits to the draft
};

export const markDirty = () => {
  state.dirty = true;
  document.dispatchEvent(new Event("admin:dirty"));
};
export const markClean = () => {
  state.dirty = false;
  document.dispatchEvent(new Event("admin:dirty"));
};

const strip = (site) => { const c = JSON.parse(JSON.stringify(site)); delete c.updatedAt; return JSON.stringify(c); };
export const hasUnpublishedChanges = () => !state.published || strip(state.draft) !== strip(state.published);

/** Where an uploaded image is referenced (draft, published site, products). */
export function mediaUsage(id) {
  const ref = `media:${id}`;
  const used = [];
  const scan = (site, label) => {
    if (!site) return;
    if (site.hero?.image === ref) used.push(`${label}: hero`);
    if (site.about?.image === ref) used.push(`${label}: about`);
  };
  scan(state.draft, "Draft"); scan(state.published, "Published");
  for (const p of state.products) if (p.images.includes(ref)) used.push(`Product: ${p.name}`);
  return used;
}
