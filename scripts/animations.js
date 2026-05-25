export function initAnimations() {
  const { gsap, ScrollTrigger } = window;
  if (!gsap || !ScrollTrigger) return;
  gsap.registerPlugin(ScrollTrigger);

  const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (reduce) return;

  document.querySelectorAll("[data-split]").forEach((el) => {
    const words = el.querySelectorAll(".word");
    gsap.set(words, { yPercent: 110 });

    gsap.to(words, {
      yPercent: 0,
      duration: 1.1,
      ease: "power4.out",
      stagger: 0.06,
      scrollTrigger: {
        trigger: el,
        start: "top 85%",
        once: true,
      },
      onComplete: () => {
        el.classList.add("is-revealed");
        if (typeof window.__particleTextRefresh === "function") {
          window.__particleTextRefresh();
        }
      },
    });
  });

  gsap.utils.toArray(".section-head__title, .section-head__index").forEach((el) => {
    gsap.from(el, {
      y: 50,
      opacity: 0,
      duration: 1,
      ease: "power3.out",
      scrollTrigger: {
        trigger: el,
        start: "top 88%",
        once: true,
      },
    });
  });

  gsap.utils.toArray(".work").forEach((el, i) => {
    const link = el.querySelector(".work__link");
    if (!link) return;
    gsap.from(link, {
      y: 60,
      opacity: 0,
      duration: 0.9,
      ease: "power3.out",
      delay: i * 0.05,
      clearProps: "transform",
      scrollTrigger: {
        trigger: el,
        start: "top 90%",
        once: true,
      },
    });
  });

  gsap.utils.toArray(".about__intro").forEach((el) => {
    gsap.from(el, {
      y: 60,
      opacity: 0,
      duration: 1,
      ease: "power3.out",
      scrollTrigger: {
        trigger: el,
        start: "top 85%",
        once: true,
      },
    });
  });

  gsap.from(".contact__mail, .contact__sub, .contact__info-item", {
    y: 40,
    opacity: 0,
    duration: 0.9,
    stagger: 0.08,
    ease: "power3.out",
    scrollTrigger: {
      trigger: ".contact",
      start: "top 70%",
      once: true,
    },
  });

  const nav = document.querySelector(".nav");
  ScrollTrigger.create({
    start: 80,
    end: "max",
    onUpdate: (self) => {
      nav?.classList.toggle("is-scrolled", self.scroll() > 80);
    },
  });

  // ===== Case study cinematic reveals ============================
  // Images and videos inside case studies don't fade in — they "enter".
  // Each one starts clipped to a 0-height slice from the bottom and
  // slightly oversized, then the clip opens upward while the scale
  // settles to 1, giving a film-cut feel. Captions follow ~400ms later.
  // Section titles fade-up like home page heads for consistency.

  function revealCaseFigure(fig, index = 0, baseDelay = 0) {
    const media = fig.querySelector(":scope > img, :scope > video, :scope > picture > img, :scope > div > video, :scope > div > img");
    if (media) {
      gsap.from(media, {
        clipPath: "inset(100% 0 0 0)",
        scale: 1.12,
        duration: 1.05,
        ease: "power3.out",
        delay: baseDelay + index * 0.08,
        scrollTrigger: { trigger: fig, start: "top 88%", once: true },
        onStart: () => fig.classList.add("is-revealing"),
        onComplete: () => fig.classList.remove("is-revealing"),
      });
    }
    const cap = fig.querySelector(":scope > figcaption");
    if (cap) {
      gsap.from(cap, {
        y: 18,
        opacity: 0,
        duration: 0.7,
        ease: "power3.out",
        delay: baseDelay + index * 0.08 + 0.4,
        scrollTrigger: { trigger: fig, start: "top 88%", once: true },
      });
    }
  }

  // Big plain hero images (skip --banner / --feature, they have their
  // own spotlight reveal handled by scripts/case-cover.js).
  gsap.utils.toArray(".case__hero--image img, .case__hero--art img").forEach((el) => {
    gsap.from(el, {
      clipPath: "inset(100% 0 0 0)",
      scale: 1.18,
      duration: 1.35,
      ease: "power3.out",
      scrollTrigger: { trigger: el, start: "top 92%", once: true },
    });
  });

  // Gallery figures — stagger reveals within each gallery so the photos
  // cascade in like camera cuts rather than popping in unison.
  gsap.utils.toArray(".case__gallery").forEach((gallery) => {
    gallery.querySelectorAll(":scope > figure").forEach((fig, i) => {
      revealCaseFigure(fig, i);
    });
  });

  // Bigger video features get a slightly longer per-item delay.
  gsap.utils.toArray(".case__videos > figure").forEach((fig, i) => {
    revealCaseFigure(fig, i, 0); // delay baked into index
  });

  // Section sub-titles inside case studies.
  gsap.utils.toArray(".case__section-title").forEach((el) => {
    gsap.from(el, {
      y: 36,
      opacity: 0,
      duration: 0.9,
      ease: "power3.out",
      scrollTrigger: { trigger: el, start: "top 90%", once: true },
    });
  });
}
