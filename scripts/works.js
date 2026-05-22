export function initWorks() {
  const works = document.querySelectorAll(".work");
  if (!works.length) return;

  const isTouch = window.matchMedia("(hover: none)").matches;
  if (isTouch) return;

  works.forEach((work) => {
    const media = work.querySelector(".work__media");
    const image = work.querySelector(".work__image");
    if (!media || !image) return;

    let mouseX = 0, mouseY = 0;
    let currentX = 0, currentY = 0;
    let frame = null;
    let hovering = false;

    const render = () => {
      currentX += (mouseX - currentX) * 0.14;
      currentY += (mouseY - currentY) * 0.14;
      const w = media.offsetWidth;
      const h = media.offsetHeight;
      media.style.transform = `translate3d(${currentX - w / 2}px, ${currentY - h / 2}px, 0)`;

      const lag = Math.hypot(mouseX - currentX, mouseY - currentY);
      const dirX = (mouseX - currentX) * 0.02;
      const dirY = (mouseY - currentY) * 0.02;
      image.style.transform = `translate3d(${dirX}px, ${dirY}px, 0) scale(${1.1 + Math.min(lag, 100) * 0.0008})`;

      if (hovering || Math.abs(mouseX - currentX) > 0.3 || Math.abs(mouseY - currentY) > 0.3) {
        frame = requestAnimationFrame(render);
      } else {
        frame = null;
      }
    };

    work.addEventListener("mouseenter", (e) => {
      hovering = true;
      mouseX = e.clientX;
      mouseY = e.clientY;
      currentX = mouseX;
      currentY = mouseY;
      if (!frame) frame = requestAnimationFrame(render);
    });

    work.addEventListener("mousemove", (e) => {
      mouseX = e.clientX;
      mouseY = e.clientY;
      if (!frame) frame = requestAnimationFrame(render);
    });

    work.addEventListener("mouseleave", () => {
      hovering = false;
      if (!frame) frame = requestAnimationFrame(render);
    });
  });
}
