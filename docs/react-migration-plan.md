# React migration plan (strangler)

Status: plan only. No code changed, no git writes.

## Ground truth (inspected, 2026-10-04)

- `app/page.tsx` is a pure Server Component: `LEGACY_BODY_HTML` opaque string
  - `renderLegacyScriptTags()` opaque string + one `'use client'` island
    (`app/_toast/ToastIsland.tsx`). React creates zero fibers for the legacy
    tree; nothing hydrates.
- `app/legacy/legacy-scripts.ts` emits 20 tags: 12 local defer classics +
  4 deferred CDN tags (SRI) + 1 inline script + 3 deferred-by-default
  modules. `tests/script-loading.test.js` asserts the exact count, the
  document order, and "no JSX `<script>`, no `beforeInteractive`" — every
  slice must update these counts.
- `public/js/init.ts` wires guidance lazily via dynamic `import()`:
  `dialog-manager.js`, then `i18n.js` + `help-controller.js` +
  `guided-tour.js`, exposing `window.ChatlogGuidance = { i18n, help, tour }`
  and `window.i18n`. That dynamic-import seam is where islands plug in.
- The old strangler order's step 3 (`editor-*`) is stale: the 10
  photo-cluster classics were deleted (see
  `tests/script-loading.test.js` comment). There are no `editor-*`
  files in `public/js`.
- Precedent island pattern (`ToastIsland` + `public/js/ui-utils.ts`
  `showToast`): React island installs a `window.__*` bridge on mount,
  legacy callers delegate, graceful silence before mount.

## Hard constraints (every slice)

1. **`#output` rendering and export visuals untouched.** The `#output` /
   `.generated` DOM, coloring-mode selection, `dom-to-image-more` export
   path, and all canvas appearance stay pixel-identical. Guarded by
   `tests/browser/output-layout.spec.js`,
   `tests/browser/domtoimage-fallback.spec.js`,
   `tests/browser/canvas.spec.js`, and `tests/browser/kumo-scope.spec.js`.
2. **Gates stay green after every slice:** `npm run lint`,
   `npm run typecheck`, `npm run bundle:js` (deterministic bundles),
   `npm run render:body` (no drift in `app/legacy/body-html.ts`),
   `npx vitest run`, `npm run build:next`, and
   `npx playwright test --project=desktop`
   (CI in `.github/workflows/ci.yml` runs `lint`, `typecheck`, bundle
   determinism, body sync, prettier check, vitest, next build, and the
   full browser matrix).
3. **No git writes** while executing slices (no commits/tags/pushes).
4. **Per-slice mechanics:** carve the region out of `app/legacy/body.tsx`
   into a `'use client'` island (top-down, following the `ToastIsland`
   precedent); remove the retired classic from `LEGACY_*` lists in
   `app/legacy/legacy-scripts.ts`; update `tests/script-loading.test.js`
   counts/order; run `npm run render:body`; keep a `window.__*` bridge
   only while unconverted legacy callers remain.

## Ordered strangler slices

### Slice 1 — Guidance islands: help modal + guided tour [FIRST, see below]

- Scope: convert the help modal (`#helpModal`, search + sections) and the
  guided tour (`#tourOverlay`, 4 steps) to two `'use client'` islands
  sharing one i18n/locale React context.
- Legacy files retired: `public/js/help-controller.ts` (+ `.js` twin),
  `public/js/guided-tour.ts` (+ `.js` twin); delete their dynamic imports
  in `public/js/init.ts` and the `help`/`tour` fields of
  `window.ChatlogGuidance` (keep `window.i18n` until slice 4).
- React files to add:
  - `app/_guidance/GuidanceProvider.tsx` (locale/i18n context, subscribes
    to the same storage keys; keeps emitting `cm:locale-changed` until
    slice 4 retires the legacy event)
  - `app/_guidance/HelpIsland.tsx` (modal, search filter over
    `HELP_SECTIONS`, focus return)
  - `app/_guidance/TourIsland.tsx` (overlay, step state, skip-on-hidden
    targets, `TOUR_STORAGE_KEY` completion)
  - Carve `#helpModal` + `#tourOverlay` markup out of
    `app/legacy/body.tsx` into the islands' JSX.
- Risks:
  - `dialog-manager.js` stays vanilla: islands must call
    `getDialogManager(document).openModal/release` across the
    React/vanilla boundary (Escape routing, focus trap, inert walk).
  - Tour step 1–2 call `.click()` on `#modeChat`/`#modeCanvas` (legacy
    mode buttons) — keep those IDs stable until slice 4.
  - `init.ts` `isTourOverlayActive()` reads `#tourOverlay.hidden` for
    dialog suspend + changelog interplay — preserve the id + hidden
    semantics in `TourIsland`.
- Verification:
  - Port `tests/help-controller.test.js` + `tests/guided-tour.test.js`
    assertions to island tests (open/search/close/focus-return;
    step/skip/complete/storage-blocked).
  - `npx playwright test --project=desktop tour-changelog dialog-layers`
    must pass unchanged (Escape layering vs changelog drawer).
  - `output-layout` + `canvas` + `kumo-scope` desktop specs unchanged
    (no `#output` proximity, but proves no collateral damage).
  - Full gates per Hard constraints §2.

### Slice 2 — Confirm/alert dialogs (`ui-utils` remainder) [DONE 2026-10-05]

- Shipped: `app/_dialogs/ConfirmIsland.tsx` (owns the native `#appConfirmDialog`
  markup, same ids/classes; promise API via `window.__confirmDialog`, supersede
  - unmount settle as cancelled) + `app/_dialogs/dialog-bridge.ts` (option
    shapes, 1:1 config normalization, legacy i18n lookup). `ui-utils` keeps thin
    `window.show*` shims delegating to the bridge with a native-dialog fallback
    pre-mount; toast/nudge/infobox/changelog bits stay until slice 4. Carved out
    of `body.tsx` (`render:body` clean); `LEGACY_TAIL_SCRIPTS` unchanged.
- Scope: convert `showConfirmDialog`/`showAlertDialog` (currently promise-
  based DOM builders in `ui-utils`) to React. Toast delegation to
  `ToastIsland` already exists — keep it. The post-export support nudge
  is already a Kumo toast (title + description + forum action, 8s
  timeout) dispatched through the rich `window.__kumoToast` bridge —
  no separate island needed; `#supportNudge` markup/CSS are deleted.
- Legacy files retired: shrink `public/js/ui-utils.ts` to the thin
  `window.show*` bridge shims, then delete it and drop `/js/ui-utils.js`
  from `LEGACY_TAIL_SCRIPTS` once all callers use the islands.
- React files to add:
  - `app/_dialogs/ConfirmIsland.tsx` (promise-based confirm/alert API,
    destructive-title heuristics preserved, danger styling identical)
  - `app/_dialogs/dialog-bridge.ts` (`window.showConfirmDialog` /
    `window.showAlertDialog` shims while legacy callers remain)
- Risks:
  - `showConfirmDialog` is called from many legacy controllers with both
    string and options-object shapes — the bridge must accept both and
    resolve the promise on unmount (no hung promises).
  - Focus trap must compose with `dialog-manager` (still vanilla):
    register as a modal layer, don't double-trap.
- Verification:
  - Keep/extend `tests/confirm-dialog.test.js` against the bridge API;
    add island tests for string-vs-object configs and unmount-resolves.
  - `dialog-layers` + `confirm-save-preset` desktop specs green.
  - Full gates per Hard constraints §2.

### Slice 3 — Community + local-projects list UI

- Scope: convert the fetch-and-list UI of `community-controller`
  (gallery, preset cards, preview SVG, save flow) and
  `local-projects-controller` (project list, drawer) to islands. Pure
  logic modules stay vanilla TS (imported, not converted):
  `community-client`, `community-preset-contract`, `project-model`,
  `project-history`, `local-database`, `local-asset-service`.
- Legacy files retired: `public/js/community-controller.ts` (+ twin),
  `public/js/local-projects-controller.ts` (+ twin, drop from
  `LEGACY_MODULE_SCRIPTS`); remove the `community-controller.js` dynamic
  import in `init.ts`.
- React files to add:
  - `app/_community/CommunityIsland.tsx` (+ `PresetCard.tsx`,
    `PresetGallery.tsx`, save-flow dialog wiring)
  - `app/_projects/LocalProjectsIsland.tsx`
  - Shared fetch/error states reuse the slice-2 dialog islands.
- Risks:
  - Largest behavioral surface so far: gallery pagination (max 100),
    built-in presets, disclosure copy, SVG preview URIs
    (`generatePreviewSvgUri`), preset→project patch application via
    `project-state-bridge` — all must stay byte/behavior identical.
  - `community-controller` consumes `dialog-manager` directly; same
    cross-boundary discipline as slice 1.
- Verification:
  - Existing suites keep passing against the unconverted pure modules:
    `community-client`, `community-config`, `community-handlers`,
    `community-preset-contract`, `community-local-presets`,
    `local-projects-controller` (ported to island level where DOM is
    involved), `project-model`, `project-state-bridge`.
  - `local-projects` desktop spec green; no new network-request shape
    (assert request URLs/bodies unchanged in tests).
  - Full gates per Hard constraints §2.

### Slice 4 — App shell + bootstrap (`init.js`, `app.js`, i18n provider)

- Scope: convert page bootstrap to React: features modal, changelog
  drawer/popover, toolbar overflow, locale selector + i18n provider, and
  the `app.js` UI shell bits that do NOT touch `#output` or export.
  Convert `dialog-manager` to a React context/hook here — this is the
  last slice with vanilla modal callers, so the vanilla manager can
  finally retire.
- Legacy files retired: `public/js/init.ts` (+ twin, drop from
  `LEGACY_TAIL_SCRIPTS`), `public/js/app.ts` (+ twin, drop from
  `LEGACY_BODY_SCRIPTS`) after auditing every `app.js` function for
  `#output`/export proximity (anything touching render/export moves to
  slice 5 instead), `public/js/dialog-manager.ts` (+ twin),
  `public/js/help-tour.css` consumers as markup moves.
- React files to add:
  - `app/_shell/AppShell.tsx` (composition root for slices 1–4 islands)
  - `app/_shell/DialogManagerContext.tsx` (port of layer order:
    persistent layers → modals, topmost-Escape-only, tour/native-dialog
    suspend, `kumoToastRoot`/`appConfirmDialog` exemptions)
  - `app/_shell/FeaturesModal.tsx`, `app/_shell/ChangelogDrawer.tsx`,
    `app/_shell/ToolbarOverflow.tsx`, `app/_shell/LocaleSelect.tsx`
  - `app/_i18n/I18nProvider.tsx` (replaces `window.i18n` /
    `window.ChatlogGuidance.i18n`; keeps `cm:locale-changed` dispatch
    until slice 5 removes the last legacy listener)
- Risks:
  - Highest coupling slice: `app.js` is ~59 KB with implicit globals
    (e.g. `toggleHistoryPanel` consumed via `window` by `init.js`).
    Requires a full `app.js` export audit first; any function reaching
    `#output`, `ChatlogParser`, canvas, palette, or export stays behind.
  - `suppressHydrationWarning` architecture changes: carved regions
    become real hydrated JSX — each island needs its own hydration
    contract (no legacy script may mutate inside an island's DOM).
  - `script-loading.test.js` "no fibers" test must be rewritten to assert
    the new island list instead of the opaque-string totality.
- Verification:
  - `tests/dialog-manager.test.js` ported 1:1 to the context
    (layer order, Escape routing, suspend predicates, exemptions).
  - `tests/i18n.test.js` (57-key locale parity incl. `tr`) green against
    the provider; `tour-changelog`, `dialog-layers`, `toolbar-layout`
    desktop specs green.
  - Full gates per Hard constraints §2.

### Slice 5 — Render core: LAST, explicitly out of scope for now

- Scope (frozen): `chatlog-parser`, `chat.js`, `canvas-controller`,
  `canvas-renderer`, `canvas-scene`, `canvas-geometry`,
  `canvas-chat-segments`, `canvas-asset-registry`, `color-palette`,
  `color-picker`, `image-stack`, `custom-fonts`, export/share/telemetry
  (`public-share-controller`, `telemetry-client`, `feedback-client`,
  `cloud-sync-*`, `autosave-controller`, `bcmag-file`, `project-*`
  persistence glue as it touches render state).
- Why last/frozen: this is the `#output` + export visual pipeline that
  Hard constraint §1 protects. Converting it means re-proving pixel
  identity of every export path (`output-layout`,
  `domtoimage-fallback`, `canvas` specs) under a new renderer — do it
  only with screenshot-diff infrastructure in place, one module at a
  time, after slices 1–4 are stable in production.

## First-slice pick: Slice 1 (guidance islands)

Justification:

1. **Smallest blast radius.** `help-controller.ts` (~2.4 KB) and
   `guided-tour.ts` (~5.3 KB) are the smallest stateful controllers; both
   are pure factories (`createHelpController`/`createGuidedTour`) with
   injected `{ i18n, document, storage }` deps and no implicit globals
   beyond the `window.ChatlogGuidance` handle that `init.ts` itself
   creates — deleting that handle is a 3-line change at a single call
   site (`public/js/init.ts`).
2. **Clean seam.** Both load via dynamic `import()` in `init.ts`, never
   via the 20-tag static order, so no `legacy-scripts.ts` reorder risk;
   only the `script-loading` count for removed files needs no change at
   all (they were never in the static list — verification is
   `ChatlogGuidance`-absence + island tests).
3. **Zero `#output`/export proximity.** Help + tour touch only
   `#helpModal`/`#tourOverlay` and mode-button clicks; no path to
   `#output`, canvas, palette, or `dom-to-image-more`. Hard constraint
   §1 holds trivially.
4. **Proves the island pattern end-to-end.** Slice 1 exercises every
   mechanic later slices need: carve-out from `app/legacy/body.tsx` +
   `npm run render:body`, `'use client'` island with hydration contract,
   vanilla `dialog-manager` interop, `window.__*` bridge discipline,
   and unit + desktop-e2e verification — at the lowest possible stakes.
   If the pattern breaks here, slices 2–4 inherit the fix, not the bug.
5. **Fully covered before and after.** `tests/help-controller.test.js`,
   `tests/guided-tour.test.js`, `tests/browser/tour-changelog.spec.js`,
   and `tests/browser/dialog-layers.spec.js` define the contract today;
   the slice ports them to island tests with identical assertions.

## Legacy architecture notes

- Classic scripts in `public/js` communicate via implicit globals (e.g.
  `toggleHistoryPanel` defined globally in `app.js`) — that is why they
  stay parser-inserted `defer` tags composed by
  `app/legacy/legacy-scripts.ts` instead of moving into the module
  graph. Componentize, don't ESM-bundle.

## Per-slice checklist (repeat for slices 1–4)

- [ ] Carve region from `app/legacy/body.tsx`; run `npm run render:body`.
- [ ] Add island(s); remove legacy file(s) + their entry from the bundle
      entry lists in `scripts/legacy-*.ts`; update
      `app/legacy/legacy-scripts.ts` if a tag disappears.
- [ ] Update `tests/script-loading.test.js` counts/order or island-list
      assertions.
- [ ] Port/extend unit tests; keep legacy pure-module suites green.
- [ ] `npm run lint && npm run typecheck`.
- [ ] `npx vitest run` (full).
- [ ] `npm run build:next`.
- [ ] `npx playwright test --project=desktop` (full desktop project;
      at minimum: `tour-changelog`, `dialog-layers`, `output-layout`,
      `canvas`, `kumo-scope`, `confirm-save-preset`, `local-projects`,
      `toolbar-layout`).
- [ ] No git writes; leave the tree reviewable as an uncommitted diff.
