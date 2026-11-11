/**
 * Viridance 前置开场片头 — 自动播放控制器（可嵌入任意宿主页）
 *
 * 职责：
 *   1. 首访判定 / 滚动锁定 / 跳过与重播 / 焦点管理；
 *   2. 用 performance.now() + rAF 推进时间轴，四张同机位影像按节拍依次揭示；
 *   3. 四拍英文主文案与阶段节点同步切换，共用改版前的字号 / 行高 / 字距；
 *   4. 所有可见状态都是播放时间 t 的纯函数（render(t)），因此可任意定格；
 *   5. 末拍停留后整层淡出，直接揭示宿主页首页，并写入「已播放」标记。
 *
 * 零依赖，不引入 GSAP。节奏与文案集中在 js/intro.config.js。
 * 对宿主页的唯一假设：#introRoot 结构存在、intro.config.js 先于本文件加载。
 * 首页节点（data-intro-inert）与重播按钮（#replayIntro）都是可选的。
 */
(function () {
  'use strict';

  const CFG = window.VIRIDANCE_INTRO;
  if (!CFG) return;

  const TL = CFG.timeline;
  const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
  const ramp = (t, from, dur) => clamp((t - from) / dur, 0, 1);
  const easeOutQuart = (x) => 1 - Math.pow(1 - x, 4);
  const easeOutSine = (x) => Math.sin((x * Math.PI) / 2);
  const easeInOutCubic = (x) =>
    x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2;

  function boot() {
    const html = document.documentElement;
    const root = document.getElementById('introRoot');
    const replayBtn = document.getElementById('replayIntro');   // 宿主页可选
    const inertTargets = CFG.inertSelector
      ? Array.prototype.slice.call(document.querySelectorAll(CFG.inertSelector))
      : [];                                                     // 宿主页可选（支持多个节点）
    if (!root) return;

    /* assetPath 按宿主页 URL 解析成绝对地址：CSS 变量里的 url() 会以
       样式表所在目录为基准，用绝对地址才不会被解析到 /css/assets/... 去。 */
    let assetBase = CFG.assetPath || 'assets/stages/';
    try { assetBase = new URL(assetBase, document.baseURI).href; } catch (_) {}

    /* 素材路径由配置注入，覆盖 intro.css 的默认相对路径，便于合并进任意首页 */
    ['soil', 'grass', 'shrub', 'forest'].forEach(function (n) {
      root.style.setProperty('--intro-img-' + n,
        'url("' + assetBase + n + '.jpg")');
    });

    const q = (id) => document.getElementById(id);
    const vision = q('introVision');
    const ui = q('introUI');
    const uiTop = q('uiTop');
    const uiPhase = q('uiPhase');
    const uiBottom = q('uiBottom');
    const head = q('uiHead');
    const beats = Array.prototype.slice.call(
      document.querySelectorAll('.ui-title__beat')
    );
    let entranceLines = Array.prototype.slice.call(
      document.querySelectorAll('[data-entrance-line]')
    );
    const layers = Array.prototype.slice.call(
      document.querySelectorAll('.vision-layer[data-layer]')
    );
    const fill = q('progressFill');
    const valueEl = q('progressValue');
    const phaseCurrent = q('phaseCurrent');
    const phaseIndex = q('phaseIndex');
    const phaseZh = q('phaseZh');
    const phaseAnnounce = q('phaseAnnounce');
    const railItems = Array.prototype.slice.call(
      document.querySelectorAll('#phaseRail span')
    );
    const wordSlots = Array.prototype.slice.call(
      phaseCurrent.querySelectorAll('.phase__word')
    );
    const skipBtn = q('introSkip');
    const skipMeta = q('introSkipMeta');

    const params = new URLSearchParams(location.search);
    const seekT = params.get('t');
    const isDebugSeek = seekT !== null;

    if (skipMeta) {
      const secs = Math.round(TL.duration);
      skipMeta.textContent = 'AUTOPLAY  ·  00:' + String(secs).padStart(2, '0');
    }

    let state = 'idle';        // idle | playing | paused | seeking | skipping | done
    let startAt = 0;
    let currentT = 0;
    let rafId = 0;
    let activeSlot = 0;
    let currentStage = 0;
    let skipped = false;
    let finished = false;

    /* ------------------------------------------------------------------
     * 四拍文案：从 CFG.beats 生成行；桌面沿用原字号，窄屏四拍同比例缩一档
     * ------------------------------------------------------------------ */
    function buildBeats() {
      if (!Array.isArray(CFG.beats) || !CFG.beats.length) return;
      beats.forEach(function (beat, i) {
        const cfg = CFG.beats[i];
        if (!cfg || !Array.isArray(cfg.lines)) return;
        beat.textContent = '';
        cfg.lines.forEach(function (text, j) {
          const line = document.createElement('span');
          line.className = 'ui-title__line';
          const inner = document.createElement('span');
          inner.textContent = text;
          if (i === 0) inner.setAttribute('data-entrance-line', String(j));
          line.appendChild(inner);
          beat.appendChild(line);
        });
      });
      entranceLines = Array.prototype.slice.call(
        document.querySelectorAll('[data-entrance-line]')
      );
    }

    function fitBeats() {
      const maxW = head.clientWidth;
      if (!maxW) return;                        // 开场层未显示时跳过
      const base = parseFloat(getComputedStyle(head).fontSize) || 48;
      const limit = maxW * 0.985;
      /* 先让四拍都回到改版前的基准字号，再用 Range 量所有行里最长的一行。
         span 是 block（宽度 = 容器），所以量的是文本 rect 而不是元素宽度。 */
      beats.forEach(function (beat) { beat.style.fontSize = base + 'px'; });
      let widest = 0;
      const range = document.createRange();
      beats.forEach(function (beat) {
        beat.querySelectorAll('.ui-title__line > span').forEach(function (s) {
          range.selectNodeContents(s);
          const w = range.getBoundingClientRect().width;
          if (w > widest) widest = w;
        });
      });
      /* 桌面原样保留基准字号；仅窄屏放不下最长行时，四拍同比例缩一档，
         保证任何视口下四拍字号都完全一致。 */
      const size = widest > limit ? (base * limit) / widest : base;
      beats.forEach(function (beat) {
        beat.style.fontSize = size.toFixed(2) + 'px';
      });
    }

    function setBeat(index) {
      beats.forEach(function (beat, i) {
        const on = i === index;
        beat.classList.toggle('is-visible', on);
        if (on) beat.removeAttribute('aria-hidden');
        else beat.setAttribute('aria-hidden', 'true');
      });
    }

    /* ------------------------------------------------------------------
     * 渲染：给定播放秒数 t，写出全部可见状态（纯函数，可 seek 到任意帧）
     * ------------------------------------------------------------------ */
    function paintLayer(el, t) {
      if (t <= 0) {
        el.style.opacity = '0';
        el.style.maskImage = 'none';
        el.style.webkitMaskImage = 'none';
        return;
      }
      if (t >= 1) {
        el.style.opacity = '1';
        el.style.maskImage = 'none';
        el.style.webkitMaskImage = 'none';
        return;
      }
      el.style.opacity = '1';
      el.style.maskImage = '';        // 回到 .is-masked 的纵向羽化渐变
      el.style.webkitMaskImage = '';
      // 生长前沿从画面下方之外走到上方之外：端点天然全隐 / 全显
      const cut = -CFG.feather + t * (100 + CFG.feather);
      el.style.setProperty('--cut', cut.toFixed(2) + '%');
    }

    function setPhase(index) {
      const s = CFG.stages[index];
      const incoming = wordSlots[1 - activeSlot];
      const outgoing = wordSlots[activeSlot];

      incoming.textContent = s.word;
      incoming.classList.remove('is-visible');
      void incoming.offsetWidth;      // 保证从 opacity:0 起过渡
      incoming.classList.add('is-visible');
      outgoing.classList.remove('is-visible');
      activeSlot = 1 - activeSlot;

      phaseZh.textContent = s.label;
      phaseIndex.textContent = String(index + 1).padStart(2, '0') + ' / 04';
      phaseAnnounce.textContent = 'Phase ' + (index + 1) + ': ' + s.announce;
      railItems.forEach((el, i) => el.classList.toggle('is-active', i === index));
    }

    function render(t) {
      currentT = t;

      /* 黑场渐显 */
      vision.style.opacity = easeOutSine(ramp(t, 0, TL.fadeIn)).toFixed(4);
      // 入场淡入 × 收尾先退场：文字在整层淡出前已收净，不与首页标题叠字
      const uiIn = easeOutSine(ramp(t, 0.10, 0.50));
      const uiOut = 1 - easeInOutCubic(ramp(t, TL.uiFadeStart, TL.uiFadeDuration));
      ui.style.opacity = (uiIn * uiOut).toFixed(4);

      /* 入场：一次性；首拍两行从底部推出，之后各拍靠交叉淡化接管 */
      const E = TL.entrance;
      uiTop.style.opacity = easeOutSine(ramp(t, E.top[0], E.top[1])).toFixed(4);
      uiPhase.style.opacity = easeOutSine(ramp(t, E.phase[0], E.phase[1])).toFixed(4);
      uiBottom.style.opacity = easeOutSine(ramp(t, E.bottom[0], E.bottom[1])).toFixed(4);

      [E.line0, E.line1].forEach(function (range, i) {
        if (!entranceLines[i]) return;
        const e = easeOutQuart(ramp(t, range[0], range[1]));
        entranceLines[i].style.transform =
          'translateY(' + (105 * (1 - e)).toFixed(2) + '%)';
      });

      /* 四阶段：纵向羽化遮罩由下向上揭示 */
      TL.reveals.forEach(function (range, i) {
        const raw = ramp(t, range[0], range[1] - range[0]);
        paintLayer(layers[i], easeInOutCubic(raw));
      });

      /* 进度条：随播放连续推进，FOREST 完成时到 100% */
      const p = clamp(t / TL.progressFullAt, 0, 1);
      fill.style.transform = 'scaleX(' + p.toFixed(4) + ')';
      valueEl.textContent = String(Math.round(p * 100)).padStart(2, '0') + '%';

      /* 节点：状态词短淡入淡出 + 主文案整组交叉淡化，两者同一时刻 */
      let index = 0;
      for (let i = TL.stageAt.length - 1; i >= 0; i--) {
        if (t >= TL.stageAt[i]) { index = i; break; }
      }
      if (index !== currentStage) {
        currentStage = index;
        setPhase(index);
        setBeat(index);
      }

      /* 结尾整层淡出，直接揭示宿主页首页 */
      const out = easeInOutCubic(ramp(t, TL.fadeOutStart, TL.fadeOut));
      root.style.opacity = (1 - out).toFixed(4);
    }

    /* ------------------------------------------------------------------
     * 播放循环
     * ------------------------------------------------------------------ */
    function frame(now) {
      if (state === 'playing') {
        const t = (now - startAt) / 1000;
        render(Math.min(t, TL.duration));
        if (t >= TL.duration) { finish(); return; }
        rafId = requestAnimationFrame(frame);
      } else if (state === 'skipping') {
        const t = (now - startAt) / 1000;
        root.style.opacity = (1 - clamp(t / TL.skipFade, 0, 1)).toFixed(4);
        if (t >= TL.skipFade) { finish(); return; }
        rafId = requestAnimationFrame(frame);
      } else {
        rafId = 0;
      }
    }
    function requestFrame() { if (!rafId) rafId = requestAnimationFrame(frame); }

    function startTimeline() {
      state = 'playing';
      startAt = performance.now();
      render(0);
      requestFrame();
    }

    /* ------------------------------------------------------------------
     * 挂载 / 收场
     * ------------------------------------------------------------------ */
    function lock() {
      html.classList.add('intro-locked');
      document.body.classList.add('intro-locked');
      inertTargets.forEach(function (el) { if ('inert' in el) el.inert = true; });
    }
    function unlock() {
      html.classList.remove('intro-locked');
      document.body.classList.remove('intro-locked');
      inertTargets.forEach(function (el) { if ('inert' in el) el.inert = false; });
    }
    function markPlayed() {
      try {
        if (CFG.storage === 'none') return;
        const store = CFG.storage === 'session' ? sessionStorage : localStorage;
        store.setItem(CFG.storageKey, '1');
      } catch (_) { /* 隐私模式：吞掉即可 */ }
    }

    function finish() {
      if (finished) return;
      finished = true;
      state = 'done';
      if (rafId) { cancelAnimationFrame(rafId); rafId = 0; }
      if (!isDebugSeek) markPlayed();          // 定格调试不改变首访标记
      html.classList.remove('intro-enabled');   // root 转为 display:none，此时 opacity 已为 0
      unlock();
      document.removeEventListener('keydown', onKeydown, true);
      document.dispatchEvent(new CustomEvent('viridance:intro:complete'));
      // 开场层自始至终没有抢过焦点，关闭后也不主动 focus，
      // 避免鼠标用户看到突兀的焦点框；解除 inert 后 Tab 自然进入首页。
    }

    function skip() {
      if (skipped || finished || state === 'idle' || state === 'done') return;
      skipped = true;
      if (state === 'seeking') { finish(); return; }  // 定格调试：点任意处直接进首页
      state = 'skipping';
      startAt = performance.now();
      if (rafId) { cancelAnimationFrame(rafId); rafId = 0; }
      requestFrame();
    }

    /* ------------------------------------------------------------------
     * 交互：点击任意处 / Enter / Space / Esc 跳过，Tab 圈定在 Skip；
     * 宿主页可选放 #replayIntro 按钮随时重播（不刷新页面）
     * ------------------------------------------------------------------ */
    function onKeydown(e) {
      if (state !== 'playing' && state !== 'paused' && state !== 'seeking') return;
      if (e.key === 'Enter' || e.key === ' ' || e.key === 'Spacebar' || e.key === 'Escape') {
        e.preventDefault();
        skip();
        return;
      }
      if (e.key === 'Tab') {
        e.preventDefault();
        skipBtn.focus({ preventScroll: true });
      }
    }
    root.addEventListener('click', skip);
    document.addEventListener('keydown', onKeydown, true);

    /* 标签页切走时暂停，回来从原帧继续，避免一次跳到结尾 */
    document.addEventListener('visibilitychange', function () {
      if (document.hidden && state === 'playing') {
        state = 'paused';
        if (rafId) { cancelAnimationFrame(rafId); rafId = 0; }
      } else if (!document.hidden && state === 'paused') {
        startAt = performance.now() - currentT * 1000;
        state = 'playing';
        requestFrame();
      }
    });

    /* 视口变化时重算字号（移动端竖屏 / 窗口缩放） */
    let resizeTimer = 0;
    window.addEventListener('resize', function () {
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(fitBeats, 120);
    });

    function resetState() {
      finished = false;
      skipped = false;
      currentStage = 0;
      activeSlot = 0;
      setBeat(0);
      wordSlots[0].textContent = CFG.stages[0].word;
      wordSlots[0].classList.add('is-visible');
      wordSlots[1].textContent = '';
      wordSlots[1].classList.remove('is-visible');
      phaseZh.textContent = CFG.stages[0].label;
      phaseIndex.textContent = '01 / 04';
      phaseAnnounce.textContent = 'Phase 1: ' + CFG.stages[0].announce;
      railItems.forEach((el, i) => el.classList.toggle('is-active', i === 0));
      root.style.opacity = '1';
    }

    function mount(autoplay) {
      html.classList.add('intro-enabled');
      root.classList.toggle('is-seek', !autoplay);
      document.addEventListener('keydown', onKeydown, true); // 重播时重新接管键盘
      resetState();
      fitBeats();
      lock();
      render(0);
      return preloadImages().then(function () {
        if (autoplay) startTimeline();
        else { state = 'seeking'; render(parseFloat(seekT) || 0); }
      });
    }

    function preloadImages() {
      const base = assetBase;
      const names = ['soil', 'grass', 'shrub', 'forest'];
      return new Promise(function (resolve) {
        let left = names.length;
        let settled = false;
        const done = function () {
          if (--left <= 0 && !settled) { settled = true; resolve(); }
        };
        const bail = function () { if (!settled) { settled = true; resolve(); } };
        names.forEach(function (n) {
          const im = new Image();
          im.onload = done;
          im.onerror = done;
          im.src = base + n + '.jpg';
        });
        setTimeout(bail, 1800);   // 兜底：绝不因图片慢而长时间黑屏
      });
    }

    if (replayBtn) {
      replayBtn.addEventListener('click', function () {
        window.scrollTo({ top: 0, behavior: 'instant' });
        mount(true);
      });
    }

    /* ---------- 启动 ---------- */
    buildBeats();
    if (seekT !== null) {
      mount(false);                       // 定格调试：不自动播、不写标记
    } else if (html.classList.contains('intro-enabled')) {
      mount(true);
    }
    // 否则：已播放过 / ?intro=0 / reduced-motion → 直接显示首页，开场层保持 display:none
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})();
