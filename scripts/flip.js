export function initFlip() {
  const targets = document.querySelectorAll("[data-flip]");
  targets.forEach((el) => {
    if (el.classList.contains("flip")) return;
    const text = el.textContent.trim();
    if (!text) return;
    el.innerHTML =
      '<span class="flip__inner">' +
        '<span class="flip__line">' + escapeHtml(text) + '</span>' +
        '<span class="flip__line" aria-hidden="true">' + escapeHtml(text) + '</span>' +
      '</span>';
    el.classList.add("flip");
  });
}

function escapeHtml(s) {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}
