export function initBlob() {
  const blob = document.querySelector(".blob");
  if (!blob) return;
  const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (reduce) { blob.style.display = "none"; return; }

  let mouseX = window.innerWidth / 2;
  let mouseY = window.innerHeight / 2;
  let blobX = mouseX;
  let blobY = mouseY;
  const ease = 0.06;

  window.addEventListener("mousemove", (e) => {
    mouseX = e.clientX;
    mouseY = e.clientY;
  }, { passive: true });

  function render() {
    blobX += (mouseX - blobX) * ease;
    blobY += (mouseY - blobY) * ease;
    blob.style.transform = `translate3d(${blobX}px, ${blobY}px, 0) translate(-50%, -50%)`;
    requestAnimationFrame(render);
  }
  render();
}
