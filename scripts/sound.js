/**
 * Sound design layer — Web Audio synthesis only, no external assets.
 *
 * Goal: ultra-minimal sonic feedback that lives below the level of
 * conscious attention. Soft hover ticks, slightly warmer pings on
 * magnetic interactions, a more substantial "tock" on click, plus
 * a low ambient note when a new section enters the viewport.
 *
 * Everything is synthesized via OscillatorNode + GainNode envelopes,
 * so the entire sound design weighs only what this JS file weighs
 * (no audio files to download or decode).
 *
 * Defaults: ON when the user lands on the site, OFF if they explicitly
 * mute it (persisted via localStorage) or if they prefer reduced
 * motion. Browser policy means the AudioContext is silent until the
 * first user gesture; the click that creates that gesture also makes
 * its own click sound, which doubles as a "yes, sound is on" hint.
 *
 * The floating speaker bubble sits to the left of the language
 * toggle so all preference controls cluster in the same corner.
 */

const STORAGE_KEY = "sound-enabled";
const HOVER_THROTTLE_MS = 90;
const SECTION_THROTTLE_MS = 250;
const PARTICLE_THROTTLE_MS = 180;
// Skip section sounds for the first second so we don't blast every
// section that happens to be in the viewport on initial page paint.
const STARTUP_SILENCE_MS = 1200;

let enabled = false;
let ctx = null;
let masterGain = null;
let toggleBtn = null;
let lastHoverAt = 0;
let lastSectionAt = 0;
let lastParticleAt = 0;
let initTime = 0;
const seenSections = new WeakSet();

function loadPref() {
  // Note: previously we auto-disabled sound when prefers-reduced-motion
  // was set. Removed because (a) reduced-motion is about animations,
  // not audio, and (b) it was silently muting users on macOS who had
  // the system "reduce motion" toggle on for accessibility/battery
  // reasons. Sound now follows only the user's explicit toggle pref.
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored === null) return true; // default ON
    return stored === "true";
  } catch (_) {
    return true;
  }
}

function savePref(value) {
  try { localStorage.setItem(STORAGE_KEY, String(value)); } catch (_) {}
}

function ensureCtx() {
  if (!ctx) {
    const Ctor = window.AudioContext || window.webkitAudioContext;
    if (!Ctor) return null;
    ctx = new Ctor();
    masterGain = ctx.createGain();
    masterGain.gain.value = 1.0;
    masterGain.connect(ctx.destination);
  }
  if (ctx.state === "suspended") {
    ctx.resume().catch(() => {});
  }
  return ctx;
}

/**
 * Run `fn` once the AudioContext is guaranteed to be running.
 * ctx.resume() is async — without this helper, the first scheduled
 * oscillator lands in a context still mid-handshake and produces no
 * audible output.
 */
function whenReady(fn) {
  if (!ensureCtx()) return;
  if (ctx.state === "running") { fn(); return; }
  ctx.resume().then(fn).catch(() => {});
}

/**
 * Unlock the AudioContext on the very first user gesture.
 *
 * Browsers refuse to let an AudioContext leave "suspended" until they
 * see an explicit user gesture (pointerdown / touchstart / keydown).
 * The well-known reliable unlock pattern is to play a 1-sample SILENT
 * AudioBufferSourceNode inside the gesture frame — this forces the
 * context's "running" state in a way that calling resume() alone
 * doesn't always achieve (especially on Safari iOS / Safari macOS).
 *
 * The listener stays attached forever (instead of once-only) because:
 * - on iOS Safari the context can drift back to "interrupted" when
 *   the user moves away from the tab; every new pointerdown gives us
 *   a chance to re-unlock cheaply.
 * - on Chrome the silent buffer is essentially free after the first
 *   real unlock, so the cost of leaving the listener attached is
 *   negligible.
 *
 * Uses capture phase so this runs BEFORE any other click handlers
 * (including the toggle's), guaranteeing the context is awake by the
 * time their downstream sound calls fire.
 */
function attachUnlock() {
  const silentUnlock = () => {
    const c = ensureCtx();
    if (!c) return;
    try {
      const buffer = c.createBuffer(1, 1, 22050);
      const source = c.createBufferSource();
      source.buffer = buffer;
      source.connect(c.destination);
      source.start(0);
    } catch (_) { /* some browsers throw if buffer creation fails — ignore */ }
  };
  document.addEventListener("pointerdown", silentUnlock, { capture: true });
  document.addEventListener("touchstart", silentUnlock, { capture: true, passive: true });
  document.addEventListener("keydown", silentUnlock, { capture: true });
}

/**
 * Quick attack/decay envelope. Using an exponential ramp to a very
 * small value (0.0001) instead of 0 because the Web Audio spec
 * doesn't allow exponentialRampToValueAtTime(0).
 */
function envelope(gainNode, peak, attack, decay) {
  const now = ctx.currentTime;
  gainNode.gain.setValueAtTime(0.0001, now);
  gainNode.gain.linearRampToValueAtTime(peak, now + attack);
  gainNode.gain.exponentialRampToValueAtTime(0.0001, now + attack + decay);
}

function osc(type, freq) {
  const o = ctx.createOscillator();
  o.type = type;
  o.frequency.value = freq;
  return o;
}

function playHover() {
  if (!enabled) return;
  const now = performance.now();
  if (now - lastHoverAt < HOVER_THROTTLE_MS) return;
  lastHoverAt = now;

  whenReady(() => {
    const freq = 1150 + Math.random() * 220; // small pitch variance keeps it organic
    const g = ctx.createGain();
    const o = osc("sine", freq);
    o.connect(g).connect(masterGain);
    envelope(g, 0.035, 0.004, 0.07);
    o.start();
    o.stop(ctx.currentTime + 0.12);
  });
}

function playMagnetic() {
  if (!enabled) return;
  const now = performance.now();
  if (now - lastHoverAt < HOVER_THROTTLE_MS) return;
  lastHoverAt = now;

  whenReady(() => {
    // Two-oscillator dyad — sine + perfect fifth — gives a "warmer"
    // chime tone vs the plain hover tick, so magnetic UI elements feel
    // sonically distinct from regular hover targets.
    const g = ctx.createGain();
    const o1 = osc("sine", 540 + Math.random() * 40);
    const o2 = osc("sine", 810);
    o1.connect(g);
    o2.connect(g);
    g.connect(masterGain);
    envelope(g, 0.032, 0.012, 0.16);
    o1.start(); o2.start();
    const end = ctx.currentTime + 0.22;
    o1.stop(end); o2.stop(end);
  });
}

function playClick() {
  if (!enabled) return;

  whenReady(() => {
    // Triangle bass + sine overtone — most "tactile" of the lot, the
    // sound of a click landing on something solid.
    const g = ctx.createGain();
    const o1 = osc("triangle", 320);
    const o2 = osc("sine", 640);
    o1.connect(g);
    o2.connect(g);
    g.connect(masterGain);
    envelope(g, 0.11, 0.003, 0.12);
    o1.start(); o2.start();
    const end = ctx.currentTime + 0.18;
    o1.stop(end); o2.stop(end);
  });
}

function playSectionEnter() {
  if (!enabled) return;
  const now = performance.now();
  if (now - initTime < STARTUP_SILENCE_MS) return;
  if (now - lastSectionAt < SECTION_THROTTLE_MS) return;
  lastSectionAt = now;

  whenReady(() => {
    // Low, slow, soft. The "you've arrived somewhere new" cue.
    const g = ctx.createGain();
    const o = osc("sine", 180);
    o.connect(g).connect(masterGain);
    envelope(g, 0.022, 0.06, 0.28);
    o.start();
    o.stop(ctx.currentTime + 0.4);
  });
}

function playParticleSpark() {
  if (!enabled) return;
  const now = performance.now();
  if (now - lastParticleAt < PARTICLE_THROTTLE_MS) return;
  lastParticleAt = now;

  whenReady(() => {
    // High, brief, twinkly — should feel like a tiny piece of glass
    // flicking. Fired by particle clusters lighting up under the cursor.
    const g = ctx.createGain();
    const o = osc("sine", 2400 + Math.random() * 600);
    o.connect(g).connect(masterGain);
    envelope(g, 0.018, 0.002, 0.05);
    o.start();
    o.stop(ctx.currentTime + 0.08);
  });
}

function playToggle(on) {
  // always audible, even if currently muted — the toggle click sound
  // is the user's confirmation that the action landed. Louder peak
  // (0.13) than the rest because this is the one sound the user
  // explicitly asked to hear by clicking the speaker icon, so it has
  // to read clearly above ambient room noise.
  whenReady(() => {
    const g = ctx.createGain();
    const o = osc("sine", on ? 880 : 440);
    o.connect(g).connect(masterGain);
    envelope(g, 0.13, 0.006, 0.18);
    o.start();
    o.stop(ctx.currentTime + 0.25);
  });
}

function createToggle() {
  if (document.querySelector(".sound-toggle")) return null;
  const button = document.createElement("button");
  button.className = "sound-toggle";
  button.type = "button";
  button.setAttribute("aria-label", "Toggle sound");
  // Mirrors the .lang-toggle structure so they read as a visual
  // pair: bubble → pulsing aura → face with two states that
  // slide-swap on hover (current goes up, target comes in from
  // below). The "ON" / "OFF" SVGs are both always rendered; CSS
  // decides which one is in the current position based on the
  // .is-muted class on the button.
  button.innerHTML = `
    <span class="sound-toggle__bubble">
      <span class="sound-toggle__face" aria-hidden="true">
        <span class="sound-toggle__icon sound-toggle__icon--on">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
            <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" fill="currentColor" stroke="none"/>
            <path d="M15.54 8.46a5 5 0 0 1 0 7.07"/>
            <path d="M19.07 4.93a10 10 0 0 1 0 14.14"/>
          </svg>
        </span>
        <span class="sound-toggle__icon sound-toggle__icon--off">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
            <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" fill="currentColor" stroke="none"/>
            <line x1="16" y1="9" x2="22" y2="15"/>
            <line x1="22" y1="9" x2="16" y2="15"/>
          </svg>
        </span>
      </span>
    </span>
  `;
  document.body.appendChild(button);
  return button;
}

function updateToggleUI() {
  if (!toggleBtn) return;
  toggleBtn.classList.toggle("is-muted", !enabled);
  toggleBtn.setAttribute("aria-pressed", String(enabled));
  toggleBtn.setAttribute("title", enabled ? "Sound on" : "Sound off");
}

function attachGlobalListeners() {
  // Pointer-only: skip these on touch devices to avoid spurious
  // sounds on tap-and-release. Mobile users still get click sounds
  // (those are explicit gestures).
  const hoverCapable = window.matchMedia("(hover: hover)").matches;

  if (hoverCapable) {
    // Use mouseover (bubbles) instead of mouseenter (doesn't bubble)
    // so we can rely on a single listener on document for the whole
    // page. closest() filters to the magnetic/cursor element.
    document.addEventListener("mouseover", (e) => {
      const el = e.target.closest("[data-cursor], [data-magnetic]");
      if (!el) return;
      if (el.classList.contains("sound-toggle")) return;
      // Magnetic implies a "stronger" interaction → richer sound.
      if (el.hasAttribute("data-magnetic")) {
        playMagnetic();
      } else {
        playHover();
      }
    });
  }

  document.addEventListener("click", (e) => {
    const el = e.target.closest("a, button, [role='button']");
    if (!el) return;
    if (el.classList.contains("sound-toggle")) return; // its own handler
    playClick();
  });

  // Section ambience: low note when each new section first scrolls
  // into a comfortable portion of the viewport.
  const sections = document.querySelectorAll("section[id]");
  if (sections.length && "IntersectionObserver" in window) {
    const io = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting && !seenSections.has(entry.target)) {
          seenSections.add(entry.target);
          playSectionEnter();
        }
      });
    }, { threshold: 0.4 });
    sections.forEach((s) => io.observe(s));
  }

  // Particle sparks: expose a global hook so particles.js (or any
  // other module) can opt into emitting a spark sound without
  // pulling sound.js as an import dependency.
  window.__playParticleSpark = playParticleSpark;
}

export function initSound() {
  initTime = performance.now();
  enabled = loadPref();

  toggleBtn = createToggle();
  if (!toggleBtn) return;
  updateToggleUI();

  // Wire up the unlock listener BEFORE any other sound code runs so
  // the very first gesture on the page primes the AudioContext.
  attachUnlock();

  toggleBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    enabled = !enabled;
    savePref(enabled);
    updateToggleUI();

    // The toggle click IS a qualifying user gesture, so we go through
    // the full unlock + play sequence right here, synchronously,
    // before yielding control back to the browser. The silentUnlock
    // listener also fires (capture phase) just before this handler,
    // so by the time we get here the context is already creating its
    // first buffer. We still go through whenReady to be safe in case
    // the context is mid-resume — playToggle will defer to the
    // resume promise if needed but in practice fires immediately on
    // browsers where the buffer-source trick succeeded.
    playToggle(enabled);
  });

  attachGlobalListeners();
}
