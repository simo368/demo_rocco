# Brand Name — Fashion Website & Admin CMS

A minimal, editorial fashion label website and administration CMS built with modern Vanilla JavaScript and ES Modules. The site requires **no build step, no Node.js/npm dependencies, and no backend server**.

---

## 🚀 Quick Start (Local Development)

Because modern browsers restrict ES Modules loaded via `file://`, serve the project over HTTP:

### Using PowerShell (Windows, built-in)
```powershell
powershell -ExecutionPolicy Bypass -File scripts/serve.ps1 -Port 8080
```
Then open:
- **Public site:** [http://localhost:8080/](http://localhost:8080/)
- **Admin panel:** [http://localhost:8080/admin/](http://localhost:8080/admin/)

---

## 🧪 Dev Mock Mode (No Firebase Needed)

To test the admin panel and public site locally without configuring Firebase:
1. Open [http://localhost:8080/admin/?mock=1](http://localhost:8080/admin/?mock=1)
2. Sign in with the built-in mock accounts:
   - **Admin:** `admin@example.test` / `Test-Password-123`
   - **Non-admin:** `visitor@example.test` / `Test-Password-123`
3. All changes (site text, styles, products, media, and signups) are stored in `localStorage` in your browser.
4. To disable mock mode: open [http://localhost:8080/admin/?mock=0](http://localhost:8080/admin/?mock=0).

---

## ⚡ Connect Firebase (Production Setup)

When you are ready to connect a live Firebase project:

### 1. Create Firebase Project
1. Go to the [Firebase Console](https://console.firebase.google.com/) and create a project.
2. Enable **Firestore Database** in production mode.
3. Enable **Authentication** and activate the **Email/Password** sign-in provider.

### 2. Configure Web Credentials
1. In Firebase Console: **Project settings > General > Your apps > Web app (</>)**.
2. Register an app and copy the `firebaseConfig` object.
3. Open `firebase-config.js` and paste your credentials:
   ```javascript
   export const firebaseConfig = {
     apiKey: "AIzaSy...",
     authDomain: "your-app.firebaseapp.com",
     projectId: "your-app",
     storageBucket: "your-app.appspot.com",
     messagingSenderId: "1234567890",
     appId: "1:1234567890:web:abcdef..."
   };
   ```
*(Refer to `.env.example` for reference documentation).*

### 3. Deploy Security Rules
Deploy `firestore.rules` and `firestore.indexes.json` using Firebase CLI or copy the rules directly into the Firestore Rules tab in the console:
```bash
firebase deploy --only firestore
```
The security rules enforce:
- **Public read:** Published site content and active products.
- **Public write:** Newsletter sign-up submissions only.
- **Admin write:** All CMS configurations, drafts, media, and product changes require authentication and verification against the `admins/` collection.

### 4. Create the First Admin User
1. In Firebase Console: **Authentication > Users > Add user** (e.g. `admin@yourbrand.com`).
2. Copy the newly created user's **User UID**.
3. In **Firestore Database**, create a document:
   - Collection: `admins`
   - Document ID: `<paste User UID>`
   - Fields: `{ "role": "admin", "createdAt": (current timestamp) }`
4. You can now log into `/admin/` with that email and password.

---

## 🛠 Features & Architecture

### Public Storefront (`/`, `/product.html`)
- **Zero build toolchain:** Pure native ES modules and standard CSS.
- **Dynamic content fallback:** If Firebase is not yet configured, the site automatically renders clean built-in fallback content (`js/defaults.js`).
- **Live Draft Preview:** Append `?preview=1` to any page to view unpublished draft changes directly in context.
- **Product detail routing:** Clean URLs via `product.html?slug=<handle>` with legacy redirects (`product-01.html`, etc.).
- **Newsletter subscription:** Submits to the `signups` collection with client-side rate-limiting and validation.
- **Accessibility & Motion:** Automatically honors system `prefers-reduced-motion` settings.

### Admin CMS (`/admin/`)
- **Site Sections:** Edit Hero, About Us, Info/Updates, Join form, Navigation & Footer, and Layout.
- **Theme & Appearance:** Edit color palette (paper, ink, accent), typography scaling, and density.
- **Draft & Publish:** Work on a persistent draft, preview live (`?preview=1`), and publish to production when ready.
- **Catalog Management:** Create, update, reorder, and remove products with pricing, descriptions, and stock statuses.
- **Media Library:** Upload and manage image assets directly.
- **Sign-ups Viewer:** Inspect subscriber lists and export/manage entries.

---

## 📁 File Structure

```text
├── admin/                  # Admin CMS application
│   ├── admin.css          # Admin styling
│   ├── admin.js           # Admin router and controller
│   ├── index.html         # Admin dashboard entry point
│   ├── media.js           # Media library module
│   ├── products.js        # Products CRUD module
│   ├── signups.js         # Newsletter subscribers module
│   ├── site-views.js      # Site section draft editors
│   ├── state.js           # Draft and reactive state management
│   └── ui.js              # Toasts, modals, and UI helpers
├── assets/                # Static image assets (hero, placeholders)
├── js/                    # Shared and public site modules
│   ├── backend.js         # Unified data layer (Firebase / Mock / Fallback)
│   ├── content.js         # Content loader & draft resolver
│   ├── defaults.js        # Default baseline content and products
│   ├── mock-backend.js    # LocalStorage dev mock backend
│   ├── product-page.js    # Product detail page renderer
│   ├── render.js          # Homepage renderer
│   └── shared.js          # DOM builders, validation & utilities
├── scripts/
│   └── serve.ps1          # Standalone PowerShell static server
├── .env.example           # Configuration reference guide
├── app.js                 # Public homepage bootstrapper
├── firebase-config.js     # Firebase client credentials
├── firebase.json          # Firebase hosting & service config
├── firestore.indexes.json # Firestore index definitions
├── firestore.rules        # Security rules
├── index.html             # Homepage
├── product.html           # Product detail page
└── styles.css             # Storefront design styles
```
