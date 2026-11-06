/**
 * Bootstrap：把三个模块串起来。
 *
 * IntroOverlay   → DOM / 交互 / 焦点
 * IntroTimeline  → GSAP 分镜
 * HeroHandoff    → 收场揭示 / 标记 / 释放
 */
(function () {
  'use strict';

  /* 供现有首页 Hero 判断：片头引导器已经注册，需等待完成事件再入场。 */
  window.__VIRIDANCE_INTRO_BOOTSTRAPPED__ = true;

  function broadcast(reason) {
    document.dispatchEvent(new CustomEvent('viridance:intro:complete', {
      detail: { reason },
    }));
  }

  function isHomeEntry() {
    const route = location.hash.replace(/^#\/?/, '').split('/')[0];
    const forced = new URLSearchParams(location.search).get('intro') === '1';
    return forced || route === '' || route === 'home';
  }

  function boot() {
    const cfg = window.VIRIDANCE_INTRO_CONFIG;
    if (!cfg) {
      broadcast('config-missing');
      return;
    }

    /* 深链到 About / Services / News / Contact 时直接显示目标页面。 */
    if (!isHomeEntry()) {
      broadcast('non-home-route');
      return;
    }

    const overlay = new window.ViridanceIntroOverlay(cfg);
    const handoff = new window.ViridanceIntroHeroHandoff(cfg);

    /* ---------- 情况 1：不播放（重复访问 / 开关关闭 / GSAP 缺失） ---------- */
    if (!overlay.shouldPlay()) {
      // SPA 路由场景：在路由守卫里调用同样的 shouldPlay() 逻辑即可，天然不会重播。
      broadcast('not-played');
      return;
    }

    /* ---------- 情况 2：prefers-reduced-motion → 静态版 ---------- */
    if (overlay.prefersReducedMotion() || window.__GSAP_FAILED__) {
      overlay.mountStatic();
      handoff.revealStatic(overlay);
      return;
    }

    /* ---------- 情况 3：正常播放 ---------- */
    overlay.mount();
    overlay.onSkipRequest = () => handoff.skip(overlay, timeline);

    let timeline = new window.ViridanceIntroTimeline(
      overlay.root,
      overlay.el,
      cfg,
      () => handoff.reveal(overlay) // 自然播完 → 遮罩收拢揭示 Hero
    );
    const tl = timeline.play();

    // 调试：?intro_seek=1.2 把时间线冻结到指定秒数，便于逐帧截图/评审
    const seek = new URLSearchParams(location.search).get('intro_seek');
    if (seek !== null) {
      window.gsap.globalTimeline.pause();
      tl.seek(parseFloat(seek));
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})();
