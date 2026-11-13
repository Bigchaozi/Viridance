/**
 * IntroOverlay
 * ----------
 * 职责：
 *  - 判定是否需要播放（首次访问 / 强制参数 / reduced-motion / GSAP 可用性）
 *  - 构建开场 DOM（按配置的 beat 序列：word / line / logo + Skip 入口）
 *  - 滚动锁定、焦点管理（焦点移入 Skip、Tab 圈定、结束后归还）
 *  - 跳过交互：点击任意处 / Enter / Space
 *
 * 不负责：动画编排（IntroTimeline）、收场揭示（HeroHandoff）。
 */
(function () {
  'use strict';

  const FOCUSABLE = 'a[href], button:not([disabled]), input, select, textarea, [tabindex]:not([tabindex="-1"])';

  class IntroOverlay {
    /**
     * @param {object} cfg window.VIRIDANCE_INTRO_CONFIG
     */
    constructor(cfg) {
      this.cfg = cfg;
      this.root = null;
      this.el = {};          // 关键节点引用，供 Timeline / Handoff 使用
      this.previouslyFocused = null;
      this._onKeydown = this._onKeydown.bind(this);
      this._onSkip = this._onSkip.bind(this);
    }

    /* ------------------------------------------------------------------
     * 播放判定
     * ------------------------------------------------------------------ */
    shouldPlay() {
      if (!this.cfg.enabled) return false;

      // 调试/演示：?intro=1 强制重放
      const params = new URLSearchParams(location.search);
      if (params.get('intro') === '1') return true;

      // GSAP 不可用 → 直接静态进入首页，不做残缺的开场
      if (window.__GSAP_FAILED__ || typeof window.gsap === 'undefined') return false;

      try {
        if (this.cfg.storage !== 'none') {
          const store = this.cfg.storage === 'session' ? sessionStorage : localStorage;
          if (store.getItem(this.cfg.storageKey) === '1') return false;
        }
      } catch (_) { /* 隐私模式等：按"未播放"处理，失败时写入被吞掉即可 */ }

      return true;
    }

    prefersReducedMotion() {
      return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    }

    /* ------------------------------------------------------------------
     * 挂载与清理
     * ------------------------------------------------------------------ */
    mount() {
      this.previouslyFocused = document.activeElement;

      this.root = document.createElement('div');
      this.root.className = 'intro-root';
      this.root.setAttribute('role', 'dialog');
      this.root.setAttribute('aria-modal', 'true');
      this.root.setAttribute('aria-label', 'Viridance introduction');
      this.root.style.background = this.cfg.sequence.background;
      this.root.innerHTML = this._template();
      document.body.appendChild(this.root);

      this._cacheElements();
      this._lockScroll();
      this._bindSkip();
      return this.root;
    }

    /** 挂载静态版（reduced-motion / 降级路径：直接可见 Logo，不做扫光与逐拍） */
    mountStatic() {
      this.mount();
      this.root.classList.add('intro-root--static');
      return this.root;
    }

    destroy() {
      this._unlockScroll();
      document.removeEventListener('keydown', this._onKeydown, true);
      if (this.root && this.root.parentNode) this.root.parentNode.removeChild(this.root);
      this.root = null;

      // 焦点归还：优先还给打开前的元素，否则交给导航第一个链接
      const target = this.previouslyFocused && document.contains(this.previouslyFocused)
        ? this.previouslyFocused
        : document.querySelector('.site-nav ' + FOCUSABLE);
      if (target) target.focus({ preventScroll: true });
    }

    _cacheElements() {
      const q = (sel) => this.root.querySelector(sel);
      this.el.skip = q('.intro-skip');
      this.el.watermark = q('.intro-watermark');   // 全局背景水印（可空）

      // beats：[{ root, stack, tint, sheenCore, type }]
      this.el.beats = Array.from(this.root.querySelectorAll('.intro-beat')).map((node) => ({
        root: node,
        type: node.dataset.type,
        stack: node.querySelector('.intro-beat__stack'),
        tint: node.querySelector('.intro-beat__text--tint'),
        sheenCore: node.querySelector('.intro-beat__text--sheen-core'),
      }));
    }

    /* ------------------------------------------------------------------
     * DOM 模板：按配置序列生成一拍一层的堆叠结构
     * ------------------------------------------------------------------ */
    _template() {
      const c = this.cfg;
      const beats = c.sequence.beats.map((beat) => {
        if (beat.type === 'logo') return this._logoBeatMarkup();
        const text = beat.text;
        const cls = beat.type === 'word' ? 'intro-beat--word' : 'intro-beat--line';
        return `
          <div class="intro-beat ${cls}" data-type="${beat.type}">
            <span class="intro-beat__mask">
              <span class="intro-beat__stack">
                <span class="intro-beat__text intro-beat__text--base">${text}</span>
                <span class="intro-beat__text intro-beat__text--tint" aria-hidden="true">${text}</span>
                <span class="intro-beat__text intro-beat__text--sheen intro-beat__text--sheen-core" aria-hidden="true">${text}</span>
              </span>
            </span>
          </div>`;
      }).join('');

      return `
        <div class="intro-content">
          <div class="liquid-preview__wash" aria-hidden="true">
            <div class="liquid-preview__color liquid-preview__color--sage"></div>
            <div class="liquid-preview__color liquid-preview__color--mint"></div>
          </div>
          ${this._watermarkMarkup()}
          <div class="intro-stage">${beats}</div>
          <button type="button" class="intro-skip">${c.skip.label}</button>
        </div>
      `;
    }

    /**
     * 背景水印：单个超大极浅品牌字，挂在 content 层（节拍之下、不参与朗读）。
     * 时间线上比第一拍早 0.3s 淡入，末拍与 Logo 一起烟雾消散。
     */
    _watermarkMarkup() {
      const wm = this.cfg.logo && this.cfg.logo.backdrop;
      if (!wm || wm.enabled === false) return '';
      return `<span class="intro-watermark" aria-hidden="true">${wm.text || 'VIRIDANCE'}</span>`;
    }

    _logoBeatMarkup() {
      const c = this.cfg;
      const motion = window.ViridanceIntroLogoMotion;
      const plate = motion && typeof Element.prototype.animate === 'function'
        ? motion.markup
        : c.logo.plate
        ? `<figure class="intro-plate">
             <img class="intro-logo" src="${c.logo.src}" alt="${c.logo.alt}"
                  onerror="this.style.display='none';this.parentNode.querySelector('.intro-logo-fallback').style.display='block';" />
             <figcaption class="intro-logo-fallback" style="display:none" aria-hidden="true">
               <span class="intro-logo-fallback__word">${c.logo.wordmark}</span>
               <span class="intro-logo-fallback__sub">${c.logo.wordmarkSub}</span>
             </figcaption>
           </figure>`
        : `<img class="intro-logo intro-logo--bare" src="${c.logo.src}" alt="${c.logo.alt}"
                onerror="this.style.display='none';this.parentNode.querySelector('.intro-logo-fallback').style.display='block';" />
           <div class="intro-logo-fallback" style="display:none" aria-hidden="true">
             <span class="intro-logo-fallback__word">${c.logo.wordmark}</span>
             <span class="intro-logo-fallback__sub">${c.logo.wordmarkSub}</span>
           </div>`;

      return `
        <div class="intro-beat intro-beat--logo" data-type="logo">
          <span class="intro-beat__stack intro-beat__stack--logo">${plate}</span>
        </div>`;
    }

    /* ------------------------------------------------------------------
     * 滚动锁定 & 跳过交互
     * ------------------------------------------------------------------ */
    _lockScroll() {
      document.documentElement.classList.add('intro-locked');
      document.body.classList.add('intro-locked');
    }

    _unlockScroll() {
      document.documentElement.classList.remove('intro-locked');
      document.body.classList.remove('intro-locked');
    }

    _bindSkip() {
      this.root.addEventListener('click', this._onSkip);
      this.el.skip.addEventListener('click', (e) => { e.stopPropagation(); this._onSkip(); });
      document.addEventListener('keydown', this._onKeydown, true);
      // 不在挂载时抢焦点：避免开场即出现焦点框。
      // 跳过本身由文档级 keydown 兜底（Enter / Space 任意位置可用），
      // 键盘用户按 Tab 时再落到 Skip 上。
    }

    _onKeydown(e) {
      if (e.key === 'Enter' || e.key === ' ' || e.key === 'Spacebar') {
        e.preventDefault();
        this._onSkip();
        return;
      }
      if (e.key === 'Tab') {
        // 开场层内唯一可聚焦元素是 Skip → Tab 圈定在它身上
        e.preventDefault();
        this.el.skip.focus();
      }
    }

    _onSkip() {
      if (this._skipped) return;
      this._skipped = true;
      if (typeof this.onSkipRequest === 'function') this.onSkipRequest();
    }
  }

  window.ViridanceIntroOverlay = IntroOverlay;
})();
