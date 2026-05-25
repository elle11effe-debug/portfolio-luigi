export function initParticles() {
  const canvas = document.querySelector(".particles");
  if (!canvas) return;
  const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (reduce) { canvas.style.display = "none"; return; }

  const ctx = canvas.getContext("2d", { alpha: true });
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  let w = 0, h = 0;
  let particles = [];
  let mouseX = -1000, mouseY = -1000;

  const COUNT_BASE = 80;

  const resize = () => {
    w = window.innerWidth;
    h = window.innerHeight;
    canvas.width = w * dpr;
    canvas.height = h * dpr;
    canvas.style.width = w + "px";
    canvas.style.height = h + "px";
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    initParticleArray();
  };

  const rand = (min, max) => Math.random() * (max - min) + min;

  const initParticleArray = () => {
    const density = Math.min(1.4, Math.max(0.6, w / 1400));
    const count = Math.round(COUNT_BASE * density);
    particles = [];
    for (let i = 0; i < count; i++) {
      particles.push(makeParticle());
    }
  };

  const makeParticle = () => ({
    x: rand(0, w),
    y: rand(0, h),
    vx: rand(-0.06, 0.06),
    vy: rand(-0.06, 0.06),
    r: rand(0.4, 1.8),
    baseAlpha: rand(0.15, 0.85),
    twinkle: rand(0, Math.PI * 2),
    twinkleSpeed: rand(0.005, 0.02),
    isBright: Math.random() > 0.85,
  });

  const onMove = (e) => { mouseX = e.clientX; mouseY = e.clientY; };
  const onLeave = () => { mouseX = -1000; mouseY = -1000; };

  let last = performance.now();
  const tick = (now) => {
    const dt = Math.min(50, now - last);
    last = now;
    ctx.clearRect(0, 0, w, h);

    for (let i = 0; i < particles.length; i++) {
      const p = particles[i];

      p.x += p.vx * dt * 0.06;
      p.y += p.vy * dt * 0.06;

      const dx = p.x - mouseX;
      const dy = p.y - mouseY;
      const dist2 = dx * dx + dy * dy;
      const radius = 130;
      if (dist2 < radius * radius) {
        const dist = Math.sqrt(dist2);
        const force = (1 - dist / radius) * 0.6;
        p.x += (dx / dist) * force * 1.4;
        p.y += (dy / dist) * force * 1.4;
      }

      if (p.x < -10) p.x = w + 10;
      if (p.x > w + 10) p.x = -10;
      if (p.y < -10) p.y = h + 10;
      if (p.y > h + 10) p.y = -10;

      p.twinkle += p.twinkleSpeed * dt;
      const flicker = (Math.sin(p.twinkle) + 1) * 0.5;
      const alpha = p.baseAlpha * (0.4 + flicker * 0.6);

      if (p.isBright) {
        ctx.shadowColor = "rgba(255, 138, 61, 0.9)";
        ctx.shadowBlur = 8;
        ctx.fillStyle = `rgba(255, 180, 130, ${alpha})`;
      } else {
        ctx.shadowBlur = 0;
        ctx.fillStyle = `rgba(255, 94, 31, ${alpha * 0.7})`;
      }

      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.shadowBlur = 0;

    requestAnimationFrame(tick);
  };

  resize();
  window.addEventListener("resize", resize);
  window.addEventListener("mousemove", onMove, { passive: true });
  window.addEventListener("mouseout", onLeave);
  requestAnimationFrame((t) => { last = t; tick(t); });
}
