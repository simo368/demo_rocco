// Default content = the approved original site. Used (a) as the seed/migration data
// for Firestore and (b) as a fallback when Firebase is not configured or unreachable.

export const SECTION_IDS = ["products", "about", "updates", "join"];
export const SECTION_LABELS = { home: "Hero", products: "Products", about: "About Us", updates: "Info / Updates", join: "Join" };

export const FONT_STACKS = {
  sans: { label: "Clean sans (original)", css: 'Arial, Helvetica, sans-serif' },
  humanist: { label: "Humanist sans", css: '"Trebuchet MS", "Segoe UI", Verdana, sans-serif' },
  serif: { label: "Classic serif", css: 'Georgia, "Times New Roman", serif' },
  mono: { label: "Typewriter mono", css: '"Courier New", Courier, monospace' }
};

export const AVAILABILITY = {
  "coming-soon": "Coming soon",
  available: "Available",
  unavailable: "Unavailable"
};

export const UPDATE_STATUS = {
  "coming-soon": "Coming soon",
  live: "Live now",
  "sold-out": "Sold out",
  ended: "Ended"
};

export const CURRENCIES = ["EUR", "USD", "GBP", "CHF"];

// Bounded appearance controls. Both the admin UI and the public renderer clamp to these.
export const LIMITS = {
  textScale: { min: 0.9, max: 1.15, step: 0.01 },
  contentWidth: { min: 1100, max: 1680, step: 20 },
  density: { min: 0.8, max: 1.3, step: 0.05 },
  motion: { min: 0, max: 1, step: 0.25 },
  maxImageBytes: 8 * 1024 * 1024,
  maxStoredChars: 900000
};

export const BUILTIN_IMAGES = [
  { ref: "assets/hero-editorial.png", label: "Original hero photograph" },
  { ref: "sprite:0", label: "Original product panel 1" },
  { ref: "sprite:1", label: "Original product panel 2" },
  { ref: "sprite:2", label: "Original product panel 3" }
];

export const DEFAULT_SITE = {
  brand: { name: "Brand Name" },
  seo: {
    title: "Brand Name — First Collection",
    description: "A minimal preview for an independent fashion label. First collection coming soon."
  },
  nav: [
    { id: "home", label: "Home", target: "#home", visible: true },
    { id: "products", label: "Products", target: "#products", visible: true },
    { id: "updates", label: "Info / Updates", target: "#updates", visible: true },
    { id: "about", label: "About Us", target: "#about", visible: true },
    { id: "join", label: "Join", target: "#join", visible: true }
  ],
  sections: SECTION_IDS.map((id) => ({ id, visible: true })),
  hero: {
    eyebrow: "First collection",
    title: "Coming soon.",
    image: "assets/hero-editorial.png",
    imageAlt: "",
    focal: { x: 50, y: 38 },
    focalMobile: { x: 57, y: 50 },
    ctaTarget: "#products",
    ctaLabel: "Explore products"
  },
  productsSection: { eyebrow: "The first release", title: "Products", note: "Purchasing is not available yet." },
  about: {
    eyebrow: "About us",
    title: "A clothing label in the making.",
    body: "The first collection is being prepared. A short introduction to the people and point of view behind the brand will be added here.",
    image: "",
    imageAlt: "",
    focal: { x: 50, y: 50 }
  },
  updates: {
    eyebrow: "Info / Updates",
    title: "Drop 01",
    status: "coming-soon",
    body: "Release details will be shared here.",
    announcements: []
  },
  join: {
    enabled: true,
    eyebrow: "Join",
    title: "Be first to know.",
    placeholder: "Email address",
    button: "Join",
    consentText: "I agree to be contacted by email about this label.",
    privacyLabel: "Privacy policy",
    privacyUrl: "",
    note: ""
  },
  footer: { text: "© {year} {brand}", social: [] },
  appearance: {
    paper: "#f3f1ec",
    ink: "#191918",
    muted: "#767570",
    surface: "#e8e6df",
    fontHeading: "sans",
    fontBody: "sans",
    textScale: 1,
    contentWidth: 1440,
    density: 1,
    motion: 1
  }
};

export const DEFAULT_PRODUCTS = [
  { slug: "product-01", name: "Product 01", description: "Product details and availability will be added before release.", images: ["sprite:0"], focal: { x: 50, y: 45 }, price: null, currency: "EUR", availability: "coming-soon", status: "published", sortOrder: 1 },
  { slug: "product-02", name: "Product 02", description: "Product details and availability will be added before release.", images: ["sprite:1"], focal: { x: 50, y: 45 }, price: null, currency: "EUR", availability: "coming-soon", status: "published", sortOrder: 2 },
  { slug: "product-03", name: "Product 03", description: "Product details and availability will be added before release.", images: ["sprite:2"], focal: { x: 50, y: 45 }, price: null, currency: "EUR", availability: "coming-soon", status: "published", sortOrder: 3 }
];
