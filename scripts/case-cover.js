/**
 * Reveal effect for case-study cover banners (.case__hero--banner).
 *
 * - The image is fully hidden behind a CSS mask on load.
 * - Hovering creates a soft "flashlight" spotlight that follows the cursor
 *   and uncovers only the area under it.
 * - Scrolling down progressively raises a global reveal so the whole image
 *   becomes visible. The two contributions are added in the mask.
 *
 * The script only writes CSS custom properties; the actual mask geometry
 * lives in styles/main.css.
 */

const HOVER_PEEK = 1; // alpha at the spotlight center while hovering
const HOVER_EASE = 0.16; // higher = snappier spotlight fade
const REVEAL_DISTANCE_RATIO = 0.7; // fraction of viewport height to fully reveal

export function initCaseCover() {
  const covers = document.querySelectorAll(
    ".case__hero--banner, .case__hero--feature figure"
  );
  if (!covers.length) return;

  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
    covers.forEach((c) => c.style.setProperty("--reveal", "1"));
    return;
  }

  const states = [...covers].map((cover) => {
    const state = {
      cover,
      mx: cover.clientWidth / 2,
      my: cover.clientHeight / 2,
      spotlight: 0,
      target: 0,
    };

    cover.addEventListener("mouseenter", () => { state.target = HOVER_PEEK; });
    cover.addEventListener("mouseleave", () => { state.target = 0; });
    cover.addEventListener(
      "mousemove",
      (e) => {
        const rect = cover.getBoundingClientRect();
        state.mx = e.clientX - rect.left;
        state.my = e.clientY - rect.top;
      },
      { passive: true }
    );

    return state;
  });

  function tick() {
    const vh = window.innerHeight || 800;
    const scrollY = window.scrollY || window.pageYOffset || 0;
    const reveal = Math.min(1, Math.max(0, scrollY / (vh * REVEAL_DISTANCE_RATIO)));

    for (const s of states) {
      s.spotlight += (s.target - s.spotlight) * HOVER_EASE;

      s.cover.style.setProperty("--mx", `${s.mx}px`);
      s.cover.style.setProperty("--my", `${s.my}px`);
      s.cover.style.setProperty("--spotlight", s.spotlight.toFixed(3));
      s.cover.style.setProperty("--reveal", reveal.toFixed(3));
    }

    requestAnimationFrame(tick);
  }

  requestAnimationFrame(tick);
}
