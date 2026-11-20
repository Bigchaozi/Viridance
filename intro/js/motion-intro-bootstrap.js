/**
 * Motion Typography Intro — Bootstrap（主页接入层）
 * ---------------------------------------------------------------------------
 * 用 intro/motion-intro.html（6 镜头动态排版文字开场）替换旧四阶段片头。
 * 设计原则：非破坏式接入。旧 intro 全部资源保留，仅停用旧 main.js；
 *   本文件是唯一新的执行入口，回退只需在 HTML 里恢复 main.js、删掉本脚本。
 *
 * 复用既有契约（与旧 main.js / HeroHandoff 完全一致）：
 *   - window.__VIRIDANCE_INTRO_BOOTSTRAPPED__ = true
 *   - 完成后 document.dispatchEvent('viridance:intro:complete', { detail: { reason } })
 *   - 首访标记读写 VIRIDANCE_INTRO_CONFIG.storage / storageKey
 *   - 滚动锁定 html/body.intro-locked（旧 CSS 已定义）
 *   - 深链非首页路由不播放
 */
(function () {
  'use strict';

  var cfg = window.VIRIDANCE_INTRO_CONFIG || {
    enabled: true, storage: 'none',
    storageKey: 'viridance:intro-played',
    skip: { label: 'Skip intro' },
  };

  /* 首页 Hero 依赖此标记决定是否等待 complete 事件再入场 */
  window.__VIRIDANCE_INTRO_BOOTSTRAPPED__ = true;

  var FRAME_SRC = 'intro/motion-intro.html?forceMotion=1';
  var MSG_TYPE = 'viridance:motion-intro';
  var DONE_REASONS = { complete: 'natural', skip: 'skip' };

  var root = null;
  var frame = null;
  var finished = false;

  function broadcast(reason) {
    document.dispatchEvent(new CustomEvent('viridance:intro:complete', {
      detail: { reason: reason },
    }));
  }

  function isHomeEntry() {
    var route = (location.hash || '').replace(/^#\/?/, '').split('/')[0];
    var forced = new URLSearchParams(location.search).get('intro') === '1';
    return forced || route === '' || route === 'home';
  }

  function shouldPlay() {
    if (cfg.enabled === false) return false;
    var params = new URLSearchParams(location.search);
    if (params.get('intro') === '1') return true;
    if (cfg.storage === 'none') return true;
    try {
      var store = cfg.storage === 'session' ? sessionStorage : localStorage;
      return store.getItem(cfg.storageKey) !== '1';
    } catch (_) {
      return true;
    }
  }

  function markPlayed() {
    if (cfg.storage === 'none') return;
    try {
      var store = cfg.storage === 'session' ? sessionStorage : localStorage;
      store.setItem(cfg.storageKey, '1');
    } catch (_) { /* 隐私模式忽略 */ }
  }

  function prefersReducedMotion() {
    try { return window.matchMedia('(prefers-reduced-motion: reduce)').matches; }
    catch (_) { return false; }
  }

  function lockScroll(locked) {
    document.documentElement.classList.toggle('intro-locked', locked);
    document.body.classList.toggle('intro-locked', locked);
  }

  /** 收场：淡出遮罩 → 广播完成事件（Hero 同步入场）→ 移除节点、解锁滚动 */
  function finish(reason) {
    if (finished) return;
    finished = true;
    markPlayed();
    broadcast(DONE_REASONS[reason] || 'natural');

    var fadeMs = prefersReducedMotion() ? 150 : ((cfg.sequence && cfg.sequence.fadeOut ? cfg.sequence.fadeOut : 0.5) * 1000);
    if (root) {
      root.style.transitionDuration = Math.round(fadeMs) + 'ms';
      root.classList.add('is-leaving');
      window.setTimeout(function () {
        if (frame) { try { frame.src = 'about:blank'; } catch (_) {} }
        if (root && root.parentNode) root.parentNode.removeChild(root);
        root = null;
        frame = null;
        lockScroll(false);
      }, Math.round(fadeMs) + 40);
    } else {
      lockScroll(false);
    }
  }

  /** 接收 iframe 内动画的自然播完通知 */
  function onMessage(event) {
    var data = event.data;
    if (!data || data.type !== MSG_TYPE) return;
    // 仅接受来自本开场 iframe 的消息
    if (!frame || event.source !== frame.contentWindow) return;
    if (data.reason === 'complete') finish('complete');
  }

  function mount() {
    root = document.createElement('div');
    root.className = 'motion-intro-root';
    root.setAttribute('role', 'dialog');
    root.setAttribute('aria-modal', 'true');
    root.setAttribute('aria-label', 'Viridance introduction');

    frame = document.createElement('iframe');
    frame.className = 'motion-intro-root__frame';
    frame.src = FRAME_SRC;
    frame.title = 'Viridance opening animation';
    frame.setAttribute('scrolling', 'no');
    frame.setAttribute('allow', 'autoplay');
    // 沙箱：允许脚本与同源；不允许表单/弹窗/顶部导航
    frame.setAttribute('sandbox', 'allow-scripts allow-same-origin');

    var skip = document.createElement('button');
    skip.type = 'button';
    skip.className = 'motion-intro-root__skip';
    skip.textContent = (cfg.skip && cfg.skip.label) || 'Skip intro';
    skip.setAttribute('aria-label', (cfg.skip && cfg.skip.ariaLabel) || 'Skip intro and enter the site');
    skip.addEventListener('click', function (e) {
      e.stopPropagation();
      finish('skip');
    });

    root.appendChild(frame);
    root.appendChild(skip);
    document.body.appendChild(root);
    lockScroll(true);

    // 键盘跳过：Enter / Space（与旧版一致）
    document.addEventListener('keydown', onKeydown, true);
    // iframe 加载失败兜底：不应让用户卡在白屏
    frame.addEventListener('error', function () { finish('skip'); });
  }

  function onKeydown(e) {
    if (finished) return;
    if (e.key === 'Enter' || e.key === ' ' || e.key === 'Spacebar') {
      e.preventDefault();
      finish('skip');
    }
  }

  function boot() {
    if (!isHomeEntry()) {
      broadcast('non-home-route');
      return;
    }
    if (!shouldPlay()) {
      broadcast('not-played');
      return;
    }
    if (prefersReducedMotion()) {
      // 静态降级：极短白屏后直接进入 Hero（开场层本身也有 reduced 分支兜底）
      broadcast('reduced-motion');
      return;
    }

    window.addEventListener('message', onMessage, false);
    mount();

    // 兜底：若动画因任何原因未发来完成消息（加载异常/浏览器限制），
    // 在总时长(10.25s)+较大缓冲后强制进入首页，避免用户被卡住。
    window.setTimeout(function () { finish('complete'); }, 12000);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})();
