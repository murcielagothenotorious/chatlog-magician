import { LEGACY_BODY_HTML } from './legacy/body-html';
import { renderLegacyScriptTags } from './legacy/legacy-scripts';
import ToastIsland from './_toast/ToastIsland';
import ConfirmIsland from './_dialogs/ConfirmIsland';
import GuidanceProvider from './_guidance/GuidanceProvider';
import HelpIsland from './_guidance/HelpIsland';
import TourIsland from './_guidance/TourIsland';

// Server component on purpose: the legacy markup is static HTML rendered once
// at build time (the page prerenders). Nothing hydrates, so the vanilla
// deferred scripts own the DOM freely with zero hydration risk.
//
// The legacy tree ships as ONE opaque string (generated from
// app/legacy/body.tsx by scripts/render-legacy-body.mjs — Next.js rejects
// react-dom/server imports in Server Components, so the render happens at
// build time, not here). React therefore creates zero fibers for the 5000+
// legacy nodes: i18n rewrites, hint HTML, banner classes and every other
// load-time DOM mutation by legacy scripts is invisible to hydration, and no
// mismatch can ever be reported inside this tree. suppressHydrationWarning
// on the wrapper keeps React from even diffing the serialized string.
// Componentize regions top-down during UI polish: each carved-out region
// becomes real JSX again (a 'use client' island) with its own hydration
// contract. After editing body.tsx, run npm run render:body (predev and
// prebuild do it automatically; the drift test fails loudly otherwise).
// Legacy scripts render as ONE opaque HTML string AFTER the markup via
// dangerouslySetInnerHTML — never as JSX script elements (React 19 refuses
// them) and never via next/script beforeInteractive (it drops defer and
// hoists into head, which silently killed half the UI). Order and attributes
// verified against dist/index.html; see app/legacy/legacy-scripts.ts.
export default function Page() {
  return (
    <>
      <div suppressHydrationWarning dangerouslySetInnerHTML={{ __html: LEGACY_BODY_HTML }} />
      <div dangerouslySetInnerHTML={{ __html: renderLegacyScriptTags() }} />
      <ToastIsland />
      <ConfirmIsland />
      <GuidanceProvider>
        <HelpIsland />
        <TourIsland />
      </GuidanceProvider>
    </>
  );
}
