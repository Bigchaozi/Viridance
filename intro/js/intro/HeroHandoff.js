/**
 * HeroHandoff
 * ----------
 * 职责：开场结束（或被跳过）后的收场——
 *  - 整层按 sequence.fadeOut（默认 0.5s）淡出，揭示已就位的首页 Hero
 *    （Hero 与透明导航自始就在 DOM 中，不闪跳、不二次加载）
 *  - 写入"已播放"标记（storage: 'none' 时跳过，刷新首页即重播）
 *  - 释放滚动锁定与焦点，广播 intro:complete 事件
 */
(function () {
  'use strict';

  class HeroHandoff {
    /**
     * @param {object} cfg VIRIDANCE_INTRO_CONFIG
     */
    constructor(cfg) {
      this.cfg = cfg;
    }

    /** 写入首访标记（跳过与播完都算"已看"）；storage:'none' 时不记忆，每次刷新都播 */
    markPlayed() {
      if (this.cfg.storage === 'none') return;
      try {
        const store = this.cfg.storage === 'session' ? sessionStorage : localStorage;
        store.setItem(this.cfg.storageKey, '1');
      } catch (_) { /* 隐私模式：忽略 */ }
    }

    /**
     * 自然播完路径：末拍 Logo 先"烟雾消散"（blur + 上浮 + 放大 + 透明），
     * 中途整层按 sequence.fadeOut 淡出，揭示已就位的首页 Hero。
     * smokeExit.enabled: false 时回退为纯淡出。
     * @param {IntroOverlay} overlay
     */
    reveal(overlay) {
      this.markPlayed();
      const seq = this.cfg.sequence || {};
      const dur = seq.fadeOut || 0.5;
      const smoke = seq.smokeExit || {};
      const logoBeat = (overlay.el.beats || []).find((b) => b.type === 'logo');

      if (!window.gsap || !logoBeat || !logoBeat.stack || smoke.enabled === false) {
        // 纯淡出回退
        if (window.gsap) {
          window.gsap.to(overlay.root, {
            opacity: 0, duration: dur, ease: 'power1.out',
            onComplete: () => overlay.destroy(),
          });
        } else {
          overlay.destroy();
        }
        this._broadcast('natural');
        return;
      }

      const smokeDur = smoke.duration || 0.9;
      const tl = window.gsap.timeline({ onComplete: () => overlay.destroy() });

      // Skip 提示先行退场
      tl.to(overlay.el.skip, { opacity: 0, duration: 0.15, ease: 'none' }, 0);

      /* 烟雾消散：三段并行，做出"先飘起 → 边缘被吹散 → 最后化掉"的层次
         1) 位置与膨胀：起步就有位移，飘散感来自这里
         2) 模糊：越到后面越散
         3) 透明度：延后启动，避免过早消失变成普通淡出
         水印与 Logo 同步消散 */
      const smokeTargets = [logoBeat.stack];
      if (overlay.el.watermark) smokeTargets.push(overlay.el.watermark);

      tl.to(smokeTargets, {
        y: -(smoke.rise || 40),
        scale: smoke.scale || 1.12,
        duration: smokeDur,
        ease: 'power2.out',
      }, 0);
      tl.to(smokeTargets, {
        filter: `blur(${smoke.blur || 14}px)`,
        duration: smokeDur,
        ease: 'power1.in',
      }, 0);
      tl.to(smokeTargets, {
        opacity: 0,
        duration: smoke.fadeDuration || 0.75,
        ease: 'power2.in',
      }, smoke.fadeDelay || 0.25);

      // 消散后段整层淡出，Hero 同步显露
      tl.to(overlay.root, {
        opacity: 0, duration: dur, ease: 'power1.out',
      }, smokeDur * 0.65);

      this._broadcast('natural');
    }

    /**
     * 跳过路径：快速淡出，不等待分镜。
     * @param {IntroOverlay} overlay
     * @param {IntroTimeline|null} timeline
     */
    skip(overlay, timeline) {
      if (timeline) timeline.kill();
      this.markPlayed();

      if (window.gsap) {
        window.gsap.to(overlay.root, {
          opacity: 0, duration: 0.25, ease: 'power1.in',
          onComplete: () => overlay.destroy(),
        });
      } else {
        overlay.destroy();
      }
      this._broadcast('skip');
    }

    /**
     * 静态路径（prefers-reduced-motion / GSAP 缺失）：
     * 直接显示静态 Logo，150ms 内淡出进入 Hero。
     * @param {IntroOverlay} overlay
     */
    revealStatic(overlay) {
      this.markPlayed();
      window.setTimeout(() => {
        if (window.gsap) {
          window.gsap.to(overlay.root, {
            opacity: 0, duration: 0.15, ease: 'none',
            onComplete: () => overlay.destroy(),
          });
        } else {
          overlay.root.style.transition = 'opacity 150ms linear';
          overlay.root.style.opacity = '0';
          window.setTimeout(() => overlay.destroy(), 160);
        }
      }, 600); // 静态版给一个极短的阅读窗口（<1s，可按需调）
      this._broadcast('reduced-motion');
    }

    /** 广播完成事件，供首页做后续增强（如 Hero 内容入场） */
    _broadcast(reason) {
      document.dispatchEvent(new CustomEvent('viridance:intro:complete', {
        detail: { reason },
      }));
    }
  }

  window.ViridanceIntroHeroHandoff = HeroHandoff;
})();
