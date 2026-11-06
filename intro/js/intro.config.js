/**
 * Viridance Intro — 全局配置
 * 参考样式：近黑舞台 + 一次一词 + 扫光落定（产品片开场范式）
 * 顺序：viridance → 两条使命文案 → logo → 0.5s 淡出进 Hero
 */
window.VIRIDANCE_INTRO_CONFIG = {
  /** 总开关 */
  enabled: true,

  /** 首访判定：'local' = 跨会话只播一次；'session' = 每个浏览器会话播一次 */
  storage: 'local',
  storageKey: 'viridance:intro-played',

  /**
   * 分镜序列（按出现顺序，同一时刻只有一拍在画面上）。
   * type: 'word' 品牌字标（超大、小写） | 'line' 使命文案（大写、宽字距、可换行） | 'logo' Logo 图像
   * 每拍节奏：淡入 → 扫光扫过 → 停留 → 与下一拍交叉淡化
   */
  sequence: {
    background: '#FFFFFF',   // 白底舞台
    beatDuration: 1.3,       // 每拍总时长（秒）
    crossfade: 0.25,         // 拍与拍之间的交叉淡化
    fadeOut: 0.5,            // 结尾整层淡出（用户指定 0.5s）
    /**
     * 末拍 Logo 出场：烟雾消散——
     * 边缘模糊化（blur）+ 轻微上浮 + 缓慢放大 + 透明度归零，
     * 随后整层按 fadeOut 淡出揭示 Hero。
     * enabled: false 可回退为纯淡出。
     */
    smokeExit: {
      enabled: true,
      duration: 1.0,     // 整段消散时长（秒）
      blur: 14,          // 最终模糊半径（px）——过大就成了失焦，14 左右才像边缘被吹散
      rise: 40,          // 上升距离（px），配合放大做出"向上飘散"
      scale: 1.12,       // 消散过程中的膨胀倍数
      fadeDelay: 0.25,   // 透明度开始下降的时刻（秒）：先软化飘起，后段才淡出
      fadeDuration: 0.75,// 透明度归零所用时长（秒）
    },
    beats: [
      { type: 'line', text: 'ENVIRONMENTAL TECHNOLOGIES' },
      { type: 'line', text: 'ENVIRONMENTAL STEWARDSHIP FOR MINING OPERATIONS' },
      { type: 'line', text: 'FROM ASSESSMENT THROUGH RESTORATION AND CLOSURE' },
      { type: 'logo' },
    ],
  },

  /**
   * Logo：真实品牌文件（assets/virilogo.png，1920×674 横向锁定组合）。
   * 当前文件已处理为透明底 RGBA PNG（原始白底稿备份在 assets/_source/），
   * plate: false → Logo 直接落在舞台底色上（当前为白底，边缘自然融合）；
   * 若改用深色舞台，可置 true 用纯白承托区托底。
   * 尺寸自适应（clamp + height:auto），object-fit 保证不裁切不拉伸。
   */
  logo: {
    src: 'intro/assets/virilogo.png',
    alt: 'Viridance Environmental Technologies Pvt Ltd',
    plate: false,
    /**
     * 背景水印：超大、极浅的品牌字，Logo 叠在其上。
     * 第一拍前 0.3s 淡入，末拍与 Logo 一起烟雾消散。enabled: false 可关闭。
     */
    backdrop: {
      enabled: true,
      text: 'VIRIDANCE',
    },
    /** 降级占位字标（Logo 加载失败时才出现） */
    wordmark: 'VIRIDANCE',
    wordmarkSub: 'ENVIRONMENTAL TECHNOLOGIES PVT LTD',
  },

  /** 跳过入口文案 + 无障碍标签 */
  skip: {
    label: 'Skip intro',
    ariaLabel: 'Skip intro and enter the site',
  },
};
