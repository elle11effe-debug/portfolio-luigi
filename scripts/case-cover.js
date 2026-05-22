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

// Touch-device auto-orbit: on phones/tablets there's no cursor to drive the
// spotlight, so it would just sit invisible. We instead animate the
// spotlight on a slow Lissajous path so the "discover" effect still plays
// — but only until the scroll-based --reveal has taken over.
const TOUCH_SPOTLIGHT = 0.85;
const ORBIT_RX = 0.34; // horizontal radius as fraction of cover width
const ORBIT_RY = 0.32; // vertical radius as fraction of cover height
const ORBIT_SPEED_X = 0.00055; // rad/ms
const ORBIT_SPEED_Y = 0.00072; // rad/ms (different freq → figure-8-ish path)

export function initCaseCover() {
  const covers = document.querySelectorAll(
    ".case__hero--banner, .case__hero--feature figure"
  );
  if (!covers.length) return;

  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
    covers.forEach((c) => c.style.setProperty("--reveal", "1"));
    return;
  }

  const hasHover = window.matchMedia("(hover: hover)").matches;

  const states = [...covers].map((cover) => {
    const state = {
      cover,
      mx: cover.clientWidth / 2,
      my: cover.clientHeight / 2,
      spotlight: 0,
      target: hasHover ? 0 : TOUCH_SPOTLIGHT,
    };

    if (hasHover) {
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
    }

    return state;
  });

  function tick(now) {
    const vh = window.innerHeight || 800;
    const scrollY = window.scrollY || window.pageYOffset || 0;
    const reveal = Math.min(1, Math.max(0, scrollY / (vh * REVEAL_DISTANCE_RATIO)));

    for (const s of states) {
      if (!hasHover) {
        // Lissajous-style orbit: two different angular speeds produce an
        // organic, never-repeating sweep that explores the whole image.
        const w = s.cover.clientWidth || 1;
        const h = s.cover.clientHeight || 1;
        s.mx = w / 2 + Math.cos(now * ORBIT_SPEED_X) * (w * ORBIT_RX);
        s.my = h / 2 + Math.sin(now * ORBIT_SPEED_Y) * (h * ORBIT_RY);
        // Once the scroll-driven reveal has done its job there's nothing
        // left to "discover" — fade the orbit out so it doesn't keep
        // washing over an already-fully-visible image.
        s.target = TOUCH_SPOTLIGHT * (1 - reveal);
      }

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
