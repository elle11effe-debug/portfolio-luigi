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

  gsap.utils.toArray(".about__intro, .about__side").forEach((el) => {
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
}
