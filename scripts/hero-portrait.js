/**
 * Scroll-driven opacity for the hero portrait.
 * Polls scroll position in a RAF loop so it stays in sync regardless of
 * whether smooth-scrolling libraries (e.g. Lenis) batch native scroll events.
 */

const MAX_OPACITY = 0.85;
const FADE_DISTANCE = 0.35; // fraction of viewport height over which the fade completes

export function initHeroPortrait() {
  // Target the container so the photo AND its top/bottom gradient overlays
  // fade in together — fading just the <picture> leaves the dark mask
  // gradients visible on top of the hero bg before any scroll happens,
  // producing a stray dark rectangle in the top-right corner.
  const portrait = document.querySelector(".hero__portrait");
  if (!portrait) return;

  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
    portrait.style.opacity = MAX_OPACITY.toFixed(3);
    return;
  }

  let last = -1;

  function tick() {
    const scrollY = window.scrollY || window.pageYOffset || 0;
    const viewport = window.innerHeight || 800;
    const progress = Math.min(1, Math.max(0, scrollY / (viewport * FADE_DISTANCE)));
    const next = +(progress * MAX_OPACITY).toFixed(3);
    if (next !== last) {
      portrait.style.opacity = next;
      last = next;
    }
    requestAnimationFrame(tick);
  }

  requestAnimationFrame(tick);
}
