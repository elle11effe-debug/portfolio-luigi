/**
 * About → Creative journey timeline.
 *
 * On desktop the timeline section is pinned while the inner track
 * translates horizontally, turning vertical scroll into a cinematic
 * sideways "journey" through experiences. Each node fades + scales in
 * as it enters the centre of the viewport, and a progress bar at the
 * top mirrors the scroll position so users always know where they are
 * inside the pinned moment.
 *
 * On mobile, hover-less devices, and prefers-reduced-motion the whole
 * pin/scrub apparatus is skipped: the CSS fallback stacks the nodes
 * vertically on a left rail, no scroll-jacking.
 */

export function initTimeline() {
  const { gsap, ScrollTrigger } = window;
  if (!gsap || !ScrollTrigger) return;

  const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const isMobile = window.matchMedia("(max-width: 900px)").matches;

  const section = document.querySelector("[data-timeline]");
  if (!section) return;

  const viewport = section.querySelector("[data-timeline-viewport]");
  const track = section.querySelector("[data-timeline-track]");
  const progressBar = section.querySelector("[data-progress-bar]");
  const nodes = gsap.utils.toArray(section.querySelectorAll("[data-timeline-node]"));
  if (!viewport || !track || !nodes.length) return;

  // ----- Mobile / reduced-motion fallback ----------------------------
  // The CSS already handles the vertical-stack layout; we just want a
  // gentle on-scroll fade-up per card so they don't all appear at once.
  if (reduce || isMobile) {
    if (!reduce) {
      nodes.forEach((node, i) => {
        gsap.from(node, {
          y: 32,
          opacity: 0,
          duration: 0.7,
          ease: "power3.out",
          delay: i * 0.05,
          scrollTrigger: { trigger: node, start: "top 88%", once: true },
        });
      });
    }
    // Fill the progress bar fully as the section scrolls through view —
    // gives the static stack at least a subtle "you are progressing"
    // signal even without the horizontal pin.
    ScrollTrigger.create({
      trigger: section,
      start: "top 60%",
      end: "bottom 40%",
      scrub: 0.5,
      onUpdate: (self) => {
        if (progressBar) {
          progressBar.style.setProperty("--timeline-progress", `${self.progress * 100}%`);
        }
      },
    });
    return;
  }

  // ----- Desktop: pinned horizontal scroll ---------------------------
  // The scroll distance the user must travel is roughly the amount of
  // horizontal overflow inside the viewport. Computed in a function so
  // ScrollTrigger can re-measure on refresh (resize, font load, etc.).
  const getDistance = () => Math.max(0, track.scrollWidth - viewport.clientWidth);

  // Defensive fallback: if for any reason the track fits inside the
  // viewport (ultrawide monitors, broken CSS, unusual zoom levels) the
  // pin would no-op and cards 3 & 4 would stay invisible forever. Fall
  // back to a vertical stagger reveal in that case so users still get
  // all four cards even without the cinematic horizontal scroll.
  if (getDistance() < 50) {
    nodes.forEach((node, i) => {
      gsap.from(node, {
        y: 40,
        opacity: 0,
        scale: 0.95,
        duration: 0.75,
        delay: i * 0.1,
        ease: "power3.out",
        scrollTrigger: { trigger: section, start: "top 75%", once: true },
      });
    });
    ScrollTrigger.create({
      trigger: section,
      start: "top 75%",
      end: "bottom 25%",
      scrub: 0.5,
      onUpdate: (self) => {
        if (progressBar) {
          progressBar.style.setProperty("--timeline-progress", `${self.progress * 100}%`);
        }
      },
    });
    return;
  }

  // The pin sits on the SECTION, not the whole `.about`, so the page
  // header + intro scroll past normally and only the timeline locks.
  const horizontal = gsap.to(track, {
    x: () => -getDistance(),
    ease: "none",
    scrollTrigger: {
      trigger: section,
      pin: true,
      pinSpacing: true,
      scrub: 0.6,
      start: "top top+=80",   // leave room for the sticky nav
      end: () => `+=${getDistance()}`,
      invalidateOnRefresh: true,
      anticipatePin: 1,
      onUpdate: (self) => {
        if (progressBar) {
          progressBar.style.setProperty("--timeline-progress", `${self.progress * 100}%`);
        }
      },
    },
  });

  // Per-node entrance — uses the horizontal animation as the trigger
  // container so GSAP knows how to compute the "viewport entry" of an
  // element that's being moved by another tween (containerAnimation).
  nodes.forEach((node) => {
    gsap.from(node, {
      y: 50,
      opacity: 0,
      scale: 0.92,
      duration: 0.8,
      ease: "power3.out",
      scrollTrigger: {
        trigger: node,
        containerAnimation: horizontal,
        start: "left 85%",
        end: "left 50%",
        toggleActions: "play none none reverse",
      },
    });
  });
}
