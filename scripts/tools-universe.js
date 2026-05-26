/**
 * Tools · Constellation Universe
 *
 * Each tool is a positioned node (data-x / data-y on the HTML in
 * percentages of the .universe container). Connection lines between
 * commonly-paired tools are drawn as SVG <line> elements that we
 * append to the embedded .universe__connections SVG and reposition
 * on every layout change. Hovering / focusing a node:
 *   - lights the node up with its brand glow
 *   - lights up every line that touches the node
 *   - flags every other-end-of-the-line node as "connected"
 *     (smaller brighten effect)
 *   - dims every unrelated node so the user's attention focuses
 *   - swaps the readout below the cluster to a one-line
 *     description in their language ("what I use it for")
 *
 * Magnetic drift: per-node CSS variables (--drift-x / --drift-y)
 * are updated each frame inside a proximity radius around the
 * cursor, so the cluster gently breathes towards / away from the
 * pointer. The drift loop pauses when:
 *   - the universe section is off-screen (IntersectionObserver)
 *   - the tab is hidden (document.hidden)
 *   - reduced-motion is set or the device has no hover capability
 *
 * Mobile (<= 900px): CSS stacks the nodes into a static list and
 * we early-return here. No SVG lines, no drift, no dimming — same
 * content, just calm.
 */

const CONNECTIONS = [
  // Adobe internal workflows
  ["ai", "ps"],
  ["ps", "ae"],
  ["ae", "pr"],
  ["ai", "id"],
  ["ps", "id"],
  ["pr", "id"],
  ["figma", "ai"],

  // Cross-overs: AI → design hand-off
  ["nano", "ps"],
  ["flux", "ps"],
  ["magnific", "ps"],
  ["runway", "pr"],
  ["heygen", "pr"],
  ["seedance", "ae"],
  ["suno", "pr"],
  ["elevenlabs", "pr"],
  ["figma", "cursor"],
];

// Description copy per tool, both languages. Phrased in the
// designer's voice — "what I do with this tool" — so the readout
// reads as a tour of the practice rather than a Wikipedia entry.
const COPY = {
  // Display name + IT description + EN description
  ai:         { name: "Illustrator",     it: "Sistemi visivi · illustrazioni · loghi",                en: "Visual systems · illustration · logos" },
  ps:         { name: "Photoshop",       it: "Cover editoriali · retouching · manipolazione",         en: "Editorial covers · retouching · compositing" },
  pr:         { name: "Premiere Pro",    it: "Editing video · reels · post-produzione",               en: "Video editing · reels · post-production" },
  ae:         { name: "After Effects",   it: "Motion design · animazioni 2D · titoli",                en: "Motion design · 2D animation · titles" },
  id:         { name: "InDesign",        it: "Editoria · layout · magazine",                          en: "Editorial · layout · magazines" },
  figma:      { name: "Figma",           it: "UI · prototipazione · design system",                   en: "UI · prototyping · design systems" },

  cursor:     { name: "Cursor",          it: "Pair-programming AI · prototipi e siti come questo",    en: "AI pair-programming · prototypes and sites like this one" },
  runway:     { name: "Runway",          it: "Video generativi · scene impossibili in pochi minuti",  en: "Generative video · impossible scenes in minutes" },
  heygen:     { name: "HeyGen",          it: "Avatar AI parlanti · talk testimonianze veloci",        en: "Talking AI avatars · fast testimonial videos" },
  elevenlabs: { name: "ElevenLabs",      it: "Voiceover AI · narrazione multilingua per spot",        en: "AI voiceover · multi-lingual narration for spots" },
  nano:       { name: "Nano Banana Pro 2", it: "Editing immagini AI · variazioni rapide su brief",    en: "AI image editing · fast variations from brief" },
  suno:       { name: "Suno",            it: "Soundtrack AI · musica originale per reels e ADV",      en: "AI soundtracks · original music for reels and ads" },
  magnific:   { name: "Magnific",        it: "Upscaling AI · render e foto a risoluzione cinema",     en: "AI upscaling · renders and photos to cinema resolution" },
  flux:       { name: "Flux",            it: "Image generation art-directed · concept e mood board",  en: "Art-directed image generation · concept and moodboards" },
  seedance:   { name: "Seedance 2",      it: "Animazioni AI · loop e transizioni sintetizzate",       en: "AI animation · loops and synthesised transitions" },
};

export function initToolsUniverse() {
  const universe = document.querySelector("[data-tools-universe]");
  if (!universe) return;

  // Skip the constellation entirely on touch / no-hover devices.
  // CSS already provides a stacked-list fallback; we just don't
  // wire up the SVG / drift / dim machinery they wouldn't see.
  const isMobile = window.matchMedia("(max-width: 900px)").matches;
  if (isMobile) return;

  const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  const svg = universe.querySelector(".universe__connections");
  const readout = universe.querySelector(".universe__readout");
  const nodes = Array.from(universe.querySelectorAll(".universe__node"));
  if (!svg || !readout || nodes.length === 0) return;

  // Position each node from its data-x / data-y. Done in JS rather
  // than inline style attributes so the HTML stays declarative and
  // the JS can recompute positions on a future "shuffle" feature
  // without DOM rewriting.
  nodes.forEach((node) => {
    node.style.left = `${node.dataset.x}%`;
    node.style.top = `${node.dataset.y}%`;
  });

  // id → node element lookup
  const byId = Object.fromEntries(
    nodes.map((n) => [n.dataset.tool, n])
  );

  // Build the connection lines. Each becomes a styled <line>
  // tagged with data-from / data-to so the focus handler can
  // toggle .is-lit selectively.
  const SVG_NS = "http://www.w3.org/2000/svg";
  const lines = [];
  CONNECTIONS.forEach(([from, to]) => {
    if (!byId[from] || !byId[to]) return;
    const line = document.createElementNS(SVG_NS, "line");
    line.dataset.from = from;
    line.dataset.to = to;
    svg.appendChild(line);
    lines.push(line);
  });

  // Sync the SVG viewBox to the container's pixel size and update
  // every line's coordinates from each node's getBoundingClientRect.
  // Called on init, on resize, on scroll (in case the layout shifts
  // from images loading), and after a few delays to catch async
  // layout settling (fonts, lazy-loaded icons, i18n swap).
  let pendingFrame = 0;
  const positionLines = () => {
    const rect = universe.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) return;
    svg.setAttribute("viewBox", `0 0 ${rect.width} ${rect.height}`);
    svg.setAttribute("width", rect.width);
    svg.setAttribute("height", rect.height);
    lines.forEach((line) => {
      const a = byId[line.dataset.from].getBoundingClientRect();
      const b = byId[line.dataset.to].getBoundingClientRect();
      line.setAttribute("x1", a.left + a.width / 2 - rect.left);
      line.setAttribute("y1", a.top + a.height / 2 - rect.top);
      line.setAttribute("x2", b.left + b.width / 2 - rect.left);
      line.setAttribute("y2", b.top + b.height / 2 - rect.top);
    });
  };
  const schedulePosition = () => {
    if (pendingFrame) return;
    pendingFrame = requestAnimationFrame(() => {
      pendingFrame = 0;
      positionLines();
    });
  };

  positionLines();
  window.addEventListener("resize", schedulePosition);
  window.addEventListener("scroll", schedulePosition, { passive: true });
  // Kick a few delayed retries to catch image-load / font-load layout shifts
  // — by the time fonts finish swapping, the nodes' bounding rects shift
  // a few pixels and lines can end up off-anchor without these.
  [120, 480, 1200].forEach((ms) => setTimeout(positionLines, ms));

  // ---- Hover / focus state machine ----
  // The "active" node is whichever one the user is currently
  // pointing at or has keyboard-focused. There can only be one.
  // Connected nodes are derived from the CONNECTIONS list each
  // time the active changes. Every other node gets the .is-dimmed
  // class so the user's attention narrows.
  const lang = (document.documentElement.lang || "it").toLowerCase().startsWith("en")
    ? "en"
    : "it";

  const setActive = (node) => {
    const id = node.dataset.tool;
    universe.classList.add("is-focused");
    nodes.forEach((n) => n.classList.remove("is-active", "is-connected"));
    node.classList.add("is-active");

    const connectedSet = new Set();
    CONNECTIONS.forEach(([a, b]) => {
      if (a === id) connectedSet.add(b);
      if (b === id) connectedSet.add(a);
    });
    nodes.forEach((n) => {
      if (n === node) return;
      if (connectedSet.has(n.dataset.tool)) {
        n.classList.add("is-connected");
        n.classList.remove("is-dimmed");
      } else {
        n.classList.add("is-dimmed");
        n.classList.remove("is-connected");
      }
    });

    lines.forEach((line) => {
      if (line.dataset.from === id || line.dataset.to === id) {
        line.classList.add("is-lit");
      } else {
        line.classList.remove("is-lit");
      }
    });

    const copy = COPY[id];
    if (copy) {
      readout.innerHTML = `<strong>${copy.name}</strong>${copy[lang]}`;
    }
  };

  const clearActive = () => {
    universe.classList.remove("is-focused");
    nodes.forEach((n) => n.classList.remove("is-active", "is-connected", "is-dimmed"));
    lines.forEach((line) => line.classList.remove("is-lit"));
    // Default readout is wrapped in a span with data-i18n so the
    // i18n module re-localises it on language switch.
    const defaultText = lang === "en"
      ? "Hover any tool to explore my stack"
      : "Passa sui tool per esplorare il mio stack";
    readout.innerHTML = `<span class="universe__readout-default" data-i18n="tools.universe_default">${defaultText}</span>`;
  };

  nodes.forEach((node) => {
    node.addEventListener("mouseenter", () => setActive(node));
    node.addEventListener("focus", () => setActive(node));
    node.addEventListener("mouseleave", clearActive);
    node.addEventListener("blur", clearActive);
  });

  // ---- Magnetic drift loop ----
  // Each node tracks its own --drift-x / --drift-y CSS variables;
  // the .universe__node transform (in main.css) composes them into
  // its translate() call so the drift adds on top of the centring
  // and any hover lift without conflict.
  if (reduce) return;
  if (!window.matchMedia("(hover: hover)").matches) return;

  const PROXIMITY = 220;
  const STRENGTH = 10;

  let mouseX = -10000;
  let mouseY = -10000;
  let inView = false;
  let rafId = 0;
  let centersStale = true;
  let centers = [];

  const recomputeCenters = () => {
    centers = nodes.map((node) => {
      const r = node.getBoundingClientRect();
      return {
        node,
        cx: r.left + r.width / 2,
        cy: r.top + r.height / 2,
      };
    });
    centersStale = false;
  };

  const tick = () => {
    if (!inView || document.hidden) {
      rafId = 0;
      return;
    }
    if (centersStale) recomputeCenters();
    for (const c of centers) {
      const dx = mouseX - c.cx;
      const dy = mouseY - c.cy;
      const dist2 = dx * dx + dy * dy;
      const proxSq = PROXIMITY * PROXIMITY;
      if (dist2 < proxSq) {
        const dist = Math.sqrt(dist2);
        const force = (1 - dist / PROXIMITY) * STRENGTH;
        const nx = (dx / dist) * force || 0;
        const ny = (dy / dist) * force || 0;
        c.node.style.setProperty("--drift-x", nx.toFixed(2) + "px");
        c.node.style.setProperty("--drift-y", ny.toFixed(2) + "px");
      } else {
        c.node.style.setProperty("--drift-x", "0px");
        c.node.style.setProperty("--drift-y", "0px");
      }
    }
    rafId = requestAnimationFrame(tick);
  };

  const startLoop = () => {
    if (!rafId) rafId = requestAnimationFrame(tick);
  };

  window.addEventListener("mousemove", (e) => {
    mouseX = e.clientX;
    mouseY = e.clientY;
  }, { passive: true });

  // Centers drift when the section scrolls or resizes — mark stale
  // and let the next tick recompute from getBoundingClientRect.
  const markStale = () => { centersStale = true; };
  window.addEventListener("resize", markStale);
  window.addEventListener("scroll", markStale, { passive: true });

  // Pause the drift work while the constellation is off-screen:
  // there's no point recomputing 15 transforms per frame for a
  // section the user can't see, especially with the heavy
  // particle / blob loops competing for the same frame budget.
  const io = new IntersectionObserver(([entry]) => {
    inView = entry.isIntersecting;
    if (inView) startLoop();
  }, { rootMargin: "150px" });
  io.observe(universe);

  document.addEventListener("visibilitychange", () => {
    if (!document.hidden && inView) startLoop();
  });
}
