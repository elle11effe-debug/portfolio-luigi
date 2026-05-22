const NAV_FLAG = "__lf_nav";
const COVER_MS = 700;
const REVEAL_MS = 900;

export function initPageTransition() {
  const overlay = document.querySelector(".page-transition");
  if (!overlay) return;

  const reveal = () => {
    overlay.classList.remove("is-covering");
    overlay.classList.add("is-covered");

    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        overlay.classList.remove("is-covered");
        overlay.classList.add("is-revealing");
      });
    });

    setTimeout(() => {
      overlay.classList.remove("is-revealing");
    }, REVEAL_MS + 60);
  };

  if (sessionStorage.getItem(NAV_FLAG)) {
    sessionStorage.removeItem(NAV_FLAG);
    reveal();
  }

  document.addEventListener("click", (e) => {
    if (e.defaultPrevented) return;
    if (e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;

    const link = e.target.closest("a");
    if (!link) return;

    const href = link.getAttribute("href");
    if (!href) return;
    if (href.startsWith("#") || href.startsWith("mailto:") || href.startsWith("tel:")) return;
    if (link.hasAttribute("target") || link.hasAttribute("download")) return;
    if (link.dataset.noTransition !== undefined) return;

    let url;
    try {
      url = new URL(link.href, window.location.href);
    } catch (err) {
      return;
    }
    if (url.origin !== window.location.origin) return;
    if (url.pathname === window.location.pathname) return;

    e.preventDefault();
    sessionStorage.setItem(NAV_FLAG, "1");
    overlay.classList.add("is-covering");

    setTimeout(() => {
      window.location.href = link.href;
    }, COVER_MS);
  });

  window.addEventListener("pageshow", (e) => {
    if (e.persisted) {
      overlay.classList.remove("is-covering", "is-revealing", "is-covered");
    }
  });
}
