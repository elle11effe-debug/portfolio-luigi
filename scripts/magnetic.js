export function initMagnetic() {
  const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const isTouch = window.matchMedia("(hover: none)").matches;
  if (reduce || isTouch) return;

  const items = document.querySelectorAll("[data-magnetic], [data-magnetic-soft]");

  items.forEach((el) => {
    const soft = el.hasAttribute("data-magnetic-soft");
    const strength = soft ? 0.15 : 0.35;
    const radius = soft ? 240 : 120;

    let rect = null;
    let frame = null;
    let currentX = 0, currentY = 0;
    let targetX = 0, targetY = 0;

    const updateRect = () => { rect = el.getBoundingClientRect(); };

    const animate = () => {
      currentX += (targetX - currentX) * 0.18;
      currentY += (targetY - currentY) * 0.18;
      el.style.transform = `translate3d(${currentX}px, ${currentY}px, 0)`;
      if (Math.abs(targetX - currentX) > 0.05 || Math.abs(targetY - currentY) > 0.05) {
        frame = requestAnimationFrame(animate);
      } else {
        frame = null;
      }
    };

    const onMove = (e) => {
      if (!rect) updateRect();
      const cx = rect.left + rect.width / 2;
      const cy = rect.top + rect.height / 2;
      const dx = e.clientX - cx;
      const dy = e.clientY - cy;
      const dist = Math.hypot(dx, dy);
      if (dist > radius * 1.5) return;
      targetX = dx * strength;
      targetY = dy * strength;
      if (!frame) frame = requestAnimationFrame(animate);
    };

    const reset = () => {
      targetX = 0; targetY = 0;
      if (!frame) frame = requestAnimationFrame(animate);
    };

    el.addEventListener("mouseenter", updateRect);
    el.addEventListener("mousemove", onMove);
    el.addEventListener("mouseleave", reset);
    window.addEventListener("resize", () => { rect = null; });
    window.addEventListener("scroll", () => { rect = null; }, { passive: true });
  });
}
