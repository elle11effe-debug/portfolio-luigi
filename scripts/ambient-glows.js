/**
 * Ambient glows scattered across the page sections.
 *
 * Each glow:
 *  - Drifts autonomously around its anchor in a slow Lissajous-style path
 *    (independent sin/cos speeds on X and Y), so each one traces a unique
 *    organic loop and the cluster never feels static.
 *  - Pulses opacity and scale on its own slow breath cycle.
 *  - Brightens, scales up and pulls slightly towards the cursor when it
 *    enters the proximity radius — the proximity test uses the glow's
 *    *current* drifted position so the reaction always lines up with what
 *    the user sees on screen.
 *
 * Bounding rects (= anchor positions) are cached and only refreshed on
 * scroll / resize. Per-frame work stays at one distance calc + two style
 * writes per glow.
 *
 * Mobile (<=900px) and reduced-motion users opt out entirely.
 */

const PROXIMITY_RADIUS = 320;
const DRIFT_X = 90; // max horizontal wander from anchor, in px
const DRIFT_Y = 70; // max vertical wander from anchor, in px

export function initAmbientGlows() {
  const glows = Array.from(document.querySelectorAll(".ambient-glow"));
  if (glows.length === 0) return;

  const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const mobile = window.matchMedia("(max-width: 900px)").matches;
  if (reduce || mobile) return;

  // Each glow gets independent phase + speed for breath, drift-X and
  // drift-Y so no two move together. The (i*…) seeds keep things
  // deterministic and well distributed without needing Math.random.
  const state = glows.map((el, i) => ({
    el,
    breathPhase: i * 1.3,
    breathSpeed: 0.00045 + (i % 3) * 0.00015,
    driftPhaseX: i * 0.9,
    driftSpeedX: 0.00018 + (i % 4) * 0.00006,
    driftPhaseY: i * 1.7 + 0.5,
    driftSpeedY: 0.00022 + ((i + 1) % 5) * 0.00005,
    rect: el.getBoundingClientRect(),
  }));

  let mouseX = -10000;
  let mouseY = -10000;
  window.addEventListener("mousemove", (e) => {
    mouseX = e.clientX;
    mouseY = e.clientY;
  }, { passive: true });

  let rectsStale = true;
  const markStale = () => { rectsStale = true; };
  window.addEventListener("resize", markStale);
  window.addEventListener("scroll", markStale, { passive: true });

  function tick(now) {
    if (document.hidden) {
      requestAnimationFrame(tick);
      return;
    }
    if (rectsStale) {
      for (const s of state) s.rect = s.el.getBoundingClientRect();
      rectsStale = false;
    }

    const vh = window.innerHeight;

    for (const s of state) {
      // Skip glows that are well outside the viewport — they wouldn't
      // be visible anyway, so spending math + a style write on them
      // is wasted work. The 200px slack keeps the animation continuous
      // for glows about to enter the viewport.
      if (s.rect.bottom < -200 || s.rect.top > vh + 200) continue;

      const offsetX = Math.sin(now * s.driftSpeedX + s.driftPhaseX) * DRIFT_X;
      const offsetY = Math.cos(now * s.driftSpeedY + s.driftPhaseY) * DRIFT_Y;

      const cx = s.rect.left + s.rect.width / 2 + offsetX;
      const cy = s.rect.top + s.rect.height / 2 + offsetY;
      const dx = mouseX - cx;
      const dy = mouseY - cy;
      const dist = Math.sqrt(dx * dx + dy * dy);
      const raw = Math.max(0, 1 - dist / PROXIMITY_RADIUS);
      const proximity = raw * raw * (3 - 2 * raw);

      const breath = (Math.sin(now * s.breathSpeed + s.breathPhase) + 1) * 0.5;

      const opacity = (0.45 + breath * 0.2) + proximity * 0.45;
      const scale = (0.92 + breath * 0.08) + proximity * 0.22;

      s.el.style.opacity = opacity.toFixed(3);
      s.el.style.transform =
        `translate(calc(-50% + ${offsetX.toFixed(1)}px), calc(-50% + ${offsetY.toFixed(1)}px))` +
        ` scale(${scale.toFixed(3)})`;
    }

    requestAnimationFrame(tick);
  }

  requestAnimationFrame(tick);
}
