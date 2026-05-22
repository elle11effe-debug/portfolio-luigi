export function initCursor() {
  const cursor = document.querySelector(".cursor");
  if (!cursor) return;

  const dot = cursor.querySelector(".cursor__dot");
  const ring = cursor.querySelector(".cursor__ring");
  const label = cursor.querySelector(".cursor__label");

  const isTouch = window.matchMedia("(hover: none)").matches;
  if (isTouch) {
    cursor.style.display = "none";
    return;
  }

  let mouseX = window.innerWidth / 2;
  let mouseY = window.innerHeight / 2;
  let dotX = mouseX, dotY = mouseY;
  let ringX = mouseX, ringY = mouseY;

  const dotSpeed = 1;
  const ringSpeed = 0.18;

  window.addEventListener("mousemove", (e) => {
    mouseX = e.clientX;
    mouseY = e.clientY;
  });

  function render() {
    dotX += (mouseX - dotX) * dotSpeed;
    dotY += (mouseY - dotY) * dotSpeed;
    ringX += (mouseX - ringX) * ringSpeed;
    ringY += (mouseY - ringY) * ringSpeed;

    dot.style.transform = `translate3d(${dotX}px, ${dotY}px, 0) translate(-50%, -50%)`;
    ring.style.transform = `translate3d(${ringX}px, ${ringY}px, 0) translate(-50%, -50%)`;
    if (label) {
      label.style.transform = `translate3d(${ringX}px, ${ringY}px, 0) translate(-50%, -50%)`;
    }
    requestAnimationFrame(render);
  }
  render();

  const labelMap = {
    view: "Vedi",
    email: "Scrivi",
    scroll: "Scorri",
    up: "Su",
    logo: "Home",
  };

  document.querySelectorAll("[data-cursor]").forEach((el) => {
    const variant = el.getAttribute("data-cursor");
    el.addEventListener("mouseenter", () => {
      cursor.classList.add("is-hover");
      if (variant && labelMap[variant]) {
        cursor.classList.add("is-view");
        label.textContent = labelMap[variant];
      }
    });
    el.addEventListener("mouseleave", () => {
      cursor.classList.remove("is-hover", "is-view");
      label.textContent = "";
    });
  });

  document.addEventListener("mouseleave", () => (cursor.style.opacity = 0));
  document.addEventListener("mouseenter", () => (cursor.style.opacity = 1));
}
