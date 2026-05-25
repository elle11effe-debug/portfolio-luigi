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
  // Stretch factor: how many pixels of vertical scroll the user must
  // travel for every pixel the track moves horizontally. 1 = a single
  // trackpad swipe completes the whole journey (too rushed — users had
  // no time to read each card). Higher = the cinematic pinned moment
  // lasts longer. 3.5 means a typical trackpad swipe (~400-500px)
  // advances the timeline by roughly one card width, which feels
  // intentional and gives ~3-4 swipes of room to enjoy the full journey.
  const SCROLL_STRETCH = 3.5;

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
    // Force GSAP to use translate3d so the track is always promoted to
    // its own GPU compositor layer. Without this, fast trackpad swipes
    // can flicker as the browser tears down/rebuilds the layer when
    // sub-pixel transforms cross integer boundaries.
    force3D: true,
    scrollTrigger: {
      trigger: section,
      pin: true,
      pinSpacing: true,
      // scrub: 1 = the track smoothly catches up to the scroll position
      // over ~1 second instead of snapping frame-by-frame. Combined with
      // the SCROLL_STRETCH multiplier below, this turns abrupt trackpad
      // input into a buttery horizontal glide. Previously scrub was 0.4
      // (snappy + jittery on fast input).
      scrub: 1,
      start: "top 25%",
      // Multiply the scroll-trigger length by SCROLL_STRETCH so a small
      // trackpad swipe no longer races through all four cards. The track
      // still only translates by getDistance() pixels — we're decoupling
      // input distance from animation distance.
      end: () => `+=${getDistance() * SCROLL_STRETCH}`,
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
  // Triggers start BEFORE the card has fully entered the viewport so
  // users see content materialise as they scroll rather than after a
  // long, empty pin moment. Combined with a quick reveal duration this
  // keeps the user "with content" at all times.
  nodes.forEach((node) => {
    gsap.from(node, {
      y: 40,
      opacity: 0,
      scale: 0.94,
      duration: 0.55,
      ease: "power3.out",
      scrollTrigger: {
        trigger: node,
        containerAnimation: horizontal,
        // 110% = card's left edge is just past the right side of the
        // viewport. By the time the card slides into view it's already
        // mid-fade so it never appears "blank".
        start: "left 110%",
        end: "left 75%",
        toggleActions: "play none none reverse",
      },
    });
  });
}
