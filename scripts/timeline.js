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
  // Scroll until the LAST card reaches its resting position — not until
  // the full track (incl. trailing padding) has cleared. Otherwise the
  // huge right padding reads as "more content this way" even when the
  // pin is done.
  const getDistance = () => {
    const last = nodes[nodes.length - 1];
    if (!last) return Math.max(0, track.scrollWidth - viewport.clientWidth);
    const lastCenter = last.offsetLeft + last.offsetWidth / 2;
    const target = viewport.clientWidth / 2;
    return Math.max(0, lastCenter - target);
  };
  // Stretch factor: how many pixels of vertical scroll the user must
  // travel for every pixel the track moves horizontally. 1 = a single
  // trackpad swipe completes the whole journey (too rushed). Higher =
  // longer cinematic pinned moment. 7 gives roughly ~800px of vertical
  // scroll per card on a typical laptop, which forces the user to
  // really slow down and read each step — combined with the extra
  // trailing padding (CSS .timeline__track right padding) the last
  // card lingers in its final centred position for several beats of
  // vertical scroll before the pin releases (no empty trail to the right).
  const SCROLL_STRETCH = 7;

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
  // long, empty pin moment.
  //
  // CRITICAL: once: true + clearProps. The reveal fires ONLY the first
  // time each card enters the viewport. Previously it used
  // toggleActions: "play none none reverse" so scrolling back up
  // reversed the entrance, and the next scroll-down replayed it. That
  // meant every up-then-down cycle was re-animating opacity + scale + y
  // on four children WHILE the parent track was translating, and the
  // browser couldn't keep both transform animations coherent on every
  // frame — visible as a stutter on the second pass.
  // Now: first pass plays in, GSAP wipes all inline styles via
  // clearProps so the cards are pure static elements, and subsequent
  // passes are just the track's translateX moving them across — no
  // per-child compositing work.
  nodes.forEach((node) => {
    gsap.from(node, {
      y: 40,
      opacity: 0,
      scale: 0.94,
      duration: 0.55,
      ease: "power3.out",
      clearProps: "transform,scale,opacity,y",
      scrollTrigger: {
        trigger: node,
        containerAnimation: horizontal,
        start: "left 110%",
        end: "left 75%",
        once: true,
        // Brief one-shot "ignition" flash when each card first
        // crosses into the viewport during the horizontal pin: the
        // CSS animation in main.css drives the warm bloom + accent
        // halo decay. The setTimeout removes the class after the
        // 1.4s keyframe finishes so it can never replay (and so
        // hover styles take full control thereafter without the
        // animation lingering underneath).
        onEnter: () => {
          node.classList.add("is-igniting");
          setTimeout(() => node.classList.remove("is-igniting"), 1500);
        },
      },
    });
  });
}
