import { initCursor } from "./cursor.js";
import { initMagnetic } from "./magnetic.js";
import { initBlob } from "./blob.js";
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
import { initI18n } from "./i18n.js";

async function boot() {
  initPageTransition();
  // Apply translations before text-reading modules (scramble, flip, particle-text)
  // initialise, so they capture the localised copy.
  await initI18n();
  initFlip();
  initParticleText();
  initSmoothScroll();
  initParticles();
  initParticleFields();
  initCursor();
  initBlob();
  initMagnetic();
  initWorks();
  initAnimations();
  initScramble();
  initLightbox();
  initHeroPortrait();
  initCaseCover();
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", boot);
} else {
  boot();
}
