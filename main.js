(() => {
  const root = document.documentElement;
  const motion = root.classList.contains('motion');
  const fine = matchMedia('(pointer: fine)').matches;
  const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
  const lerp = (a, b, t) => a + (b - a) * t;
  const ease = (t) => t < .5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;

  /* ---------- видео: без движения стоят на постере ---------- */
  const autoVideos = [...document.querySelectorAll('video[autoplay]')];
  if (!motion) autoVideos.forEach(v => { v.removeAttribute('autoplay'); v.pause(); });

  /* ---------- плавный скролл ---------- */
  let lenis = null;
  if (motion && window.Lenis) {
    lenis = new Lenis({ lerp: .1 });
    if (window.gsap && window.ScrollTrigger) {
      gsap.registerPlugin(ScrollTrigger);
      lenis.on('scroll', ScrollTrigger.update);
      gsap.ticker.add(t => lenis.raf(t * 1000));
      gsap.ticker.lagSmoothing(0);
    } else {
      const raf = (t) => { lenis.raf(t); requestAnimationFrame(raf); };
      requestAnimationFrame(raf);
    }
  }
  document.querySelectorAll('a[href^="#"]').forEach(a => a.addEventListener('click', (e) => {
    const id = a.getAttribute('href');
    const el = id.length > 1 ? document.querySelector(id) : document.body;
    if (!el) return;
    e.preventDefault();
    if (lenis) lenis.scrollTo(el, { offset: id === '#bot' ? 0 : -20, duration: 1.4 });
    else el.scrollIntoView({ behavior: 'auto' });
  }));

  /* ---------- 1. монитор ---------- */
  const monitor = document.querySelector('.monitor');
  const mVideo = monitor.querySelector('.monitor__video');
  const tcEl = document.querySelector('[data-timecode]');
  const focus = document.querySelector('[data-focus]');
  const pad = (n) => String(n).padStart(2, '0');

  // таймкод идёт от времени ролика плюс «прокрутка» с начала съёмки
  const shotStart = 12 * 60 + 7;
  const tick = () => {
    const t = shotStart + (mVideo.currentTime || 0);
    const f = Math.floor((t % 1) * 25);
    tcEl.textContent = `00:${pad(Math.floor(t / 60) % 60)}:${pad(Math.floor(t % 60))}:${pad(f)}`;
    requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);

  // рамка фокуса ходит за курсором, клик — перевод фокуса
  const fPos = { x: .5, y: .45, tx: .5, ty: .45 };
  const placeFocus = () => {
    const r = monitor.getBoundingClientRect();
    fPos.x = motion ? lerp(fPos.x, fPos.tx, .14) : fPos.tx;
    fPos.y = motion ? lerp(fPos.y, fPos.ty, .14) : fPos.ty;
    focus.style.transform = `translate(${fPos.x * r.width - 37}px, ${fPos.y * r.height - 37}px)`;
    requestAnimationFrame(placeFocus);
  };
  requestAnimationFrame(placeFocus);
  monitor.addEventListener('pointermove', (e) => {
    const r = monitor.getBoundingClientRect();
    fPos.tx = clamp((e.clientX - r.left) / r.width, .1, .9);
    fPos.ty = clamp((e.clientY - r.top) / r.height, .12, .82);
  });
  let lockTimer;
  monitor.addEventListener('click', () => {
    focus.classList.add('is-locked');
    if (motion) {
      mVideo.style.filter = 'blur(7px)';
      setTimeout(() => { mVideo.style.filter = ''; }, 260);
    }
    clearTimeout(lockTimer);
    lockTimer = setTimeout(() => focus.classList.remove('is-locked'), 1400);
  });

  // загрузка: камера включается, фокус наезжает, заголовок выходит
  if (motion && window.gsap) {
    const tl = gsap.timeline({ delay: .15 });
    tl.to('.monitor__ui', { opacity: 1, duration: .4, ease: 'none' })
      .to(mVideo, { filter: 'blur(0px) brightness(1)', duration: 1.6, ease: 'power3.out' }, '<.1')
      .to('.hero__title .line > span', { y: 0, duration: 1.1, stagger: .12, ease: 'power4.out' }, '<.25')
      .to('.hero__lead', { opacity: 1, duration: .8 }, '<.5')
      .to('.hero .hero__actions', { opacity: 1, duration: .8 }, '<.15')
      .add(() => { root.classList.add('ready'); gsap.set([mVideo, '.monitor__ui', '.hero__title .line > span', '.hero__lead', '.hero .hero__actions'], { clearProps: 'all' }); });
  }

  /* ---------- 2. лента роликов ---------- */
  const strip = document.querySelector('[data-strip]');
  const stripVideos = [...strip.querySelectorAll('video')];
  if (motion && 'IntersectionObserver' in window) {
    const io = new IntersectionObserver((entries) => entries.forEach(en => {
      const v = en.target;
      if (en.isIntersecting) { v.preload = 'auto'; v.play().catch(() => {}); } else v.pause();
    }), { threshold: .5 });
    stripVideos.forEach(v => io.observe(v));
  } else {
    stripVideos.forEach(v => {
      const tile = v.closest('.tile');
      tile.addEventListener('pointerenter', () => v.play().catch(() => {}));
      tile.addEventListener('pointerleave', () => v.pause());
    });
  }
  if (fine) {
    let down = false, sx = 0, sl = 0, moved = false;
    strip.addEventListener('pointerdown', (e) => {
      if (e.pointerType !== 'mouse') return;
      down = true; moved = false; sx = e.clientX; sl = strip.scrollLeft;
    });
    window.addEventListener('pointermove', (e) => {
      if (!down) return;
      const dx = e.clientX - sx;
      if (Math.abs(dx) > 4) { moved = true; strip.classList.add('is-drag'); }
      strip.scrollLeft = sl - dx;
    });
    window.addEventListener('pointerup', () => { down = false; strip.classList.remove('is-drag'); });
    strip.addEventListener('click', (e) => { if (moved) e.preventDefault(); }, true);
  }

  /* ---------- 4. монтажный стол ---------- */
  const desk = document.querySelector('[data-desk]');
  const tlEl = document.querySelector('[data-timeline]');
  const clipsEl = document.querySelector('[data-clips]');
  const titlesEl = document.querySelector('[data-titles]');
  const playhead = document.querySelector('[data-playhead]');
  const preview = document.querySelector('[data-preview]');
  const chat = document.querySelector('[data-chat]');
  const note = document.querySelector('[data-note]');
  const done = document.querySelector('[data-done]');
  const steps = [...document.querySelectorAll('[data-steps] li')];
  const waveEl = document.querySelector('[data-wave]');

  // 12 сырых клипов: 8 остаются, 4 уходят в корзину
  const RAW = [
    { id: 'Dd2lbcHoCnG', keep: 1.3, note: '22:40 город' },
    { id: 'DF-AtiKNkKE', keep: 0 },
    { id: 'DVo1mgiDZJg', keep: .9, note: '12:05 Ташкент' },
    { id: 'DYFLxizt9v_', keep: 1.1, note: '16:30 съёмка' },
    { id: 'DEaC33ntn1N', keep: 0 },
    { id: 'Dd2bFHooVb5', keep: .8, note: '09:10 парк' },
    { id: 'DcO_iDlNrT6', keep: 1.4, note: '23:15 концерт' },
    { id: 'DFX_Xh8N1yd', keep: 0 },
    { id: 'DR4uK7xDWND', keep: .9, note: '19:00 друзья' },
    { id: 'DFIx32CtEYb', keep: 0 },
    { id: 'Dbl5Z6VtJjv', keep: 1, note: '20:15 дача' },
    { id: 'DcljS9dt81Q', keep: 1.2, note: '11:16 работа' },
  ];
  const kept = RAW.filter(c => c.keep);
  const TITLES = [{ at: 0, text: 'Москва, октябрь' }, { at: 4, text: 'концерт' }, { at: 7, text: 'мои будни' }];

  const clipEls = RAW.map(c => {
    const d = document.createElement('div');
    d.className = 'clip';
    d.style.backgroundImage = `url(media/c/${c.id}.jpg)`;
    clipsEl.appendChild(d);
    return d;
  });
  const previewImgs = kept.map(c => {
    const img = new Image();
    img.src = `media/c/${c.id}.jpg`; img.alt = ''; img.decoding = 'async';
    preview.appendChild(img);
    return img;
  });
  const titleEls = TITLES.map(t => {
    const d = document.createElement('div');
    d.className = 'ttl'; d.textContent = t.text;
    titlesEl.appendChild(d);
    return d;
  });
  const BARS = 96;
  const bars = Array.from({ length: BARS }, (_, i) => {
    const b = document.createElement('i');
    const h = 18 + 70 * Math.abs(Math.sin(i * 1.7) * Math.cos(i * .37)) + (i % 8 === 0 ? 12 : 0);
    b.style.height = Math.min(100, h) + '%';
    waveEl.appendChild(b);
    return b;
  });

  let geo = null;
  const measure = () => {
    const W = tlEl.clientWidth, H = tlEl.clientHeight;
    const left = parseFloat(getComputedStyle(tlEl).getPropertyValue('--tl-left')) || 44;
    const x0 = left + 3, trackW = W - x0 - 6;
    const vy = 18 + 4, vh = Math.max(20, H * .46 - 8);
    const sum = kept.reduce((s, c) => s + c.keep, 0);
    const gap = 2;
    const finalW = RAW.map(c => c.keep ? (trackW - gap * (kept.length - 1)) * c.keep / sum : 0);
    const rawW = trackW / 4.2;
    // границы финальных клипов → сильные доли на звуковой дорожке
    const edges = []; let acc = x0;
    finalW.forEach(w => { if (w) { edges.push(acc); acc += w + gap; } });
    const waveW = W - left;
    const beatIdx = new Set(edges.map(x => clamp(Math.round((x - left) / waveW * BARS), 0, BARS - 1)));
    geo = { W, H, x0, trackW, vy, vh, finalW, rawW, gap, edges, beatIdx };
    bars.forEach((b, i) => b.dataset.beat = beatIdx.has(i) ? '1' : '');
    TITLES.forEach((t, k) => {
      const i = t.at;
      titleEls[k].style.left = edges[i] + 'px';
      titleEls[k].style.width = Math.max(60, kept[i] ? (finalW[RAW.indexOf(kept[i])] - 2) : 80) + 'px';
    });
  };

  const seg = (p, a, b) => clamp((p - a) / (b - a), 0, 1);
  let lastStep = -1, lastIdx = -1;
  const render = (p) => {
    if (!geo) measure();
    const g = geo;
    const t2 = ease(seg(p, .12, .38));
    let x = g.x0;
    RAW.forEach((c, i) => {
      const el = clipEls[i];
      const w = lerp(g.rawW, g.finalW[i], t2);
      const drop = c.keep ? 0 : t2 * 18;
      el.style.width = Math.max(0, w) + 'px';
      el.style.height = g.vh + 'px';
      el.style.transform = `translate(${x}px, ${g.vy + drop}px)`;
      el.style.opacity = c.keep ? 1 : 1 - t2;
      x += w + (w > 1 ? g.gap : 0);
    });

    const grade = ease(seg(p, .58, .76));
    const filter = `saturate(${lerp(.45, 1.06, grade)}) contrast(${lerp(.8, 1.08, grade)}) brightness(${lerp(1.14, 1, grade)})`;
    clipsEl.style.filter = filter;
    preview.style.filter = filter;

    const beatsOn = p > .42;
    bars.forEach(b => b.classList.toggle('beat', beatsOn && b.dataset.beat === '1'));

    const ph = seg(p, .38, .96);
    const total = g.edges.length ? (g.edges[g.edges.length - 1] - g.x0) + g.finalW[RAW.indexOf(kept[kept.length - 1])] : g.trackW;
    const px = g.x0 + ph * total;
    playhead.style.opacity = p > .36 ? 1 : 0;
    playhead.style.transform = `translateX(${px}px)`;
    let idx = 0;
    if (p > .36) g.edges.forEach((ex, i) => { if (px >= ex) idx = i; });
    if (idx !== lastIdx) {
      previewImgs.forEach((im, i) => im.classList.toggle('is-on', i === idx));
      note.textContent = kept[idx].note;
      lastIdx = idx;
    }

    chat.style.opacity = 1 - seg(p, .22, .3);
    preview.style.opacity = seg(p, .24, .32);
    note.style.opacity = seg(p, .76, .82) * (1 - seg(p, .95, .99));
    titleEls.forEach((el, k) => { el.style.opacity = seg(p, .76 + k * .03, .8 + k * .03); });
    done.style.opacity = seg(p, .95, .99);

    const step = p < .12 ? 0 : p < .38 ? 1 : p < .58 ? 2 : p < .76 ? 3 : 4;
    if (step !== lastStep) { steps.forEach((li, i) => li.classList.toggle('is-on', i === step)); lastStep = step; }
  };

  measure();
  let deskP = motion ? 0 : 1;
  if (!motion) steps.forEach(li => li.classList.add('is-on'));
  const deskProgress = () => {
    const r = desk.getBoundingClientRect();
    const span = r.height - innerHeight;
    return span > 0 ? clamp(-r.top / span, 0, 1) : 1;
  };
  if (motion) {
    let cur = deskProgress();
    const loop = () => {
      const target = deskProgress();
      cur = lerp(cur, target, .18);
      if (Math.abs(cur - target) < .0005) cur = target;
      if (cur !== deskP) { deskP = cur; render(deskP); }
      requestAnimationFrame(loop);
    };
    render(cur); deskP = cur;
    requestAnimationFrame(loop);
  } else {
    render(1);
    if (lastStep !== -1) steps.forEach(li => li.classList.add('is-on'));
  }
  let rT;
  addEventListener('resize', () => { clearTimeout(rT); rT = setTimeout(() => { measure(); lastIdx = -1; render(deskP); if (!motion) steps.forEach(li => li.classList.add('is-on')); }, 120); });

  /* ---------- 5. режимы: превью за курсором ---------- */
  const peek = document.querySelector('[data-peek]');
  if (fine) {
    const pp = { x: 0, y: 0, tx: 0, ty: 0, on: false };
    const move = () => {
      pp.x = motion ? lerp(pp.x, pp.tx, .16) : pp.tx;
      pp.y = motion ? lerp(pp.y, pp.ty, .16) : pp.ty;
      peek.style.transform = `translate(${pp.x}px, ${pp.y}px)`;
      if (pp.on) requestAnimationFrame(move);
    };
    document.querySelectorAll('[data-modes] .mode').forEach(m => {
      m.addEventListener('pointerenter', (e) => {
        const src = m.dataset.media;
        const isVid = src.endsWith('.mp4');
        peek.innerHTML = isVid && motion
          ? `<video src="${src}" muted loop playsinline autoplay></video>`
          : `<img src="${isVid ? src.replace('.mp4', '.jpg') : src}" alt="">`;
        pp.tx = e.clientX + 28; pp.ty = e.clientY - 150;
        if (!pp.on) { pp.x = pp.tx; pp.y = pp.ty; pp.on = true; requestAnimationFrame(move); }
        peek.classList.add('is-on');
      });
      m.addEventListener('pointermove', (e) => { pp.tx = e.clientX + 28; pp.ty = e.clientY - 150; });
      m.addEventListener('pointerleave', () => { peek.classList.remove('is-on'); pp.on = false; });
    });
  }

  /* ---------- шапка над лавандой темнеет ---------- */
  const top = document.querySelector('.top');
  const modesSec = document.querySelector('.modes');
  const headerTone = () => {
    const r = modesSec.getBoundingClientRect();
    top.classList.toggle('on-light', r.top < 40 && r.bottom > 40);
  };
  addEventListener('scroll', headerTone, { passive: true });
  headerTone();

  /* ---------- 8. фон очереди ---------- */
  const waitBg = document.querySelector('.wait__bg');
  if (motion && 'IntersectionObserver' in window) {
    new IntersectionObserver(([en]) => {
      if (en.isIntersecting) { waitBg.preload = 'auto'; waitBg.play().catch(() => {}); } else waitBg.pause();
    }, { threshold: .2 }).observe(waitBg);
  }
})();
