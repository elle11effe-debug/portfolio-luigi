/**
 * Lightbox: click any case-study gallery image (or hero image) to view it full-screen.
 * Keyboard navigation: ESC to close, ←/→ to step through the active gallery group.
 */

const SELECTOR = ".case__gallery figure img, .case__hero--image img";

export function initLightbox() {
  const targets = Array.from(document.querySelectorAll(SELECTOR));
  if (!targets.length) return;

  const overlay = document.createElement("div");
  overlay.className = "lightbox";
  overlay.setAttribute("aria-hidden", "true");
  overlay.setAttribute("role", "dialog");
  overlay.setAttribute("aria-modal", "true");
  overlay.setAttribute("aria-label", "Anteprima a tutto schermo");
  overlay.innerHTML = `
    <button class="lightbox__close" type="button" aria-label="Chiudi">
      <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.6">
        <path d="M6 6l12 12M18 6L6 18" stroke-linecap="round"/>
      </svg>
    </button>
    <button class="lightbox__nav lightbox__nav--prev" type="button" aria-label="Immagine precedente">
      <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.6">
        <path d="M15 18l-6-6 6-6" stroke-linecap="round" stroke-linejoin="round"/>
      </svg>
    </button>
    <button class="lightbox__nav lightbox__nav--next" type="button" aria-label="Immagine successiva">
      <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.6">
        <path d="M9 6l6 6-6 6" stroke-linecap="round" stroke-linejoin="round"/>
      </svg>
    </button>
    <figure class="lightbox__stage">
      <img class="lightbox__img" alt="" />
      <figcaption class="lightbox__caption"></figcaption>
    </figure>
  `;
  document.body.appendChild(overlay);

  const imgEl = overlay.querySelector(".lightbox__img");
  const captionEl = overlay.querySelector(".lightbox__caption");
  const closeBtn = overlay.querySelector(".lightbox__close");
  const prevBtn = overlay.querySelector(".lightbox__nav--prev");
  const nextBtn = overlay.querySelector(".lightbox__nav--next");

  let group = [];
  let index = 0;
  let savedScrollY = 0;
  let lastTrigger = null;

  // Scroll lock che preserva la posizione: body in position:fixed con top negativo
  // pari allo scrollY corrente. Alla chiusura ripristiniamo gli stili e
  // riportiamo subito la pagina alla posizione salvata.
  const lockScroll = () => {
    savedScrollY = window.scrollY || window.pageYOffset || 0;
    const body = document.body;
    body.style.position = "fixed";
    body.style.top = `-${savedScrollY}px`;
    body.style.left = "0";
    body.style.right = "0";
    body.style.width = "100%";
  };

  const unlockScroll = () => {
    const body = document.body;
    body.style.position = "";
    body.style.top = "";
    body.style.left = "";
    body.style.right = "";
    body.style.width = "";
    window.scrollTo(0, savedScrollY);
  };

  const buildGroup = (clicked) => {
    const gallery = clicked.closest(".case__gallery");
    if (gallery) return Array.from(gallery.querySelectorAll("figure img"));
    return [clicked];
  };

  const render = () => {
    const el = group[index];
    if (!el) return;
    imgEl.src = el.currentSrc || el.src;
    imgEl.alt = el.alt || "";
    const fig = el.closest("figure");
    const cap = fig?.querySelector("figcaption")?.textContent?.trim();
    captionEl.textContent = cap || "";
    captionEl.style.display = cap ? "" : "none";
    overlay.classList.toggle("has-nav", group.length > 1);
  };

  const open = (clicked) => {
    lastTrigger = clicked;
    group = buildGroup(clicked);
    index = group.indexOf(clicked);
    if (index < 0) index = 0;
    render();
    lockScroll();
    overlay.classList.add("is-open");
    overlay.setAttribute("aria-hidden", "false");
  };

  const close = () => {
    overlay.classList.remove("is-open");
    overlay.setAttribute("aria-hidden", "true");
    unlockScroll();
    if (lastTrigger && typeof lastTrigger.focus === "function") {
      // preventScroll evita salti durante il refocus su Safari/Chrome
      try { lastTrigger.focus({ preventScroll: true }); } catch { lastTrigger.focus(); }
    }
    setTimeout(() => { imgEl.src = ""; }, 320);
  };

  const step = (dir) => {
    if (!group.length) return;
    index = (index + dir + group.length) % group.length;
    render();
  };

  targets.forEach((el) => {
    const fig = el.closest("figure");
    (fig || el).addEventListener("click", () => open(el));
  });

  overlay.addEventListener("click", (e) => {
    if (e.target === overlay || e.target.classList.contains("lightbox__stage")) close();
  });
  closeBtn.addEventListener("click", close);
  prevBtn.addEventListener("click", (e) => { e.stopPropagation(); step(-1); });
  nextBtn.addEventListener("click", (e) => { e.stopPropagation(); step(1); });

  document.addEventListener("keydown", (e) => {
    if (!overlay.classList.contains("is-open")) return;
    if (e.key === "Escape") close();
    if (e.key === "ArrowLeft") step(-1);
    if (e.key === "ArrowRight") step(1);
  });
}
