const CHARS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789#&%@$*";

class Scrambler {
  constructor(el, options = {}) {
    this.el = el;
    this.original = el.textContent;
    this.queue = [];
    this.frame = 0;
    this.frameRequest = null;
    this.isRunning = false;
    this.speed = options.speed || 1;

    if (options.bindHover !== false) {
      el.addEventListener("mouseenter", () => this.run());
    }
  }

  run() {
    if (this.isRunning) return;
    this.isRunning = true;

    const target = this.original;
    const length = target.length;
    this.el.classList.add("is-scrambling");
    this.queue = [];

    for (let i = 0; i < length; i++) {
      const to = target[i];
      const start = Math.floor(Math.random() * 14);
      const end = start + 8 + Math.floor(Math.random() * 14);
      this.queue.push({ to, start, end, char: "" });
    }

    this.frame = 0;
    this.tick();
  }

  tick() {
    let output = "";
    let complete = 0;

    for (let i = 0; i < this.queue.length; i++) {
      const item = this.queue[i];
      const { to, start, end } = item;

      if (this.frame >= end) {
        complete++;
        output += to;
      } else if (this.frame >= start) {
        if (!item.char || Math.random() < 0.28) {
          if (to === " " || to === "\u00A0") {
            item.char = to;
          } else {
            item.char = CHARS[Math.floor(Math.random() * CHARS.length)];
          }
        }
        output += item.char;
      } else {
        output += to;
      }
    }

    this.el.textContent = output;

    if (complete === this.queue.length) {
      this.el.classList.remove("is-scrambling");
      this.el.textContent = this.original;
      this.isRunning = false;
      return;
    }

    this.frame += this.speed;
    this.frameRequest = requestAnimationFrame(() => this.tick());
  }
}

export function initScramble() {
  const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (reduce) return;

  const items = document.querySelectorAll("[data-scramble]");
  const scramblers = [];
  items.forEach((el) => {
    const sc = new Scrambler(el);
    el.__scrambler = sc;
    scramblers.push(sc);
  });

  // Entrance: stagger-scramble all hero words once on view
  const heroWords = document.querySelectorAll(".hero__title .word[data-scramble]");
  if (heroWords.length) {
    const trigger = document.querySelector(".hero");
    if (trigger) {
      heroWords.forEach((el, i) => {
        setTimeout(() => el.__scrambler?.run(), 280 + i * 70);
      });
    }
  }

  // Idle hint: occasionally scramble a random hero word for life
  if (heroWords.length) {
    const ping = () => {
      const pool = Array.from(heroWords);
      const random = pool[Math.floor(Math.random() * pool.length)];
      random.__scrambler?.run();
      setTimeout(ping, 5000 + Math.random() * 5000);
    };
    setTimeout(ping, 8000);
  }

  // [data-scramble-once] elements scramble every time they enter the
  // viewport — the attribute name is legacy from when it triggered once.
  // The observer fires on threshold crossings (35%), not continuously,
  // and Scrambler.run() is a no-op if a scramble is already in flight, so
  // rapid in/out scrolls can't compound or break the animation.
  // Words inside the same parent are auto-staggered so multi-word headers
  // read like a typewriter cascade rather than triggering in unison.
  const onceItems = document.querySelectorAll("[data-scramble-once]");
  if (onceItems.length && "IntersectionObserver" in window) {
    onceItems.forEach((el) => {
      if (!el.__scrambler) {
        // speed < 1 slows the scramble down, so short words like "Su" or
        // "I miei" stay visibly noisy long enough for the reveal to read.
        el.__scrambler = new Scrambler(el, { bindHover: false, speed: 0.55 });
      }
    });

    // Pre-compute each element's order within its parent so siblings can
    // share a staggered start without the observer doing extra work.
    const stagger = new WeakMap();
    onceItems.forEach((el) => {
      const siblings = Array.from(el.parentElement?.querySelectorAll("[data-scramble-once]") || []);
      stagger.set(el, siblings.indexOf(el));
    });

    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        const delay = (stagger.get(entry.target) || 0) * 160;
        setTimeout(() => entry.target.__scrambler?.run(), delay);
      });
    }, { threshold: 0.35 });

    onceItems.forEach((el) => observer.observe(el));
  }
}
