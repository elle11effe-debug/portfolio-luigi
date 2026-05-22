/**
 * Proximity-driven LIQUID text effect — "finger in water" v2.
 *
 * Per-letter physics, fully independent. Each letter independently runs:
 *
 *   1. Proximity 0→1, with a steep power-1.4 falloff inside PROXIMITY_RADIUS.
 *      Asymmetric lerp — snaps fast IN, decays slow OUT → wake/trail.
 *   2. Radial displacement: the letter is pushed AWAY from the cursor along
 *      the cursor→letter vector. Position is animated via a damped under-
 *      critical spring → natural overshoot/oscillation like water tension.
 *   3. Visual: scale, color, CSS blur, text-shadow glow, z-index all driven
 *      by proximity.
 *
 * Variants via the `data-particle-text` attribute value:
 *   • `data-particle-text`            → static (default): letter centres are
 *     cached once in PAGE coords. Cheap.
 *   • `data-particle-text="dynamic"`  → for elements that move every frame
 *     (e.g. CSS-animated marquee). One getBoundingClientRect per group per
 *     frame, then letter positions = parent rect + cached letter offsets.
 *
 * Color auto-skip: if the target element is rendered with a transparent text
 * fill (i.e. `background-clip: text` gradient text), we don't override its
 * color — the gradient is preserved while scale / push / blur / glow still
 * apply.
 */

export function initParticleText() {
  const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (reduce) return;

  const targets = document.querySelectorAll("[data-particle-text]");
  if (!targets.length) return;

  // ── Tunable constants ────────────────────────────────────────────────────
  const PROXIMITY_RADIUS = 120;
  const FALLOFF_POWER = 1.4;

  const MAX_SCALE_ADD = 0.5;
  const MAX_PUSH = 14;
  const MAX_LIFT_BIAS = 6;
  const MAX_BLUR = 2.6;
  const MAX_GLOW = 32;
  const MAX_GLOW_ALPHA = 0.78;

  const PROX_LERP_IN = 0.28;
  const PROX_LERP_OUT = 0.13;

  const SPRING_STIFFNESS = 0.18;
  const SPRING_DAMPING = 0.74;

  const FALLBACK_FROM_RGB = [247, 243, 239]; // --fg
  const TO_RGB = [255, 94, 31];              // --accent

  function parseRgb(str) {
    if (!str) return null;
    const m = str.match(/(-?\d+(?:\.\d+)?)/g);
    if (!m || m.length < 3) return null;
    return [+m[0], +m[1], +m[2]];
  }

  // ── Build per-letter spans ───────────────────────────────────────────────
  const groups = [];

  targets.forEach((el) => {
    const mode = el.getAttribute("data-particle-text");
    const dynamic = mode === "dynamic";

    // Capture the element's natural fill so the rest-state colour is preserved
    // and only the hover ramp lerps toward --accent. If fill is transparent
    // (e.g. background-clip:text gradient) we skip colour writes entirely.
    const cs = window.getComputedStyle(el);
    const fill = cs.webkitTextFillColor || cs.color || "";
    const skipColor =
      fill === "transparent" ||
      fill === "rgba(0, 0, 0, 0)" ||
      fill === "rgba(0,0,0,0)";
    const fromRgb = parseRgb(fill) || FALLBACK_FROM_RGB;

    const text = el.textContent;
    el.innerHTML = "";
    const letters = [];
    for (const c of [...text]) {
      const span = document.createElement("span");
      span.className = "goo-letter";
      span.textContent = c === " " ? "\u00A0" : c;
      el.appendChild(span);
      letters.push({
        span,
        hx: 0, hy: 0,         // current page-coord centre (refreshed per-frame if dynamic)
        offX: 0, offY: 0,     // centre offset relative to parent element
        prox: 0,
        velX: 0, velY: 0,
        curX: 0, curY: 0,
        z: 0,
        hadBlur: false,
        hadGlow: false,
      });
    }
    el.classList.add("has-goo");
    groups.push({ el, letters, dynamic, skipColor, fromRgb });
  });

  // ── Cache letter rects ───────────────────────────────────────────────────
  let rectsReady = false;

  function updateRects() {
    for (const g of groups)
      for (const l of g.letters) l.span.style.transform = "";

    const sx = window.scrollX;
    const sy = window.scrollY;
    for (const g of groups) {
      const elR = g.el.getBoundingClientRect();
      for (const l of g.letters) {
        const r = l.span.getBoundingClientRect();
        // Offsets relative to parent (transform-independent layout position)
        l.offX = r.left - elR.left + r.width / 2;
        l.offY = r.top - elR.top + r.height / 2;
        // Static groups: cache absolute page coords once
        if (!g.dynamic) {
          l.hx = r.left + r.width / 2 + sx;
          l.hy = r.top + r.height / 2 + sy;
        }
      }
    }
    rectsReady = true;
  }

  // ── Mouse state + animation loop ─────────────────────────────────────────
  let mouseX = -1e6;
  let mouseY = -1e6;
  let raf = null;

  function tick() {
    if (!rectsReady) {
      raf = requestAnimationFrame(tick);
      return;
    }

    let stillActive = false;
    let cursorNearDynamic = false;
    const sx = window.scrollX;
    const sy = window.scrollY;
    const cx = mouseX - sx; // cursor in client coords for hit-testing
    const cy = mouseY - sy;

    for (const g of groups) {
      // For dynamic groups (animated parents), refresh the parent rect once.
      // Also use the rect to hit-test the cursor so the loop can stop when
      // it's nowhere near the moving text.
      let baseX = 0, baseY = 0;
      if (g.dynamic) {
        const r = g.el.getBoundingClientRect();
        baseX = r.left + sx;
        baseY = r.top + sy;
        if (
          cx > r.left - PROXIMITY_RADIUS &&
          cx < r.right + PROXIMITY_RADIUS &&
          cy > r.top - PROXIMITY_RADIUS &&
          cy < r.bottom + PROXIMITY_RADIUS
        ) {
          cursorNearDynamic = true;
        }
      }

      for (const l of g.letters) {
        const hx = g.dynamic ? baseX + l.offX : l.hx;
        const hy = g.dynamic ? baseY + l.offY : l.hy;

        const dx = hx - mouseX;
        const dy = hy - mouseY;
        const distSq = dx * dx + dy * dy;

        let targetProx = 0;
        let dirX = 0, dirY = 0;
        if (distSq < PROXIMITY_RADIUS * PROXIMITY_RADIUS) {
          const dist = Math.sqrt(distSq);
          const t = 1 - dist / PROXIMITY_RADIUS;
          targetProx = Math.pow(t, FALLOFF_POWER);
          if (dist > 0.5) {
            dirX = dx / dist;
            dirY = dy / dist;
          }
        }

        const lerp = targetProx > l.prox ? PROX_LERP_IN : PROX_LERP_OUT;
        l.prox += (targetProx - l.prox) * lerp;

        const pushMag = l.prox * MAX_PUSH;
        const targetCX = dirX * pushMag;
        const targetCY = dirY * pushMag - l.prox * MAX_LIFT_BIAS;
        l.velX = l.velX * SPRING_DAMPING + (targetCX - l.curX) * SPRING_STIFFNESS;
        l.velY = l.velY * SPRING_DAMPING + (targetCY - l.curY) * SPRING_STIFFNESS;
        l.curX += l.velX;
        l.curY += l.velY;

        if (
          Math.abs(targetProx - l.prox) > 0.003 ||
          l.prox > 0.003 ||
          Math.abs(l.velX) > 0.03 ||
          Math.abs(l.velY) > 0.03 ||
          Math.abs(l.curX) > 0.1 ||
          Math.abs(l.curY) > 0.1
        ) {
          stillActive = true;
        }

        const p = l.prox;
        const scale = 1 + p * MAX_SCALE_ADD;
        const blurPx = p * MAX_BLUR;
        const glowPx = p * MAX_GLOW;
        const glowA = p * MAX_GLOW_ALPHA;

        l.span.style.transform =
          `translate3d(${l.curX.toFixed(2)}px, ${l.curY.toFixed(2)}px, 0) scale(${scale.toFixed(3)})`;

        const z = (p * 10) | 0;
        if (z !== l.z) {
          l.span.style.zIndex = z === 0 ? "" : String(z);
          l.z = z;
        }

        const needBlur = blurPx > 0.05;
        if (needBlur) {
          l.span.style.filter = `blur(${blurPx.toFixed(2)}px)`;
          l.hadBlur = true;
        } else if (l.hadBlur) {
          l.span.style.filter = "";
          l.hadBlur = false;
        }

        const needGlow = glowA > 0.02;
        if (needGlow) {
          l.span.style.textShadow = `0 0 ${glowPx.toFixed(1)}px rgba(255, 94, 31, ${glowA.toFixed(3)})`;
          l.hadGlow = true;
        } else if (l.hadGlow) {
          l.span.style.textShadow = "";
          l.hadGlow = false;
        }

        // Skip color writes on gradient (transparent-fill) elements so the
        // background-clip:text gradient keeps showing through.
        if (!g.skipColor) {
          const fr = g.fromRgb;
          const rr = fr[0] + (TO_RGB[0] - fr[0]) * p;
          const gg = fr[1] + (TO_RGB[1] - fr[1]) * p;
          const bb = fr[2] + (TO_RGB[2] - fr[2]) * p;
          l.span.style.color = `rgb(${rr | 0}, ${gg | 0}, ${bb | 0})`;
        }
      }
    }

    // Keep ticking while letters are still settling OR while the cursor is
    // hovering a dynamic (moving) group — those need per-frame position sync.
    if (stillActive || cursorNearDynamic) {
      raf = requestAnimationFrame(tick);
    } else {
      raf = null;
    }
  }

  window.addEventListener(
    "mousemove",
    (e) => {
      mouseX = e.clientX + window.scrollX;
      mouseY = e.clientY + window.scrollY;
      if (!raf) raf = requestAnimationFrame(tick);
    },
    { passive: true }
  );

  let resizeTimer = null;
  window.addEventListener("resize", () => {
    if (resizeTimer) clearTimeout(resizeTimer);
    resizeTimer = setTimeout(updateRects, 150);
  });

  if (document.fonts && document.fonts.ready) {
    document.fonts.ready.then(() => setTimeout(updateRects, 150));
  }
  setTimeout(updateRects, 1900);

  window.__particleTextRefresh = updateRects;
}
