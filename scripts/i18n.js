/**
 * Lightweight i18n layer for the static portfolio.
 *
 *  - Loads /i18n/{lang}.json once per language and walks the DOM looking
 *    for [data-i18n], [data-i18n-html] and [data-i18n-attr] markers.
 *  - Detects initial language: localStorage > browser language > "it".
 *  - Renders a floating IT/EN toggle in the bottom-right corner.
 *  - On user toggle: runs an in-place "scramble morph" that glitches every
 *    translatable string, silently swaps the underlying text halfway
 *    through the animation, then resolves the chaos into the new language.
 *    No page reload — the URL, scroll position and animation state all
 *    stay exactly where they are; only the words transform.
 *
 * Path resolution: the JSON files live at /<root>/i18n/, regardless of
 * whether the script is loaded from /index.html or /projects/<page>.html,
 * so we resolve their URL relative to this script via import.meta.url.
 */

const STORAGE_KEY = "lf-lang";
const SUPPORTED = ["it", "en"];
// First-visit language. We intentionally default to English (regardless of
// browser locale) so the global audience lands on EN; visitors who prefer
// Italian can switch via the toggle and their choice is then persisted.
const DEFAULT_LANG = "en";

// Total morph duration. First half = glitch ramps up to peak chaos on the
// CURRENT text. Second half = chaos resolves into the NEW text. The
// underlying textContent swap happens silently at the midpoint, masked by
// the random glyphs.
const MORPH_MS = 950;

const SCRAMBLE_CHARS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789#&%@$*<>+=";

const I18N_BASE = new URL("../i18n/", import.meta.url).href;

const dictionaries = Object.create(null);
let currentLang = DEFAULT_LANG;
let morphing = false;
const listeners = new Set();

function detectInitialLang() {
  // Honour an explicit user choice from a previous visit; otherwise fall
  // back to DEFAULT_LANG (English) — we deliberately ignore navigator.language
  // so the first impression is always EN, even for Italian browsers.
  const saved = localStorage.getItem(STORAGE_KEY);
  if (SUPPORTED.includes(saved)) return saved;
  return DEFAULT_LANG;
}

async function loadDictionary(lang) {
  if (dictionaries[lang]) return dictionaries[lang];
  const res = await fetch(I18N_BASE + lang + ".json", { cache: "no-cache" });
  if (!res.ok) throw new Error(`i18n: cannot load ${lang}.json (${res.status})`);
  const data = await res.json();
  dictionaries[lang] = data;
  return data;
}

function resolve(dict, key) {
  if (!dict) return null;
  const parts = key.split(".");
  let cur = dict;
  for (const p of parts) {
    if (cur == null) return null;
    cur = cur[p];
  }
  return cur == null ? null : cur;
}

function escapeHtml(s) {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

// Reads the visible text of an i18n target, transparently unwrapping the
// enhancement layers (flip / particle-text) so the morph animation sees a
// plain string to scramble against.
function extractText(el) {
  if (el.classList.contains("flip")) {
    const line = el.querySelector(".flip__line");
    if (line) return line.textContent;
  }
  if (el.classList.contains("has-goo")) {
    let text = "";
    el.querySelectorAll(".goo-letter").forEach((s) => {
      const c = s.textContent;
      text += c === "\u00A0" ? " " : c;
    });
    return text;
  }
  return el.textContent;
}

// Writes a new string into an i18n target, rebuilding the enhancement
// structure when needed so flip/particle-text keep working after the swap.
function writeText(el, value) {
  if (el.classList.contains("flip")) {
    const inner = el.querySelector(".flip__inner");
    if (inner) {
      const esc = escapeHtml(value);
      inner.innerHTML =
        `<span class="flip__line">${esc}</span>` +
        `<span class="flip__line" aria-hidden="true">${esc}</span>`;
      return;
    }
  }
  if (el.classList.contains("has-goo")) {
    // Use particle-text's surgical rebuild so its internal `groups` array
    // gets re-pointed at the new spans — otherwise the liquid hover effect
    // keeps trying to animate the old (now detached) letters and the
    // cursor reactivity is silently lost.
    if (typeof window.__particleTextRebuild === "function") {
      window.__particleTextRebuild(el, value);
    } else {
      el.innerHTML = "";
      for (const c of [...value]) {
        const span = document.createElement("span");
        span.className = "goo-letter";
        span.textContent = c === " " ? "\u00A0" : c;
        el.appendChild(span);
      }
    }
    return;
  }
  el.textContent = value;
  // Keep the Scrambler's cached "original" in sync so hover-triggered
  // re-scrambles use the new-language string from now on.
  if (el.__scrambler) el.__scrambler.original = value;
}

function applyTextNodes(dict) {
  document.querySelectorAll("[data-i18n]").forEach((el) => {
    const key = el.getAttribute("data-i18n");
    const value = resolve(dict, key);
    if (value == null) return;
    writeText(el, value);
  });
  document.querySelectorAll("[data-i18n-html]").forEach((el) => {
    const key = el.getAttribute("data-i18n-html");
    const value = resolve(dict, key);
    if (value == null) return;
    el.innerHTML = value;
  });
  document.querySelectorAll("[data-i18n-attr]").forEach((el) => {
    const pairs = el.getAttribute("data-i18n-attr").split(",");
    pairs.forEach((p) => {
      const [rawAttr, rawKey] = p.split(":").map((s) => (s || "").trim());
      if (!rawAttr || !rawKey) return;
      const value = resolve(dict, rawKey);
      if (value != null) el.setAttribute(rawAttr, value);
    });
  });
}

function applyMeta(dict) {
  const title = resolve(dict, "meta.title");
  const description = resolve(dict, "meta.description");
  if (title) document.title = title;
  if (description) {
    const m = document.querySelector('meta[name="description"]');
    if (m) m.setAttribute("content", description);
  }
}

async function applyLang(lang) {
  if (!SUPPORTED.includes(lang)) lang = DEFAULT_LANG;
  const dict = await loadDictionary(lang);
  currentLang = lang;
  document.documentElement.lang = lang;
  applyTextNodes(dict);
  applyMeta(dict);
  listeners.forEach((cb) => { try { cb(lang); } catch (_) {} });
}

function scrambleString(str, intensity) {
  let out = "";
  const len = SCRAMBLE_CHARS.length;
  for (let i = 0; i < str.length; i++) {
    const c = str[i];
    if (c === " " || c === "\u00A0" || c === "\n" || c === "\t") {
      out += c;
    } else if (Math.random() < intensity) {
      out += SCRAMBLE_CHARS[(Math.random() * len) | 0];
    } else {
      out += c;
    }
  }
  return out;
}

// Per-element renderer: writes the right "frame" of the morph into the DOM
// without nuking the enhancement layer. Plain leaves get a textContent set;
// flip / particle-text get their inner letters/lines rewritten.
function renderFrame(target, text) {
  const { el, kind } = target;
  if (kind === "plain") {
    el.textContent = text;
    return;
  }
  if (kind === "flip") {
    const line = el.querySelector(".flip__line");
    if (line) line.textContent = text;
    const ghost = el.querySelectorAll(".flip__line")[1];
    if (ghost) ghost.textContent = text;
    return;
  }
  if (kind === "goo") {
    const letters = el.querySelectorAll(".goo-letter");
    // Only repaint when length matches the existing span count; otherwise
    // the goo physics rects would be stale anyway and we just wait for the
    // final swap to rebuild them properly.
    if (letters.length === text.length) {
      for (let i = 0; i < letters.length; i++) {
        const c = text[i];
        letters[i].textContent = c === " " ? "\u00A0" : c;
      }
    }
  }
}

/**
 * In-place "reprogramming" morph from the current language to `newLang`.
 *
 * Animation timeline (progress = elapsed / duration):
 *   0.00 → 0.50  chaos ramps up on the CURRENT-language text
 *   0.50         silent text swap (DOM textContent flips to NEW language,
 *                meta/lang attrs update, scramble.original cache refreshes)
 *   0.50 → 1.00  chaos resolves to clean NEW-language text
 *
 * The whole thing runs without a page reload, so scroll position, lazy-
 * loaded images, ScrollTrigger pins and Lenis state all stay intact —
 * the user just sees the words themselves transforming.
 */
function runMorph(newDict, newLang, duration) {
  const nodes = document.querySelectorAll("[data-i18n]");
  const targets = [];
  nodes.forEach((el) => {
    const key = el.getAttribute("data-i18n");
    const newText = resolve(newDict, key);
    if (newText == null) return;
    let kind = "plain";
    if (el.classList.contains("flip")) kind = "flip";
    else if (el.classList.contains("has-goo")) kind = "goo";
    const currentText = extractText(el);
    targets.push({ el, kind, currentText, newText });
  });

  if (!targets.length) {
    // Nothing to animate — just swap and exit.
    applyTextNodes(newDict);
    applyMeta(newDict);
    document.documentElement.lang = newLang;
    currentLang = newLang;
    listeners.forEach((cb) => { try { cb(newLang); } catch (_) {} });
    return;
  }

  morphing = true;
  let swapped = false;
  const start = performance.now();

  function doSwap() {
    swapped = true;
    // Update everything that's not text-morphed by renderFrame:
    //   • meta title / description
    //   • <html lang>
    //   • attribute translations (aria-label, content, …)
    //   • innerHTML translations
    //   • Scrambler cached originals
    //   • particle-text spans (length may change between languages, so we
    //     rebuild them via writeText rather than character-by-character)
    applyMeta(newDict);
    document.documentElement.lang = newLang;
    currentLang = newLang;
    for (const t of targets) {
      if (t.kind === "goo") {
        writeText(t.el, t.newText);
      } else if (t.el.__scrambler) {
        t.el.__scrambler.original = t.newText;
      }
    }
    document.querySelectorAll("[data-i18n-html]").forEach((el) => {
      const v = resolve(newDict, el.getAttribute("data-i18n-html"));
      if (v != null) el.innerHTML = v;
    });
    document.querySelectorAll("[data-i18n-attr]").forEach((el) => {
      el.getAttribute("data-i18n-attr").split(",").forEach((p) => {
        const [rawAttr, rawKey] = p.split(":").map((s) => (s || "").trim());
        if (!rawAttr || !rawKey) return;
        const v = resolve(newDict, rawKey);
        if (v != null) el.setAttribute(rawAttr, v);
      });
    });
    listeners.forEach((cb) => { try { cb(newLang); } catch (_) {} });
  }

  function tick(now) {
    const elapsed = now - start;
    const progress = Math.min(1, elapsed / duration);

    if (!swapped && progress >= 0.5) doSwap();

    if (progress >= 1) {
      // Final clean state — flush each target to its definitive new text.
      for (const t of targets) renderFrame(t, t.newText);
      morphing = false;
      return;
    }

    // Triangle intensity: 0.15 → 1.0 (at midpoint) → 0.0
    const intensity = progress < 0.5
      ? 0.15 + progress * 1.7
      : Math.max(0, 1 - (progress - 0.5) * 2);

    for (const t of targets) {
      const src = progress < 0.5 ? t.currentText : t.newText;
      // Skip goo elements during the second half if the new text has a
      // different length — renderFrame would no-op anyway and the final
      // writeText already happened at swap time.
      if (t.kind === "goo" && progress >= 0.5 && src.length !== t.el.querySelectorAll(".goo-letter").length) {
        continue;
      }
      renderFrame(t, scrambleString(src, intensity));
    }

    requestAnimationFrame(tick);
  }

  requestAnimationFrame(tick);
}

export async function setLang(lang) {
  if (!SUPPORTED.includes(lang)) lang = DEFAULT_LANG;
  if (lang === currentLang || morphing) return;

  try {
    localStorage.setItem(STORAGE_KEY, lang);
  } catch (_) { /* private mode */ }

  let newDict;
  try {
    newDict = await loadDictionary(lang);
  } catch (e) {
    console.error(e);
    return;
  }

  const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (reduce) {
    applyTextNodes(newDict);
    applyMeta(newDict);
    currentLang = lang;
    document.documentElement.lang = lang;
    listeners.forEach((cb) => { try { cb(lang); } catch (_) {} });
    return;
  }

  runMorph(newDict, lang, MORPH_MS);
}

export function getLang() { return currentLang; }
export function onLangChange(cb) {
  listeners.add(cb);
  return () => listeners.delete(cb);
}

function buildToggle() {
  if (document.querySelector(".lang-toggle")) return;
  const NEXT = { it: "en", en: "it" };
  const LABEL = { it: "Italiano", en: "English" };

  const toggle = document.createElement("button");
  toggle.type = "button";
  toggle.className = "lang-toggle";
  toggle.innerHTML = `
    <span class="lang-toggle__bubble">
      <span class="lang-toggle__face">
        <span class="lang-toggle__current"></span>
        <span class="lang-toggle__target"></span>
      </span>
    </span>
  `;
  document.body.appendChild(toggle);

  toggle.addEventListener("click", () => setLang(NEXT[currentLang]));

  const sync = () => {
    const current = currentLang.toUpperCase();
    const target = NEXT[currentLang].toUpperCase();
    toggle.querySelector(".lang-toggle__current").textContent = current;
    toggle.querySelector(".lang-toggle__target").textContent = target;
    toggle.setAttribute(
      "aria-label",
      `Switch to ${LABEL[NEXT[currentLang]]}`
    );
  };
  sync();
  onLangChange(sync);
}

export async function initI18n() {
  const initial = detectInitialLang();
  try {
    await applyLang(initial);
  } catch (e) {
    console.error(e);
  }
  buildToggle();
}
