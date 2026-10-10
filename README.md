# Chatlog Magician for GTA World Türkiye

> **Archived snapshot — read-only.** This repository is a static public snapshot of the project as of 2026-10-10. It is not maintained here: no further commits, issues, or pull requests are expected.

Convert GTA World chat logs into beautifully formatted images — no screenshot editing needed. Paste a log, adjust characters, colors, censoring, fonts and contrast, then copy or download the result.

Live site: <https://chatlog-magician-tr.vercel.app/>

This is a localized fork of [GTAW Chatlog Magician](https://github.com/aayorishy/gtaw-chatlog-magician) (itself in the lineage of [Chatlog Magician](https://github.com/ulasbayraktar/chatlog-magician)), adapted for GTA World Türkiye with Turkish-first UI plus English, Spanish and Russian locales.

## Features

- **Chat mode** — format logs with per-character colors, censor styles, fonts, contrast and background controls.
- **Canvas mode** — compose the formatted chat over solid colors or uploaded backgrounds with image layers (move, resize, lock, order, opacity, undo/redo) and PNG/JPEG export.
- **Local-first projects** — projects, assets, custom fonts, autosaves and renders stay in IndexedDB; portable `.bcmag` save/open without an account.
- **Local presets** — built-in and browser-stored appearance presets; no account, no network.

## Quickstart

Prerequisites: Node.js 18+ (CI uses 22).

```bash
npm ci
npm run dev        # bundle + render, then Next.js dev server
```

Production build and preview:

```bash
npm run build:next
npm start
```

Feedback delivery needs one server-only variable (see [.env.example](.env.example)); the app runs fully local without it.

## Scripts

| Command                | What it does                                              |
| ---------------------- | --------------------------------------------------------- |
| `npm run dev`          | Regenerate assets, then start the Next.js dev server      |
| `npm run build:next`   | Production build (`prebuild` regenerates assets first)    |
| `npm test`             | Full Vitest suite (`pretest` rebuilds bundles first)           |
| `npm run test:browser` | Playwright e2e (`npx playwright install chromium` first)  |
| `npm run lint`         | ESLint over the repo                                      |
| `npm run typecheck`    | `tsc --noEmit`                                            |
| `npm run bundle:js`    | Build the gitignored legacy IIFE bundles (esbuild)        |
| `npm run render:body`  | Regenerate `app/legacy/body-html.ts` from `body.tsx`      |

CI (`.github/workflows/ci.yml`) runs lint, typecheck, deterministic double-bundle
check, body drift check, Prettier, unit tests, build and the browser suite.

## Project structure

```text
app/                Next.js shell: layout, page, React islands (_guidance, _toast),
                    legacy markup source (legacy/body.tsx) and API routes (api/)
public/js/          Legacy vanilla modules (.ts sources of truth; two
                    legacy-*.js IIFE bundles built by bundle:js, gitignored)
public/color-palette/  Color-palette module (.ts source, bundled) + stylesheet
api/_lib/           Shared server logic (.ts sources, imported directly)
styles/             Stylesheets imported by app/layout.tsx
scripts/            bundle-legacy + render-legacy-body generators
tests/              Vitest unit tests (tests/browser holds Playwright e2e)
docs/               Migration plans
```

The app is mid-migration from a legacy vanilla-JS frontend to React islands
(see [docs/react-migration-plan.md](docs/react-migration-plan.md)). The `#output`
rendering path is frozen by policy: UI work must not change export pixels.

## Deployment

Deploys on Vercel. Optional Discord feedback delivery uses one server-only
variable from `.env.example`.

## Credits

- [@Ulaş Eren Bayraktar](https://github.com/ulasbayraktar) — creator of the original magician for LS-RP.
- [@Jax](https://forum.gta.world/en/topic/130134-guide-dude-man-template-photoshop-template-with-various-rp-lines-and-colors/) — template that inspired the coloring and formatting logic.
- [@blanco](https://github.com/blancodagoat) — enhancements and performance optimizations.
- [@murcielagothenotorious](https://github.com/murcielagothenotorious) — GTA World Türkiye adaptation and localization.

## License

MIT — see [LICENSE](LICENSE) and [NOTICE](NOTICE) (also served live at
[/LICENSE](https://chatlog-magician-tr.vercel.app/LICENSE) and
[/NOTICE](https://chatlog-magician-tr.vercel.app/NOTICE)).
