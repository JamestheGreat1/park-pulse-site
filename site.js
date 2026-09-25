(() => {
  const root = document.documentElement;
  const header = document.querySelector(".site-header");
  const layer = document.querySelector("#seasonalLayer");
  const trigger = document.querySelector("#seasonSecretTrigger");
  const OVERRIDE_KEY = "parkpulse.site.seasonOverride";
  const SEASONS = [
    ["auto", "Automatic"],
    ["none", "None"],
    ["halloween", "Halloween"],
    ["fall", "Fall / Thanksgiving"],
    ["christmas", "Christmas"],
    ["easter", "Easter"],
    ["july4", "Fourth of July"]
  ];

  const updateHeader = () => {
    if (!header) return;
    header.classList.toggle("scrolled", window.scrollY > 24);
  };

  const thanksgivingDay = (year) => {
    const first = new Date(year, 10, 1);
    const offset = (4 - first.getDay() + 7) % 7;
    return new Date(year, 10, 1 + offset + 21);
  };

  const easterSunday = (year) => {
    const a = year % 19;
    const b = Math.floor(year / 100);
    const c = year % 100;
    const d = Math.floor(b / 4);
    const e = b % 4;
    const f = Math.floor((b + 8) / 25);
    const g = Math.floor((b - f + 1) / 3);
    const h = (19 * a + b - d - g + 15) % 30;
    const i = Math.floor(c / 4);
    const k = c % 4;
    const l = (32 + 2 * e + 2 * i - h - k) % 7;
    const m = Math.floor((a + 11 * h + 22 * l) / 451);
    const month = Math.floor((h + l - 7 * m + 114) / 31);
    const day = ((h + l - 7 * m + 114) % 31) + 1;
    return new Date(year, month - 1, day);
  };

  const automaticSeason = (now = new Date()) => {
    const date = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const year = date.getFullYear();
    const month = date.getMonth() + 1;
    const day = date.getDate();

    if (month === 10) return "halloween";
    if (month === 11) return date <= thanksgivingDay(year) ? "fall" : "christmas";
    if (month === 12) return "christmas";
    if (month === 7 && day >= 1 && day <= 5) return "july4";

    const easter = easterSunday(year);
    const start = new Date(easter);
    const end = new Date(easter);
    start.setDate(start.getDate() - 10);
    end.setDate(end.getDate() + 1);
    if (date >= start && date <= end) return "easter";
    return "none";
  };

  const storedOverride = () => {
    try {
      const value = localStorage.getItem(OVERRIDE_KEY) || "auto";
      return SEASONS.some(([id]) => id === value) ? value : "auto";
    } catch {
      return "auto";
    }
  };

  const queryOverride = () => {
    const value = new URL(location.href).searchParams.get("season");
    return SEASONS.some(([id]) => id === value) ? value : null;
  };

  const currentSeason = () => {
    const selected = queryOverride() || storedOverride();
    return selected === "auto" ? automaticSeason() : selected;
  };

  const seeded = (seed) => {
    const value = Math.sin(seed * 12.9898 + 78.233) * 43758.5453;
    return value - Math.floor(value);
  };


  let fireworkEmitterFrame = 0;
  let fireworkEmitterLastFrame = 0;
  let fireworkEmitterCounter = 0;
  const fireworkEmitterLastByHead = new WeakMap();

  const removeFireworkTrailSparks = () => {
    layer?.querySelectorAll(".site-firework-tail-spark").forEach((spark) => spark.remove());
  };

  const stopFireworkEmitter = () => {
    if (fireworkEmitterFrame) cancelAnimationFrame(fireworkEmitterFrame);
    fireworkEmitterFrame = 0;
    fireworkEmitterLastFrame = 0;
    removeFireworkTrailSparks();
  };

  const emitFireworkTrailSpark = (fieldRect, head, rocketIndex) => {
    if (!layer || !head.isConnected || !head.getClientRects().length) return;
    const firework = head.closest(".site-firework");
    if (!firework || getComputedStyle(firework).display === "none") return;

    const opacity = Number.parseFloat(getComputedStyle(head).opacity || "0");
    if (opacity < .16) return;

    const rect = head.getBoundingClientRect();
    const x = rect.left - fieldRect.left + rect.width / 2;
    const y = rect.top - fieldRect.top + rect.height / 2;
    if (x < -20 || x > fieldRect.width + 20 || y < -20 || y > fieldRect.height + 20) return;

    const seed = ++fireworkEmitterCounter + rocketIndex * 101;
    const jitterX = (seeded(seed * 1.7) - .5) * 8;
    const jitterY = (seeded(seed * 2.3) - .5) * 5;
    const driftX = (seeded(seed * 3.1) - .5) * 16;
    const fallY = 9 + seeded(seed * 4.3) * 18;
    const size = 2 + seeded(seed * 5.9) * 2.7;
    const life = .62 + seeded(seed * 6.7) * .34;
    const twinkle = .28 + seeded(seed * 7.9) * .34;
    const star = seeded(seed * 8.7) > .78;

    const spark = document.createElement("span");
    spark.className = "site-firework-tail-spark" + (star ? " star" : "");
    spark.style.left = (x + jitterX - size / 2).toFixed(1) + "px";
    spark.style.top = (y + jitterY - size / 2).toFixed(1) + "px";
    spark.style.color = getComputedStyle(firework).color;
    spark.style.setProperty("--tail-size", size.toFixed(1) + "px");
    spark.style.setProperty("--tail-life", life.toFixed(2) + "s");
    spark.style.setProperty("--tail-twinkle", twinkle.toFixed(2) + "s");
    spark.style.setProperty("--tail-dx1", (driftX * .28).toFixed(1) + "px");
    spark.style.setProperty("--tail-dy1", (fallY * .18).toFixed(1) + "px");
    spark.style.setProperty("--tail-dx2", (driftX * .62).toFixed(1) + "px");
    spark.style.setProperty("--tail-dy2", (fallY * .52).toFixed(1) + "px");
    spark.style.setProperty("--tail-dx3", driftX.toFixed(1) + "px");
    spark.style.setProperty("--tail-dy3", fallY.toFixed(1) + "px");
    spark.innerHTML = "<i></i>";
    layer.appendChild(spark);

    const cleanup = (event) => {
      if (event.animationName !== "site-firework-tail-fall") return;
      spark.removeEventListener("animationend", cleanup);
      spark.remove();
    };
    spark.addEventListener("animationend", cleanup);
    window.setTimeout(() => spark.remove(), Math.ceil(life * 1000) + 250);
  };

  const fireworkEmitterTick = (now) => {
    fireworkEmitterFrame = 0;
    if (root.dataset.season !== "july4" ||
        window.matchMedia("(prefers-reduced-motion: reduce)").matches ||
        !layer) {
      stopFireworkEmitter();
      return;
    }

    if (now - fireworkEmitterLastFrame >= 36) {
      fireworkEmitterLastFrame = now;
      const fieldRect = layer.getBoundingClientRect();
      layer.querySelectorAll(".site-firework-head").forEach((head, index) => {
        const last = fireworkEmitterLastByHead.get(head) || 0;
        const interval = 48 + (index % 3) * 7;
        if (now - last >= interval) {
          fireworkEmitterLastByHead.set(head, now);
          emitFireworkTrailSpark(fieldRect, head, index);
        }
      });
    }

    fireworkEmitterFrame = requestAnimationFrame(fireworkEmitterTick);
  };

  const syncFireworkEmitter = () => {
    const enabled =
      root.dataset.season === "july4" &&
      !window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    if (!enabled) {
      stopFireworkEmitter();
      return;
    }
    if (!fireworkEmitterFrame) {
      fireworkEmitterFrame = requestAnimationFrame(fireworkEmitterTick);
    }
  };

  const buildParticles = () => {
    if (!layer || layer.dataset.ready === "true") return;
    layer.dataset.ready = "true";

    for (let i = 0; i < 44; i += 1) {
      const p = document.createElement("span");
      p.className = "seasonal-particle";
      p.style.setProperty("--left", (seeded(i + 1) * 100).toFixed(2) + "%");
      p.style.setProperty("--top", (-8 - seeded((i + 1) * 2.1) * 20).toFixed(2) + "vh");
      p.style.setProperty("--delay", (-seeded((i + 1) * 3.7) * 12).toFixed(2) + "s");
      p.style.setProperty("--duration", (8 + seeded((i + 1) * 5.3) * 8).toFixed(2) + "s");
      p.style.setProperty("--size", (2.5 + seeded((i + 1) * 6.1) * 5).toFixed(1) + "px");
      p.style.setProperty("--leaf-w", (7 + seeded((i + 1) * 7.1) * 6).toFixed(1) + "px");
      p.style.setProperty("--leaf-h", (5 + seeded((i + 1) * 8.2) * 5).toFixed(1) + "px");
      p.style.setProperty("--leaf", ["#d8873a","#c85c35","#e5ab45","#a94e2e"][i % 4]);
      p.style.setProperty("--petal", ["#ffb6d9","#c8b5ff","#9fe1c4"][i % 3]);
      p.style.setProperty("--spark", ["#ffffff","#73b8ff","#ff7785","#ffd56b"][i % 4]);
      layer.appendChild(p);
    }

    const colors = ["#ff7785","#73b8ff","#ffffff","#ffd56b","#ff8a70","#9cc9ff","#ffffff"];
    const fireworkCount = 7;
    const zoneWidth = 100 / fireworkCount;
    for (let f = 0; f < fireworkCount; f += 1) {
      const firework = document.createElement("span");
      firework.className = "site-firework";

      // Randomize each load, but keep one firework in each horizontal zone so
      // the display fills the viewport instead of accidentally bunching up.
      const zoneInset = zoneWidth * (.18 + Math.random() * .64);
      const left = zoneWidth * f + zoneInset;
      const top = 7 + Math.random() * 49;
      const duration = 6.5 + Math.random() * 2.8;
      const delay = -(Math.random() * duration);
      const color = colors[Math.floor(Math.random() * colors.length)];

      firework.style.setProperty("--fw-left", left.toFixed(1) + "%");
      firework.style.setProperty("--fw-top", top.toFixed(1) + "%");
      firework.style.setProperty("--fw-color", color);
      firework.style.setProperty("--fw-duration", duration.toFixed(2) + "s");
      firework.style.setProperty("--fw-delay", delay.toFixed(2) + "s");
      firework.style.setProperty("--rocket-x0", ((Math.random() - .5) * 50).toFixed(1) + "px");

      const head = document.createElement("b");
      head.className = "site-firework-head";
      firework.appendChild(head);

      const sparkCount = 15 + Math.floor(Math.random() * 5);
      const burstRotation = Math.random() * Math.PI * 2;
      for (let i = 0; i < sparkCount; i += 1) {
        const spark = document.createElement("i");
        spark.className = "site-firework-spark";
        const angle = burstRotation + Math.PI * 2 * i / sparkCount + (Math.random() - .5) * .20;
        const distance = 36 + Math.random() * 42;
        spark.style.setProperty("--dx", (Math.cos(angle) * distance).toFixed(1) + "px");
        spark.style.setProperty("--dy", (Math.sin(angle) * distance + 9 + Math.random() * 7).toFixed(1) + "px");
        firework.appendChild(spark);
      }
      layer.appendChild(firework);
    }
  };

  let switcher = null;
  const updateSwitcher = () => {
    if (!switcher) return;
    const selected = queryOverride() || storedOverride();
    switcher.querySelectorAll("[data-season-choice]").forEach((button) => {
      button.classList.toggle("active", button.dataset.seasonChoice === selected);
    });
  };

  const ensureSwitcher = () => {
    if (switcher) return switcher;
    switcher = document.createElement("aside");
    switcher.className = "season-switcher liquid-glass";
    switcher.hidden = true;
    switcher.setAttribute("aria-label", "Seasonal background switcher");
    switcher.innerHTML =
      '<div class="season-switcher-head"><strong>Seasonal background</strong><button type="button" data-season-close aria-label="Close">×</button></div>' +
      '<div class="season-switcher-grid">' +
      SEASONS.map(([id,label]) => '<button type="button" data-season-choice="' + id + '">' + label + '</button>').join("") +
      "</div>";
    document.body.appendChild(switcher);

    switcher.querySelector("[data-season-close]").onclick = () => { switcher.hidden = true; };
    switcher.querySelectorAll("[data-season-choice]").forEach((button) => {
      button.onclick = () => {
        const value = button.dataset.seasonChoice;
        try {
          if (value === "auto") localStorage.removeItem(OVERRIDE_KEY);
          else localStorage.setItem(OVERRIDE_KEY, value);
        } catch {}
        const url = new URL(location.href);
        url.searchParams.delete("season");
        history.replaceState({}, "", url);
        applySeason();
        updateSwitcher();
      };
    });
    updateSwitcher();
    return switcher;
  };

  const applySeason = () => {
    root.dataset.season = currentSeason();
    syncFireworkEmitter();
  };

  let logoTaps = [];
  trigger?.addEventListener("click", (event) => {
    event.preventDefault();
    const now = Date.now();
    logoTaps = logoTaps.filter((time) => now - time < 2200);
    logoTaps.push(now);
    if (logoTaps.length >= 5) {
      logoTaps = [];
      const panel = ensureSwitcher();
      panel.hidden = !panel.hidden;
      updateSwitcher();
    }
  });

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && switcher) switcher.hidden = true;
  });

  buildParticles();
  applySeason();
  updateHeader();
  window.addEventListener("scroll", updateHeader, { passive: true });
  setInterval(applySeason, 15 * 60 * 1000);
})();