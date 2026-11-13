/**
 * IntroTimeline
 * ----------
 * 职责：按参考片逐帧拆解出的出入场节奏编排 GSAP 时间线。
 * 只动画 transform / opacity / clip-path。
 *
 * 参考片节奏拆解（每拍约 1.3s，拍间交叉淡化）：
 *   入场：文字被遮罩裁住，从底部向上"推出"定位（yPercent 115 → 0，0.7s，power3.out），
 *         同时一层低饱和矿土色渐变"色罩"淡出 → 视觉上复现参考片"彩色落定"
 *   停留：约 0.3s
 *   出场：整拍变暗、微微上浮消失（0.45s，power1.in），与下一拍入场重叠
 * 最后一拍（logo）落定后触发 HeroHandoff，整层按 fadeOut（默认 0.5s）淡出。
 */
(function () {
  'use strict';

  const ENTER = 0.7;    // 入场时长（底部推出）
  const EXIT = 0.45;    // 出场时长（变暗 + 上浮）

  class IntroTimeline {
    /**
     * @param {HTMLElement} root   .intro-root
     * @param {object}      el     IntroOverlay 缓存的节点引用（含 beats 数组）
     * @param {object}      cfg    VIRIDANCE_INTRO_CONFIG
     * @param {Function}    onExitComplete 时间线走完时回调（进入 HeroHandoff）
     */
    constructor(root, el, cfg, onExitComplete) {
      this.root = root;
      this.el = el;
      this.cfg = cfg;
      this.seq = cfg.sequence;
      this.onExitComplete = onExitComplete;
      this.tl = null;
      this._handedOff = false;
    }

    play() {
      const gsap = window.gsap;
      const seq = this.seq;
      const beat = seq.beatDuration;
      const logoMotion = window.ViridanceIntroLogoMotion;

      // 初始态：文字拍藏进底部遮罩下方；logo 拍轻微下沉待升
      gsap.set(this.el.beats.map((b) => b.root), { opacity: 0 });
      this.el.beats.forEach((b) => {
        if (b.type === 'logo') {
          b.brand = b.stack.querySelector('.vi-brand');
          if (!b.brand) gsap.set(b.stack, { y: 30 });
        } else {
          gsap.set(b.stack, { yPercent: 120 });  // 推出起点：文字整体在遮罩线以下（含内边距余量）
        }
      });
      gsap.set(this.el.skip, { opacity: 0 });

      const tl = gsap.timeline();
      this.tl = tl;

      let t = 0.45; // 首拍推迟 0.3s：给全局水印先淡入的空间（水印从 0.15s 起）

      /* ---- 全局水印：第一拍前 0.3s 淡入，之后一直铺底 ---- */
      if (this.el.watermark) {
        gsap.set(this.el.watermark, { opacity: 0 });
        tl.to(this.el.watermark, { opacity: 1, duration: 0.6, ease: 'sine.out' }, 0.15);
      }

      this.el.beats.forEach((b, i) => {
        const isLast = i === this.el.beats.length - 1;

        /* ---- 入场：从底部向上推出（遮罩裁切，对应参考片文字升起） ---- */
        if (b.brand) {
          const animations = logoMotion.prepare(b.root, b.brand);
          const playhead = { milliseconds: 0 };
          tl.set(b.root, { opacity: 1 }, t);
          tl.to(playhead, {
            milliseconds: logoMotion.duration * 1000,
            duration: logoMotion.duration,
            ease: 'none',
            onUpdate: () => {
              animations.forEach(animation => { animation.currentTime = playhead.milliseconds; });
            },
          }, t);
        } else {
          tl.to(b.root, { opacity: 1, duration: 0.3, ease: 'power1.out' }, t);
          if (b.type === 'logo') {
            tl.to(b.stack, { y: 0, duration: ENTER, ease: 'power3.out' }, t);
          } else {
            tl.to(b.stack, { yPercent: 0, duration: ENTER, ease: 'power3.out' }, t);
          }
        }

        /* ---- 色罩落定：低饱和矿土色渐变淡出 → 文字"落定"为暖白 ---- */
        if (b.tint) {
          tl.to(b.tint, { opacity: 0, duration: 0.9, ease: 'power1.out' }, t + 0.1);
        }

        /* ---- 扫光：入场期一道窄窗掠过（呼应参考片渐变的流动感，弱化处理） ---- */
        if (b.sheenCore) {
          tl.fromTo(b.sheenCore,
            { clipPath: 'inset(-8% 100% -8% 0%)' },
            { clipPath: 'inset(-8% 0% -8% 100%)', duration: 0.7, ease: 'power2.inOut' },
            t + 0.08);
        }

        /* ---- 出场：变暗 + 上浮，与下一拍入场重叠 ---- */
        if (!isLast) {
          const outAt = t + beat - EXIT + 0.1;
          tl.to(b.root, { opacity: 0, duration: EXIT, ease: 'power1.in' }, outAt);
          tl.to(b.stack, { y: -26, duration: EXIT, ease: 'power1.in' }, outAt);
          t += beat;
        } else {
          // 第四拍播放完整素材后再交棒，前三拍时长不变。
          t += b.brand ? logoMotion.duration : beat;
          tl.call(() => this._handOff(), null, t + 0.15);
        }
      });

      // Skip 提示在第一拍稳定后低对比出现
      tl.to(this.el.skip, { opacity: 1, duration: 0.4, ease: 'sine.out' }, 0.5);

      return tl;
    }

    _handOff() {
      if (this._handedOff) return;
      this._handedOff = true;
      if (this.onExitComplete) this.onExitComplete();
    }

    /** 跳过：杀掉当前时间线，由 HeroHandoff 走快速退出 */
    kill() {
      if (this.tl) this.tl.kill();
    }
  }

  window.ViridanceIntroTimeline = IntroTimeline;
})();
