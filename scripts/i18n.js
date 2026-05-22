/**
 * Lightweight i18n layer for the static portfolio.
 *
 *  - Loads /i18n/{lang}.json once per language and walks the DOM looking
 *    for [data-i18n], [data-i18n-html] and [data-i18n-attr] markers.
 *  - Detects initial language: localStorage > browser language > "it".
 *  - Renders a floating IT/EN toggle in the bottom-right corner.
 *  - On user toggle: persists the choice, shows the page-transition cover,
 *    then reloads the page so cached/animation modules (scramble, flip,
 *    particle-text) pick up the new copy cleanly. Scroll position is
 *    preserved across the reload via sessionStorage.
 *
 * Path resolution: the JSON files live at /<root>/i18n/, regardless of
 * whether the script is loaded from /index.html or /projects/<page>.html,
 * so we resolve their URL relative to this script via import.meta.url.
 */

const STORAGE_KEY = "lf-lang";
const SCROLL_Y_KEY = "lf-lang-scroll-y";
const SCROLL_PATH_KEY = "lf-lang-scroll-path";
const TRANSITION_FLAG = "__lf_nav";
const COVER_MS = 700;
const SUPPORTED = ["it", "en"];
const DEFAULT_LANG = "it";

const I18N_BASE = new URL("../i18n/", import.meta.url).href;

const dictionaries = Object.create(null);
let currentLang = DEFAULT_LANG;
const listeners = new Set();

function detectInitialLang() {
  const saved = localStorage.getItem(STORAGE_KEY);
  if (SUPPORTED.includes(saved)) return saved;
  const browser = (navigator.language || "").toLowerCase();
  if (browser.startsWith("it")) return "it";
  return "en";
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

function applyTextNodes(dict) {
  document.querySelectorAll("[data-i18n]").forEach((el) => {
    const key = el.getAttribute("data-i18n");
    const value = resolve(dict, key);
    if (value == null) return;
    el.textContent = value;
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

function restoreScrollIfNeeded() {
  try {
    const savedY = sessionStorage.getItem(SCROLL_Y_KEY);
    const savedPath = sessionStorage.getItem(SCROLL_PATH_KEY);
    if (savedY == null || savedPath !== window.location.pathname) return;
    sessionStorage.removeItem(SCROLL_Y_KEY);
    sessionStorage.removeItem(SCROLL_PATH_KEY);
    const y = parseInt(savedY, 10) || 0;
    // Two rAFs so layout has stabilised after translation pass.
    requestAnimationFrame(() => requestAnimationFrame(() => {
      window.scrollTo(0, y);
      // If Lenis is initialised by now, sync its internal target too.
      const lenis = window.__lenis;
      if (lenis && typeof lenis.scrollTo === "function") {
        lenis.scrollTo(y, { immediate: true });
      }
    }));
  } catch (_) { /* private mode */ }
}

export function setLang(lang) {
  if (!SUPPORTED.includes(lang)) lang = DEFAULT_LANG;
  if (lang === currentLang) return;
  try {
    localStorage.setItem(STORAGE_KEY, lang);
    sessionStorage.setItem(SCROLL_Y_KEY, String(window.scrollY));
    sessionStorage.setItem(SCROLL_PATH_KEY, window.location.pathname);
    // Mirrors the flag used by transition.js so the reveal animation
    // plays on the next page after reload.
    sessionStorage.setItem(TRANSITION_FLAG, "1");
  } catch (_) { /* private mode */ }
  const overlay = document.querySelector(".page-transition");
  if (overlay) overlay.classList.add("is-covering");
  setTimeout(() => window.location.reload(), COVER_MS);
}

export function getLang() { return currentLang; }
export function onLangChange(cb) {
  listeners.add(cb);
  return () => listeners.delete(cb);
}

function buildToggle() {
  if (document.querySelector(".lang-toggle")) return;
  const toggle = document.createElement("div");
  toggle.className = "lang-toggle";
  toggle.setAttribute("role", "group");
  toggle.setAttribute("aria-label", "Language switcher");
  toggle.innerHTML = `
    <button type="button" class="lang-toggle__btn" data-lang="it" aria-label="Italiano"><span>IT</span></button>
    <button type="button" class="lang-toggle__btn" data-lang="en" aria-label="English"><span>EN</span></button>
  `;
  document.body.appendChild(toggle);

  toggle.querySelectorAll(".lang-toggle__btn").forEach((btn) => {
    btn.addEventListener("click", () => setLang(btn.dataset.lang));
  });

  const sync = () => {
    toggle.querySelectorAll(".lang-toggle__btn").forEach((b) => {
      const active = b.dataset.lang === currentLang;
      b.classList.toggle("is-active", active);
      b.setAttribute("aria-pressed", active ? "true" : "false");
    });
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
  restoreScrollIfNeeded();
}
