import { initCursor } from "./cursor.js";
import { initMagnetic } from "./magnetic.js";
import { initBlob } from "./blob.js";
import { initAmbientGlows } from "./ambient-glows.js";
import { initWorks } from "./works.js";
import { initAnimations } from "./animations.js";
import { initSmoothScroll } from "./smoothscroll.js";
import { initParticles } from "./particles.js";
import { initFlip } from "./flip.js";
import { initScramble } from "./scramble.js";
import { initPageTransition } from "./transition.js";
import { initParticleFields } from "./particle-ring.js";
import { initParticleText } from "./particle-text.js";
import { initLightbox } from "./lightbox.js";
import { initHeroPortrait } from "./hero-portrait.js";
import { initCaseCover } from "./case-cover.js";
import { initTimeline } from "./timeline.js";
import { initSound } from "./sound.js";
import { initI18n } from "./i18n.js";

async function boot() {
  initPageTransition();

  // Kick i18n off in parallel — the visual / interactive layer doesn't
  // depend on translations and shouldn't wait for the JSON round-trip.
  const i18nPromise = initI18n();

  initSmoothScroll();
  initParticles();
  initParticleFields();
  initCursor();
  initBlob();
  initAmbientGlows();
  initMagnetic();
  initWorks();
  initAnimations();
  initLightbox();
  initHeroPortrait();
  initCaseCover();
  initTimeline();
  initSound();

  // Text-reading modules (scramble/flip/particle-text) need the localised
  // copy in place before they capture it, so they wait for i18n.
  await i18nPromise;
  initFlip();
  initParticleText();
  initScramble();
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", boot);
} else {
  boot();
}
