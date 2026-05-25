// 可爱猫咪笔记吉祥物 - 内联 SVG (CC0,自绘)
// 风格: 圆嘟嘟橙白色花纹小猫咪握着笔
// 用法: import {MASCOT_CAT, MASCOT_CAT_SLEEP} from './mascot.js'
// 直接 element.innerHTML = MASCOT_CAT 即可

export const MASCOT_CAT = `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 120" width="100%" height="100%">
  <defs>
    <radialGradient id="bodyG" cx="50%" cy="40%" r="60%">
      <stop offset="0%" stop-color="#fff1d6"/>
      <stop offset="55%" stop-color="#fbd9a8"/>
      <stop offset="100%" stop-color="#e8b27a"/>
    </radialGradient>
    <radialGradient id="cheekG" cx="50%" cy="50%" r="50%">
      <stop offset="0%" stop-color="#f6a3a0" stop-opacity=".95"/>
      <stop offset="100%" stop-color="#f6a3a0" stop-opacity="0"/>
    </radialGradient>
  </defs>

  <!-- 身体椭圆 -->
  <ellipse cx="60" cy="78" rx="32" ry="28" fill="url(#bodyG)" stroke="#8b5a3c" stroke-width="1.5"/>
  <!-- 肚白 -->
  <ellipse cx="60" cy="84" rx="20" ry="15" fill="#fffaf0" opacity=".9"/>

  <!-- 尾巴 -->
  <path d="M88 80 Q104 70 102 56 Q100 46 92 48" fill="none" stroke="#8b5a3c" stroke-width="3.5" stroke-linecap="round"/>
  <path d="M88 80 Q104 70 102 56 Q100 46 92 48" fill="none" stroke="#fbd9a8" stroke-width="2" stroke-linecap="round"/>

  <!-- 头(略微歪头) -->
  <g transform="rotate(-6 60 50)">
    <!-- 耳朵 -->
    <path d="M38 30 L34 14 L52 22 Z" fill="url(#bodyG)" stroke="#8b5a3c" stroke-width="1.5" stroke-linejoin="round"/>
    <path d="M38 30 L36 18 L48 22 Z" fill="#f4a8b0"/>
    <path d="M82 30 L86 14 L68 22 Z" fill="url(#bodyG)" stroke="#8b5a3c" stroke-width="1.5" stroke-linejoin="round"/>
    <path d="M82 30 L84 18 L72 22 Z" fill="#f4a8b0"/>

    <!-- 头部主体 -->
    <ellipse cx="60" cy="46" rx="26" ry="24" fill="url(#bodyG)" stroke="#8b5a3c" stroke-width="1.5"/>

    <!-- 花纹 -->
    <path d="M48 26 Q52 30 50 36" fill="none" stroke="#c98b5b" stroke-width="2.5" stroke-linecap="round" opacity=".7"/>
    <path d="M72 26 Q68 30 70 36" fill="none" stroke="#c98b5b" stroke-width="2.5" stroke-linecap="round" opacity=".7"/>
    <path d="M60 24 L60 32" fill="none" stroke="#c98b5b" stroke-width="2.5" stroke-linecap="round" opacity=".7"/>

    <!-- 腮红 -->
    <ellipse cx="44" cy="54" rx="6" ry="4" fill="url(#cheekG)"/>
    <ellipse cx="76" cy="54" rx="6" ry="4" fill="url(#cheekG)"/>

    <!-- 眼睛(开心眯眼) -->
    <path d="M46 48 Q50 44 54 48" fill="none" stroke="#2a2421" stroke-width="2.5" stroke-linecap="round"/>
    <path d="M66 48 Q70 44 74 48" fill="none" stroke="#2a2421" stroke-width="2.5" stroke-linecap="round"/>

    <!-- 鼻子 -->
    <path d="M58 55 L60 58 L62 55 Z" fill="#f4a8b0" stroke="#8b5a3c" stroke-width="1" stroke-linejoin="round"/>
    <!-- 嘴 -->
    <path d="M60 58 Q56 62 54 60" fill="none" stroke="#2a2421" stroke-width="1.5" stroke-linecap="round"/>
    <path d="M60 58 Q64 62 66 60" fill="none" stroke="#2a2421" stroke-width="1.5" stroke-linecap="round"/>

    <!-- 胡须 -->
    <line x1="34" y1="56" x2="44" y2="58" stroke="#2a2421" stroke-width="1" stroke-linecap="round" opacity=".7"/>
    <line x1="34" y1="60" x2="44" y2="60" stroke="#2a2421" stroke-width="1" stroke-linecap="round" opacity=".7"/>
    <line x1="76" y1="58" x2="86" y2="56" stroke="#2a2421" stroke-width="1" stroke-linecap="round" opacity=".7"/>
    <line x1="76" y1="60" x2="86" y2="60" stroke="#2a2421" stroke-width="1" stroke-linecap="round" opacity=".7"/>
  </g>

  <!-- 笔(在右爪) -->
  <g transform="rotate(20 88 78)">
    <rect x="84" y="62" width="6" height="22" rx="2" fill="#8a6fb5"/>
    <rect x="84" y="62" width="6" height="6" rx="1" fill="#5d4585"/>
    <polygon points="84,84 87,90 90,84" fill="#2a2421"/>
  </g>

  <!-- 爪子 -->
  <ellipse cx="48" cy="98" rx="6" ry="5" fill="url(#bodyG)" stroke="#8b5a3c" stroke-width="1.2"/>
  <ellipse cx="72" cy="98" rx="6" ry="5" fill="url(#bodyG)" stroke="#8b5a3c" stroke-width="1.2"/>

  <!-- 闪光小星星 -->
  <g opacity=".85">
    <path d="M20 30 l1.5 3 3 1.5 -3 1.5 -1.5 3 -1.5 -3 -3 -1.5 3 -1.5 z" fill="#d97b6c"/>
    <path d="M100 26 l1 2 2 1 -2 1 -1 2 -1 -2 -2 -1 2 -1 z" fill="#8a6fb5"/>
    <path d="M102 100 l1 2 2 1 -2 1 -1 2 -1 -2 -2 -1 2 -1 z" fill="#d97b6c"/>
  </g>
</svg>
`.trim();

// 录音中的猫(戴着耳机版,简化版)
export const MASCOT_CAT_LISTEN = `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 120" width="100%" height="100%">
  <defs>
    <radialGradient id="bodyG2" cx="50%" cy="40%" r="60%">
      <stop offset="0%" stop-color="#fff1d6"/>
      <stop offset="55%" stop-color="#fbd9a8"/>
      <stop offset="100%" stop-color="#e8b27a"/>
    </radialGradient>
  </defs>
  <!-- 身体 -->
  <ellipse cx="60" cy="80" rx="30" ry="26" fill="url(#bodyG2)" stroke="#8b5a3c" stroke-width="1.5"/>
  <ellipse cx="60" cy="86" rx="18" ry="14" fill="#fffaf0" opacity=".9"/>

  <!-- 头 -->
  <ellipse cx="60" cy="48" rx="26" ry="24" fill="url(#bodyG2)" stroke="#8b5a3c" stroke-width="1.5"/>
  <!-- 耳朵被耳机压住 -->
  <path d="M38 32 L34 18 L50 24 Z" fill="url(#bodyG2)" stroke="#8b5a3c" stroke-width="1.5"/>
  <path d="M82 32 L86 18 L70 24 Z" fill="url(#bodyG2)" stroke="#8b5a3c" stroke-width="1.5"/>

  <!-- 耳机 -->
  <path d="M30 44 Q30 22 60 22 Q90 22 90 44" fill="none" stroke="#d97b6c" stroke-width="4" stroke-linecap="round"/>
  <ellipse cx="30" cy="48" rx="7" ry="9" fill="#d97b6c"/>
  <ellipse cx="90" cy="48" rx="7" ry="9" fill="#d97b6c"/>
  <ellipse cx="30" cy="48" rx="4" ry="6" fill="#5d4585"/>
  <ellipse cx="90" cy="48" rx="4" ry="6" fill="#5d4585"/>

  <!-- 腮红 -->
  <circle cx="44" cy="56" r="4" fill="#f6a3a0" opacity=".7"/>
  <circle cx="76" cy="56" r="4" fill="#f6a3a0" opacity=".7"/>

  <!-- 眼睛(认真专注的圆眼) -->
  <circle cx="50" cy="50" r="3" fill="#2a2421"/>
  <circle cx="70" cy="50" r="3" fill="#2a2421"/>
  <circle cx="51" cy="49" r="1" fill="#fff"/>
  <circle cx="71" cy="49" r="1" fill="#fff"/>

  <!-- 嘴(O 型,专注听) -->
  <ellipse cx="60" cy="60" rx="2.5" ry="3" fill="#5a2a1f"/>

  <!-- 音波线 -->
  <g opacity=".7">
    <path d="M14 48 Q10 56 14 64" fill="none" stroke="#8a6fb5" stroke-width="2" stroke-linecap="round"/>
    <path d="M8 44 Q2 56 8 68" fill="none" stroke="#8a6fb5" stroke-width="2" stroke-linecap="round" opacity=".5"/>
    <path d="M106 48 Q110 56 106 64" fill="none" stroke="#8a6fb5" stroke-width="2" stroke-linecap="round"/>
    <path d="M112 44 Q118 56 112 68" fill="none" stroke="#8a6fb5" stroke-width="2" stroke-linecap="round" opacity=".5"/>
  </g>
</svg>
`.trim();

// 紧凑版 logo(用于工具栏 / popup 头部)
export const MASCOT_LOGO = `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 40 40" width="100%" height="100%">
  <defs>
    <linearGradient id="lgG" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#fbd9a8"/>
      <stop offset="100%" stop-color="#d97b6c"/>
    </linearGradient>
  </defs>
  <rect width="40" height="40" rx="10" fill="url(#lgG)"/>
  <!-- 简化猫脸 -->
  <path d="M11 14 L9 8 L15 11 Z" fill="#fff1d6"/>
  <path d="M29 14 L31 8 L25 11 Z" fill="#fff1d6"/>
  <circle cx="20" cy="22" r="11" fill="#fff1d6"/>
  <!-- 眯眼 -->
  <path d="M14 21 Q16.5 19 19 21" fill="none" stroke="#2a2421" stroke-width="1.6" stroke-linecap="round"/>
  <path d="M21 21 Q23.5 19 26 21" fill="none" stroke="#2a2421" stroke-width="1.6" stroke-linecap="round"/>
  <!-- 鼻 -->
  <path d="M19 24 L20 25.5 L21 24 Z" fill="#f4a8b0"/>
  <!-- 微笑 -->
  <path d="M20 25.5 Q18 27 17 26" fill="none" stroke="#2a2421" stroke-width="1.2" stroke-linecap="round"/>
  <path d="M20 25.5 Q22 27 23 26" fill="none" stroke="#2a2421" stroke-width="1.2" stroke-linecap="round"/>
  <!-- 腮红 -->
  <circle cx="13" cy="25" r="2" fill="#f4a8b0" opacity=".7"/>
  <circle cx="27" cy="25" r="2" fill="#f4a8b0" opacity=".7"/>
</svg>
`.trim();

// 空状态:可爱睡觉的猫
export const MASCOT_EMPTY = `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 140" width="100%" height="100%">
  <defs>
    <radialGradient id="bodyEmp" cx="50%" cy="40%" r="60%">
      <stop offset="0%" stop-color="#fff1d6"/>
      <stop offset="100%" stop-color="#e8b27a"/>
    </radialGradient>
  </defs>
  <!-- 蜷缩身体 -->
  <ellipse cx="100" cy="90" rx="60" ry="30" fill="url(#bodyEmp)" stroke="#8b5a3c" stroke-width="1.5"/>
  <ellipse cx="100" cy="100" rx="40" ry="18" fill="#fffaf0" opacity=".7"/>
  <!-- 尾巴绕一圈 -->
  <path d="M155 88 Q170 80 165 64 Q160 54 148 60 Q138 66 142 76" fill="none" stroke="#8b5a3c" stroke-width="3" stroke-linecap="round"/>
  <!-- 头 -->
  <ellipse cx="56" cy="80" rx="22" ry="20" fill="url(#bodyEmp)" stroke="#8b5a3c" stroke-width="1.5"/>
  <!-- 耳朵 -->
  <path d="M40 66 L36 52 L52 60 Z" fill="url(#bodyEmp)" stroke="#8b5a3c" stroke-width="1.5"/>
  <path d="M70 64 L74 50 L60 58 Z" fill="url(#bodyEmp)" stroke="#8b5a3c" stroke-width="1.5"/>
  <!-- 闭眼睡觉 -->
  <path d="M46 80 Q50 84 54 80" fill="none" stroke="#2a2421" stroke-width="2" stroke-linecap="round"/>
  <path d="M62 80 Q66 84 70 80" fill="none" stroke="#2a2421" stroke-width="2" stroke-linecap="round"/>
  <!-- 嘴 -->
  <path d="M58 88 Q56 90 54 89" fill="none" stroke="#2a2421" stroke-width="1.5" stroke-linecap="round"/>
  <path d="M58 88 Q60 90 62 89" fill="none" stroke="#2a2421" stroke-width="1.5" stroke-linecap="round"/>
  <!-- 腮红 -->
  <ellipse cx="44" cy="86" rx="4" ry="2.5" fill="#f4a8b0" opacity=".6"/>
  <ellipse cx="68" cy="86" rx="4" ry="2.5" fill="#f4a8b0" opacity=".6"/>
  <!-- Z Z Z -->
  <text x="78" y="50" font-family="system-ui" font-size="14" font-weight="700" fill="#8a6fb5" opacity=".8">z</text>
  <text x="88" y="40" font-family="system-ui" font-size="18" font-weight="700" fill="#8a6fb5" opacity=".7">z</text>
  <text x="100" y="28" font-family="system-ui" font-size="22" font-weight="700" fill="#8a6fb5" opacity=".6">Z</text>
</svg>
`.trim();
