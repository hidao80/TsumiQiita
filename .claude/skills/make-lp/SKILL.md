---
name: make-lp
description: Create or update a static `index.html` landing page (plus `style.css` / `main.js` / `main.min.js`, no build step) whose content is derived from THIS repository's own README/package.json/AGENTS.md — not generic boilerplate. Supports light/dark themes, OGP (including X.com), JSON-LD schema, a Twemoji SVG favicon, multi-language via the `multilanguagejs` CDN build, and copy-to-clipboard command boxes.
---

# make-lp

Generate a static landing page (`index.html` + `style.css` + `main.js`/`main.min.js`) whose content is pulled from the repository it lives in — never invent features, providers, or commands that aren't actually in the repo.

## Source of truth for content

Before writing anything, read:

- `README.md` — overview, features, tech stack, install/quickstart commands
- `package.json` — name, description, dependencies (drives the tech-stack badges)
- `AGENTS.md` / `CLAUDE.md` — project purpose, and any supported-providers/config table if the project has one
- the existing `docs/index.html` (if present) — reuse its section structure and edit content in place rather than starting over, unless a redesign was explicitly requested

## Required elements

1. **Light/dark theme** — `prefers-color-scheme: dark` media query overriding CSS custom properties (`--bg`, `--text`, `--accent`, etc.). No JS theme toggle unless asked for one.
2. **OGP + Twitter/X Card** — `og:title`, `og:description`, `og:url`, `og:image`, `og:type`, `og:site_name`, `twitter:card`, `twitter:title`, `twitter:description`, `twitter:image`. Point `og:image`/`twitter:image` at a real asset already in the repo (e.g. `social-preview.png`); if missing, generate one with the `make-social-preview` skill first.
3. **JSON-LD schema** — a `<script type="application/ld+json">` block (`SoftwareApplication` for apps/tools, or whatever `@type` fits the project), kept consistent with the OGP description.
4. **Favicon** — a Twemoji SVG matching the project, referenced via `<link rel="icon">`.
5. **Multi-language support via `multilanguagejs` (CDN, no build step)**:
   ```html
   <script src="https://unpkg.com/multilanguagejs@2.0.1/dist/multilanguagejs.umd.cjs"></script>
   ```
   Wrap every translated element in `<template type="language-group">`, with one child per language carrying a `language="xx"` attribute (not `lang`):
   ```html
   <h2>
     <template type="language-group">
       <span language="en">Features</span>
       <span language="ja">機能</span>
     </template>
   </h2>
   ```
   Each `template[type=language-group]` must contain **exactly one** element per supported language — `multilanguagejs` picks the first `[language=X]` match per template, so duplicates silently lose content.

   Initialize in `main.js`:
   ```js
   var ml = new MultilanguageJS({ languages: [...], defaultLanguage: "en" });
   ml.setLanguage(lang); // on load, and on a <select> switcher's change event
   ```
   `<title>` and `<meta name="description">` are **not** covered by `[language]` templates (the library only updates `textContent` of matched elements, and a `<meta>` tag's translation lives in its `content` attribute, not its text). Keep a small per-language `{ title, description }` dictionary in `main.js` and update those two tags by hand alongside `ml.setLanguage()`.

   Detect the visitor's language from `navigator.language`, persist the chosen language in `localStorage`, and re-apply it on load before falling back to browser detection.

   **Required language set (always, regardless of what the app itself supports):** English (`en`), Japanese (`ja`), Chinese (`zh`), Spanish (`es`), Russian (`ru`) — five languages minimum. This applies even if `src/locales/*.json` or the app's own `i18n.ts`/`i18n.js` only cover a subset (e.g. an app that's `en`/`ja`-only still gets a 5-language landing page). Additional languages may be added on top of these five if requested, but none of the five may be dropped.
6. **Copy-to-clipboard buttons** — every install/run command shown in a `<code>` block gets a copy button using an inline SVG icon (never an emoji), with a checkmark confirmation state driven by `navigator.clipboard.writeText()`. Wrap the `<code>` and its button in a `.code-row` flex container so the layout stays consistent.
7. **Responsive** — mobile-first; no horizontal scroll on narrow viewports except inside containers that are explicitly meant to scroll (e.g. a wide comparison table). Content max-width: `800px`.
8. **Top navbar with language switcher** — a fixed/sticky top navbar spanning the page width; the language `<select>` switcher sits at its right edge (not floated inside the hero).
9. **No build step** — this page must run by opening the HTML file or serving the static folder as-is, independent of whatever bundler the app itself uses (Vite, etc.). Keep `main.js` as the readable source and hand-maintain a matching `main.min.js` — since there is no bundler for this folder, every edit to `main.js` must be mirrored into `main.min.js` by hand (minify manually, keep behavior identical). `<script src="main.min.js">` is what actually loads in the page.

## Workflow

1. Read the content sources listed above.
2. If `docs/index.html` already exists, edit it in place — preserve its section structure and update content rather than replacing it wholesale, unless a redesign was explicitly requested.
3. Structure sections semantically: hero (headline, lead, CTA, primary run command), screenshots (reuse existing repo/GitHub asset URLs if any), features grid, a comparison/config table (if the project has multiple providers/modes/backends worth comparing), quickstart/install commands, tech-stack badges, footer.
4. Reuse existing CSS custom properties and class names already present in the repo's `docs/style.css` instead of inventing a parallel styling system.
5. Update `main.js`, then regenerate `main.min.js` by hand to match.
6. Verify before finishing: no emoji used for interactive icons (SVG only); every `template[type=language-group]` has exactly one child per supported language with no duplicates and none missing; OGP/JSON-LD point at files/URLs that actually exist in the repo; `main.js` and `main.min.js` behave identically.
