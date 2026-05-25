/**
 * Warm orange glow that lives behind the content.
 *
 * Behaviour:
 *  - When the cursor moves, the blob smoothly chases it (as before).
 *  - When the cursor is idle, the blob keeps drifting on its own thanks
 *    to a slow Lissajous-style sin/cos wander, so the hero never feels
 *    visually frozen even if the user isn't moving the mouse.
 *  - On touch devices (no mousemove events) the blob simply runs the
 *    autonomous wander loop full-time.
 */
export function initBlob() {
  const blob = document.querySelector(".blob");
  if (!blob) return;
  const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (reduce) { blob.style.display = "none"; return; }

  let mouseX = window.innerWidth / 2;
  let mouseY = window.innerHeight / 2;
  let blobX = mouseX;
  let blobY = mouseY;
  let lastMouseMove = -Infinity;
  const ease = 0.06;
  // How long after the last mouse-move event the blob is fully attracted
  // to the cursor before falling back to its autonomous wander, in ms.
  const MOUSE_INFLUENCE_MS = 15000;

  window.addEventListener("mousemove", (e) => {
    mouseX = e.clientX;
    mouseY = e.clientY;
    lastMouseMove = performance.now();
  }, { passive: true });

  function render(now) {
    // Skip work when the tab isn't visible. The browser already
    // throttles rAF in background tabs but the math + DOM write is
    // still scheduled, so this short-circuit is essentially free
    // when the user is away.
    if (document.hidden) {
      requestAnimationFrame(render);
      return;
    }
    const w = window.innerWidth;
    const h = window.innerHeight;

    // Slow autonomous drift across the viewport. The two trig functions
    // run at slightly different speeds so the path never repeats exactly,
    // producing an organic "breathing glow" feel.
    const t = now * 0.00012;
    const wanderX = (0.5 + Math.sin(t * 1.3) * 0.38) * w;
    const wanderY = (0.5 + Math.cos(t * 0.9) * 0.32) * h;

    // Cross-fade between mouse attraction (recent move) and autonomous
    // wander (mouse idle). 1 = follow cursor, 0 = pure wander.
    const sinceMove = now - lastMouseMove;
    const mouseWeight = Math.max(0, Math.min(1, 1 - sinceMove / MOUSE_INFLUENCE_MS));

    const targetX = wanderX * (1 - mouseWeight) + mouseX * mouseWeight;
    const targetY = wanderY * (1 - mouseWeight) + mouseY * mouseWeight;

    blobX += (targetX - blobX) * ease;
    blobY += (targetY - blobY) * ease;
    blob.style.transform = `translate3d(${blobX}px, ${blobY}px, 0) translate(-50%, -50%)`;
    requestAnimationFrame(render);
  }
  requestAnimationFrame(render);
}
