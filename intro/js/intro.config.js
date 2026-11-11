/**
 * Viridance 前置开场片头 — 唯一配置入口（自动播放版 / 可嵌入宿主页）
 *
 * 节奏沿用旧版前置开场动画：黑场渐显 → 文字从底部推出（0.85s / easeOutQuart，
 * 对应旧版 0.7s power3.out）→ 一次一拍、节点处 0.25s 交叉淡化 →
 * 末拍 FOREST 停留约 1.3s → 整层 0.6s 淡出，直接揭示首页。
 * 总时长 8.4s，全部由时间驱动，无需滚动，也没有中间的正文屏。
 *
 * 四拍文案与四阶段一一对应，节点处同步切换：
 *   01 SOIL    ENVIRONMENTAL TECHNOLOGIES
 *   02 GRASS   ENVIRONMENTAL STEWARDSHIP FOR MINING OPERATIONS
 *   03 SHRUB   FROM ASSESSMENT THROUGH RESTORATION AND CLOSURE
 *   04 FOREST  REPAIR IS ALSO A FORM OF DESIGN.
 * 界面文案全英文，不出现中文。lines 即每条文案的换行方式。
 *
 * 时间轴（秒）：
 *   0.00 – 0.90   黑场渐显，SOIL 裸土定格，第一拍文案推出
 *   0.35 – 1.35   主标题两行依次从底部遮罩推出、UI 淡入
 *   1.00 – 2.60   草地由画面下方向上长出
 *   2.60          节点 → GRASS，切第二拍文案；2.60 – 2.90 阶段定格
 *   2.90 – 4.50   成片灌木由下向上显露
 *   4.50          节点 → SHRUB，切第三拍文案；4.50 – 4.80 阶段定格
 *   4.80 – 6.50   更密集的林地由下向上覆盖
 *   6.50          节点 → FOREST，切第四拍文案、进度 100%；6.50 – 7.80 停留
 *   7.80 – 8.40   整层淡出，直接揭示首页（宿主页内容）
 */
window.VIRIDANCE_INTRO = {

  /* 每次进入 / 刷新都播放，不写「已播放」标记（宿主页要求）。
     ?intro=1 强制重播，?intro=0 强制跳过。 */
  storage: 'none',
  storageKey: 'viridance:intro-played',

  /* 素材目录，结尾必须带 /。按宿主页 URL 解析（支持根相对 / 绝对 URL）：
     JS 会转成绝对地址，预加载与四个 --intro-img-* CSS 变量共用它，
     避免 CSS 里的 url() 被按样式表所在目录解析。合并进首页时按实际部署路径改这里。 */
  assetPath: 'intro/assets/stages/',

  /* 播放期间禁止键盘 / 读屏进入的首页节点（可选）。
     给宿主页根节点加 data-intro-inert 即可；不匹配时跳过 inert。 */
  inertSelector: '[data-intro-inert]',

  /* 四拍主文案。lines 数组 = 大标题的每一行，按阶段节点切换。
     改文案只动这里；JS 会按最长行自动缩放字号，保证不溢出左侧版位。 */
  beats: [
    { lines: ['ENVIRONMENTAL', 'TECHNOLOGIES'] },
    { lines: ['ENVIRONMENTAL STEWARDSHIP', 'FOR MINING OPERATIONS'] },
    { lines: ['FROM ASSESSMENT THROUGH', 'RESTORATION AND CLOSURE'] },
    { lines: ['REPAIR IS ALSO', 'A FORM OF DESIGN.'] }
  ],

  stages: [
    { key: 'soil',   word: 'SOIL',   label: 'BARE GROUND', announce: 'bare ground' },
    { key: 'grass',  word: 'GRASS',  label: 'GRASSLAND',   announce: 'grassland' },
    { key: 'shrub',  word: 'SHRUB',  label: 'SCRUBLAND',   announce: 'scrubland' },
    { key: 'forest', word: 'FOREST', label: 'WOODLAND',    announce: 'woodland' }
  ],

  timeline: {
    duration: 8.40,
    fadeIn: 0.90,                 // 影像黑场渐显
    fadeOutStart: 7.80,
    fadeOut: 0.60,                // 整层淡出，直接揭示首页
    uiFadeStart: 7.20,           // UI 文字先退场，避免淡出时与首页标题叠字
    uiFadeDuration: 0.55,
    skipFade: 0.35,               // 跳过时的快速淡出
    progressFullAt: 6.50,         // 进度条到 100% 的时刻

    /* 入场：[起始秒, 时长秒]，全部一次性，不做循环 */
    entrance: {
      top:    [0.15, 0.70],
      line0:  [0.35, 0.85],
      line1:  [0.50, 0.85],
      phase:  [0.60, 0.60],
      bottom: [0.50, 0.60]
    },

    /* 三个植被图层各自的 [起, 止] 揭示区间，顺序 = grass / shrub / forest */
    reveals: [
      [1.00, 2.60],
      [2.90, 4.50],
      [4.80, 6.50]
    ],

    /* 状态词 / 文案切换节点（与每段揭示的终点对齐） */
    stageAt: [0, 2.60, 4.50, 6.50]
  },

  /* 遮罩交界羽化宽度（占视高的百分比），与 intro.css 中的 + 11% 保持一致 */
  feather: 11
};
