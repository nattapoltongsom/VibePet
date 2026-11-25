/**
 * Modular SVG mascot definitions for Cat, Robot, and Dog characters.
 */
(() => {
  const SHARED_LAPTOP_LAYER = `
    <g class="layer-coding">
      <rect x="54" y="114" width="72" height="7" rx="3.5" fill="#94a3b8" />
      <rect x="61" y="88" width="58" height="28" rx="5" fill="#1e293b" stroke="#64748b" stroke-width="2" />
      <rect x="65" y="92" width="50" height="20" rx="2.5" fill="#064e3b" />
      <rect class="code-line-1" x="69" y="96" width="22" height="2.6" rx="1.3" fill="#34d399" />
      <rect class="code-line-1" x="94" y="96" width="12" height="2.6" rx="1.3" fill="#6ee7b7" />
      <rect class="code-line-2" x="73" y="101" width="30" height="2.6" rx="1.3" fill="#a7f3d0" />
      <rect class="code-line-3" x="69" y="106" width="16" height="2.6" rx="1.3" fill="#34d399" />
      <rect class="code-line-3" x="88" y="106" width="18" height="2.6" rx="1.3" fill="#fde047" />
    </g>
  `;

  const SHARED_OVERLAY_LAYERS = `
    <g class="layer-thinking">
      <circle cx="131" cy="48" r="3.5" fill="#f3e8ff" stroke="#a855f7" stroke-width="1.4" />
      <circle cx="139" cy="39" r="5" fill="#f3e8ff" stroke="#a855f7" stroke-width="1.4" />
      <g class="thought-q">
        <circle cx="151" cy="24" r="13" fill="#faf5ff" stroke="#a855f7" stroke-width="2" />
        <text x="151" y="30" text-anchor="middle" font-size="17" font-weight="800" fill="#7e22ce">?</text>
      </g>
    </g>
    <g class="layer-waiting">
      <g class="alert-badge">
        <circle cx="147" cy="30" r="12" fill="#fef3c7" stroke="#f59e0b" stroke-width="2.2" />
        <text x="147" y="36" text-anchor="middle" font-size="16" font-weight="900" fill="#d97706">!</text>
      </g>
      <path d="M153 60 Q161 66 157 74" fill="none" stroke="#fbbf24" stroke-width="2.5" stroke-linecap="round" />
      <path d="M159 56 Q168 65 163 76" fill="none" stroke="#fb923c" stroke-width="2" stroke-linecap="round" opacity="0.8" />
    </g>
    <g class="layer-success">
      <path class="sparkle-1" d="M32 24 L34.8 31.2 L42 34 L34.8 36.8 L32 44 L29.2 36.8 L22 34 L29.2 31.2 Z" fill="#fde047" />
      <path class="sparkle-2" d="M150 20 L152.5 27.5 L160 30 L152.5 32.5 L150 40 L147.5 32.5 L140 30 L147.5 27.5 Z" fill="#4ade80" />
      <path class="sparkle-3" d="M156 69 L157.8 74.2 L163 76 L157.8 77.8 L156 83 L154.2 77.8 L149 76 L154.2 74.2 Z" fill="#fde047" />
      <path class="sparkle-4" d="M24 65 L25.8 70.2 L31 72 L25.8 73.8 L24 79 L22.2 73.8 L17 72 L22.2 70.2 Z" fill="#86efac" />
    </g>
  `;

  function wrapSvg(label: string, rigContent: string): string {
    return `
      <svg class="pet-svg" viewBox="0 0 180 150" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="${label}">
        <defs>
          <radialGradient id="shadowGrad" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stop-color="#0f172a" stop-opacity="0.52" />
            <stop offset="100%" stop-color="#0f172a" stop-opacity="0" />
          </radialGradient>
          <linearGradient id="visorGrad" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stop-color="#1e293b" />
            <stop offset="100%" stop-color="#0f172a" />
          </linearGradient>
          <linearGradient id="shineGrad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stop-color="#ffffff" stop-opacity="0.55" />
            <stop offset="100%" stop-color="#ffffff" stop-opacity="0" />
          </linearGradient>
        </defs>
        <ellipse class="pet-shadow" cx="90" cy="134" rx="34" ry="8" fill="url(#shadowGrad)" />
        <g class="pet-rig">
          ${rigContent}
          ${SHARED_LAPTOP_LAYER}
        </g>
        ${SHARED_OVERLAY_LAYERS}
      </svg>
    `;
  }

  const CHARACTERS: Record<RendererCharacterType, string> = {
    cat: wrapSvg(
      'AI Desktop Cat',
      `
        <g class="pet-tail">
          <path class="pet-tail-stroke" d="M120 108 Q148 106 146 80 Q145 68 136 68" fill="none" stroke-width="11" stroke-linecap="round" />
          <circle class="pet-accent-fill" cx="136" cy="68" r="4.5" opacity="0.9" />
        </g>
        <g class="ear-left">
          <path class="pet-body-fill" d="M51 54 L46 21 Q46 16 51 18 L77 37 Z" stroke="#1e293b" stroke-opacity="0.12" stroke-width="1.5" stroke-linejoin="round" />
          <path class="pet-ear-inner" d="M54 47 L51 26 L69 38 Z" />
        </g>
        <g class="ear-right">
          <path class="pet-body-fill" d="M129 54 L134 21 Q134 16 129 18 L103 37 Z" stroke="#1e293b" stroke-opacity="0.12" stroke-width="1.5" stroke-linejoin="round" />
          <path class="pet-ear-inner" d="M126 47 L129 26 L111 38 Z" />
        </g>
        <ellipse class="pet-body-fill" cx="90" cy="102" rx="34" ry="26" />
        <ellipse class="pet-accent-fill" cx="90" cy="107" rx="20" ry="16" opacity="0.92" />
        <ellipse class="pet-body-shade" cx="72" cy="123" rx="10" ry="6.5" />
        <ellipse class="pet-body-shade" cx="108" cy="123" rx="10" ry="6.5" />
        <ellipse class="pet-accent-fill" cx="72" cy="124" rx="5.5" ry="3.2" opacity="0.85" />
        <ellipse class="pet-accent-fill" cx="108" cy="124" rx="5.5" ry="3.2" opacity="0.85" />
        <g class="arm-left">
          <ellipse class="pet-body-fill" cx="55" cy="98" rx="9.5" ry="11.5" transform="rotate(24 55 98)" stroke="#1e293b" stroke-opacity="0.1" stroke-width="1.2" />
          <circle class="pet-ear-inner" cx="53" cy="102" r="3" opacity="0.8" />
        </g>
        <g class="arm-right">
          <ellipse class="pet-body-fill" cx="125" cy="98" rx="9.5" ry="11.5" transform="rotate(-24 125 98)" stroke="#1e293b" stroke-opacity="0.1" stroke-width="1.2" />
          <circle class="pet-ear-inner" cx="127" cy="102" r="3" opacity="0.8" />
        </g>
        <path class="pet-collar-fill" d="M64 89 Q90 98 116 89 L114 95 Q90 104 66 95 Z" />
        <circle cx="90" cy="97" r="5.5" fill="#fde047" stroke="#ca8a04" stroke-width="1.3" />
        <line x1="87" y1="98.5" x2="93" y2="98.5" stroke="#ca8a04" stroke-width="1.2" stroke-linecap="round" />
        <circle cx="88.5" cy="95.2" r="1.3" fill="#ffffff" opacity="0.85" />
        <ellipse class="pet-body-fill" cx="90" cy="66" rx="43" ry="34" />
        <path d="M62 42 Q90 32 118 42 Q105 51 90 51 Q75 51 62 42 Z" fill="url(#shineGrad)" />
        <rect class="pet-body-shade" x="88" y="34" width="4" height="10" rx="2" opacity="0.65" />
        <rect class="pet-body-shade" x="80" y="36" width="3.5" height="8" rx="1.75" transform="rotate(-14 80 36)" opacity="0.55" />
        <rect class="pet-body-shade" x="96.5" y="36" width="3.5" height="8" rx="1.75" transform="rotate(14 96.5 36)" opacity="0.55" />
        <ellipse class="pet-accent-fill" cx="90" cy="79" rx="18" ry="12" opacity="0.92" />
        <g stroke="#334155" stroke-opacity="0.55" stroke-width="1.7" stroke-linecap="round">
          <line x1="41" y1="69" x2="55" y2="71" />
          <line x1="40" y1="76" x2="55" y2="76" />
          <line x1="43" y1="83" x2="56" y2="80" />
          <line x1="139" y1="69" x2="125" y2="71" />
          <line x1="140" y1="76" x2="125" y2="76" />
          <line x1="137" y1="83" x2="124" y2="80" />
        </g>
        <ellipse cx="63" cy="77" rx="5.8" ry="3.2" fill="#fb7185" opacity="0.55" />
        <ellipse cx="117" cy="77" rx="5.8" ry="3.2" fill="#fb7185" opacity="0.55" />
        <polygon points="87,74 93,74 90,77.5" fill="#fb7185" />
        <g class="eyes-normal">
          <ellipse cx="73" cy="67" rx="5.6" ry="6.8" fill="#1e293b" />
          <ellipse cx="107" cy="67" rx="5.6" ry="6.8" fill="#1e293b" />
          <circle cx="71" cy="64.2" r="2.3" fill="#ffffff" />
          <circle cx="105" cy="64.2" r="2.3" fill="#ffffff" />
          <circle cx="75" cy="69.6" r="1.1" fill="#ffffff" opacity="0.85" />
          <circle cx="109" cy="69.6" r="1.1" fill="#ffffff" opacity="0.85" />
        </g>
        <g class="eyes-thinking">
          <ellipse cx="75" cy="64.5" rx="5.2" ry="6.2" fill="#1e293b" />
          <ellipse cx="109" cy="64.5" rx="5.2" ry="6.2" fill="#1e293b" />
          <circle cx="76.5" cy="62.2" r="2" fill="#ffffff" />
          <circle cx="110.5" cy="62.2" r="2" fill="#ffffff" />
        </g>
        <g class="eyes-coding">
          <ellipse cx="73" cy="68" rx="5.4" ry="4.5" fill="#1e293b" />
          <ellipse cx="107" cy="68" rx="5.4" ry="4.5" fill="#1e293b" />
          <circle cx="72" cy="66.8" r="1.8" fill="#ffffff" />
          <circle cx="106" cy="66.8" r="1.8" fill="#ffffff" />
          <path d="M66 63 L80 65" stroke="#1e293b" stroke-width="2" stroke-linecap="round" />
          <path d="M114 63 L100 65" stroke="#1e293b" stroke-width="2" stroke-linecap="round" />
        </g>
        <g class="eyes-waiting">
          <circle cx="73" cy="66" r="6.8" fill="#1e293b" />
          <circle cx="107" cy="66" r="6.8" fill="#1e293b" />
          <circle cx="70.8" cy="63.2" r="2.8" fill="#ffffff" />
          <circle cx="104.8" cy="63.2" r="2.8" fill="#ffffff" />
          <circle cx="75.6" cy="69" r="1.4" fill="#ffffff" />
          <circle cx="109.6" cy="69" r="1.4" fill="#ffffff" />
        </g>
        <g class="eyes-success">
          <path d="M66 69 Q73 59 80 69" fill="none" stroke="#1e293b" stroke-width="3.6" stroke-linecap="round" />
          <path d="M100 69 Q107 59 114 69" fill="none" stroke="#1e293b" stroke-width="3.6" stroke-linecap="round" />
        </g>
        <path class="mouth-normal" d="M83 80 Q86.5 84.5 90 79.5 Q93.5 84.5 97 80" fill="none" stroke="#1e293b" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" />
        <circle class="mouth-thinking" cx="90" cy="81.5" r="2.4" fill="none" stroke="#1e293b" stroke-width="2" />
        <path class="mouth-waiting" d="M84 79.5 Q90 89 96 79.5 Q93 81.5 90 79.5 Q87 81.5 84 79.5 Z" fill="#f43f5e" stroke="#1e293b" stroke-width="1.5" stroke-linejoin="round" />
        <path class="mouth-success" d="M81 79.5 Q85.5 86 90 79.5 Q94.5 86 99 79.5" fill="none" stroke="#1e293b" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round" />
      `
    ),

    robot: wrapSvg(
      'AI Desktop Robot',
      `
        <g class="antenna-group">
          <line x1="90" y1="39" x2="90" y2="22" stroke="#cbd5e1" stroke-width="4" stroke-linecap="round" />
          <circle class="antenna-orb pet-body-fill" cx="90" cy="18" r="7" />
          <circle cx="88" cy="16" r="2.2" fill="#ffffff" opacity="0.75" />
        </g>
        <rect class="pet-body-shade" x="39" y="64" width="12" height="24" rx="6" />
        <rect class="pet-body-shade" x="129" y="64" width="12" height="24" rx="6" />
        <g class="arm-left">
          <ellipse class="pet-body-fill" cx="44" cy="94" rx="9" ry="12" transform="rotate(18 44 94)" />
          <ellipse cx="42" cy="90" rx="3" ry="4" fill="#ffffff" opacity="0.35" transform="rotate(18 42 90)" />
        </g>
        <g class="arm-right">
          <ellipse class="pet-body-fill" cx="136" cy="94" rx="9" ry="12" transform="rotate(-18 136 94)" />
          <ellipse cx="138" cy="90" rx="3" ry="4" fill="#ffffff" opacity="0.35" transform="rotate(-18 138 90)" />
        </g>
        <rect class="pet-body-fill" x="48" y="38" width="84" height="82" rx="34" />
        <path d="M62 43 Q90 36 118 43 Q106 54 90 54 Q74 54 62 43 Z" fill="url(#shineGrad)" />
        <path class="pet-body-shade" d="M66 113 Q90 123 114 113 Q108 120 90 120 Q72 120 66 113 Z" opacity="0.45" />
        <circle class="pet-accent-fill" cx="90" cy="107" r="4.5" opacity="0.9" />
        <rect x="57" y="54" width="66" height="44" rx="18" fill="url(#visorGrad)" stroke="#ffffff" stroke-opacity="0.22" stroke-width="1.5" />
        <path d="M65 58 L84 58 Q74 68 63 72 Q62 62 65 58 Z" fill="#ffffff" opacity="0.12" />
        <ellipse cx="67" cy="84" rx="4.8" ry="2.6" fill="#fb7185" opacity="0.55" />
        <ellipse cx="113" cy="84" rx="4.8" ry="2.6" fill="#fb7185" opacity="0.55" />
        <g class="eyes-normal">
          <ellipse class="pet-glow-fill" cx="76" cy="74" rx="5.2" ry="6.4" />
          <ellipse class="pet-glow-fill" cx="104" cy="74" rx="5.2" ry="6.4" />
          <circle cx="74.5" cy="71.5" r="2" fill="#ffffff" />
          <circle cx="102.5" cy="71.5" r="2" fill="#ffffff" />
        </g>
        <g class="eyes-thinking">
          <ellipse class="pet-glow-fill" cx="78" cy="71" rx="4.8" ry="5.6" />
          <ellipse class="pet-glow-fill" cx="106" cy="71" rx="4.8" ry="5.6" />
          <circle cx="79.5" cy="69" r="1.8" fill="#ffffff" />
          <circle cx="107.5" cy="69" r="1.8" fill="#ffffff" />
        </g>
        <g class="eyes-coding">
          <rect class="pet-glow-fill" x="70" y="73" width="12" height="5" rx="2.5" />
          <rect class="pet-glow-fill" x="98" y="73" width="12" height="5" rx="2.5" />
          <circle cx="74" cy="75.5" r="1.4" fill="#ffffff" />
          <circle cx="102" cy="75.5" r="1.4" fill="#ffffff" />
        </g>
        <g class="eyes-waiting">
          <circle class="pet-glow-fill" cx="76" cy="73" r="6.2" />
          <circle class="pet-glow-fill" cx="104" cy="73" r="6.2" />
          <circle cx="74" cy="70.5" r="2.4" fill="#ffffff" />
          <circle cx="102" cy="70.5" r="2.4" fill="#ffffff" />
        </g>
        <g class="eyes-success">
          <path class="pet-glow-stroke" d="M69 76 Q76 66 83 76" fill="none" stroke-width="3.6" stroke-linecap="round" />
          <path class="pet-glow-stroke" d="M97 76 Q104 66 111 76" fill="none" stroke-width="3.6" stroke-linecap="round" />
        </g>
        <path class="mouth-normal pet-glow-stroke" d="M84 85 Q90 90 96 85" fill="none" stroke-width="2.4" stroke-linecap="round" />
        <circle class="mouth-thinking pet-glow-stroke" cx="92" cy="86" r="2.8" fill="none" stroke-width="2.2" />
        <path class="mouth-waiting pet-glow-fill" d="M83 84 Q90 94 97 84 Z" />
        <path class="mouth-success pet-glow-stroke" d="M81 83 Q90 93 99 83" fill="none" stroke-width="2.8" stroke-linecap="round" />
      `
    ),

    dog: wrapSvg(
      'AI Desktop Dog',
      `
        <g class="pet-tail">
          <path class="pet-tail-stroke" d="M118 106 Q146 96 144 76" fill="none" stroke-width="11" stroke-linecap="round" />
          <circle class="pet-accent-fill" cx="144" cy="76" r="4.8" opacity="0.95" />
        </g>
        <ellipse class="pet-body-fill" cx="90" cy="102" rx="34" ry="26" />
        <ellipse class="pet-accent-fill" cx="90" cy="107" rx="20" ry="16" opacity="0.95" />
        <ellipse class="pet-body-shade" cx="72" cy="123" rx="10" ry="6.5" />
        <ellipse class="pet-body-shade" cx="108" cy="123" rx="10" ry="6.5" />
        <ellipse class="pet-accent-fill" cx="72" cy="124" rx="5.5" ry="3.2" opacity="0.9" />
        <ellipse class="pet-accent-fill" cx="108" cy="124" rx="5.5" ry="3.2" opacity="0.9" />
        <g class="arm-left">
          <ellipse class="pet-body-fill" cx="55" cy="98" rx="9.5" ry="11.5" transform="rotate(24 55 98)" stroke="#1e293b" stroke-opacity="0.1" stroke-width="1.2" />
          <circle class="pet-ear-inner" cx="53" cy="102" r="3" opacity="0.8" />
        </g>
        <g class="arm-right">
          <ellipse class="pet-body-fill" cx="125" cy="98" rx="9.5" ry="11.5" transform="rotate(-24 125 98)" stroke="#1e293b" stroke-opacity="0.1" stroke-width="1.2" />
          <circle class="pet-ear-inner" cx="127" cy="102" r="3" opacity="0.8" />
        </g>
        <path class="pet-collar-fill" d="M64 89 Q90 98 116 89 L114 95 Q90 104 66 95 Z" />
        <rect x="84" y="95" width="12" height="5" rx="2.5" fill="#fde047" stroke="#ca8a04" stroke-width="1.1" />
        <circle cx="84.5" cy="96" r="2.2" fill="#fde047" stroke="#ca8a04" stroke-width="0.9" />
        <circle cx="84.5" cy="99" r="2.2" fill="#fde047" stroke="#ca8a04" stroke-width="0.9" />
        <circle cx="95.5" cy="96" r="2.2" fill="#fde047" stroke="#ca8a04" stroke-width="0.9" />
        <circle cx="95.5" cy="99" r="2.2" fill="#fde047" stroke="#ca8a04" stroke-width="0.9" />
        <g class="ear-left">
          <ellipse class="pet-body-shade" cx="47" cy="64" rx="13" ry="24" transform="rotate(22 47 64)" />
        </g>
        <g class="ear-right">
          <ellipse class="pet-body-shade" cx="133" cy="64" rx="13" ry="24" transform="rotate(-22 133 64)" />
        </g>
        <ellipse class="pet-body-fill" cx="90" cy="66" rx="42" ry="34" />
        <path d="M62 42 Q90 32 118 42 Q105 51 90 51 Q75 51 62 42 Z" fill="url(#shineGrad)" />
        <ellipse class="pet-accent-fill" cx="73" cy="54" rx="4.5" ry="2.6" opacity="0.9" />
        <ellipse class="pet-accent-fill" cx="107" cy="54" rx="4.5" ry="2.6" opacity="0.9" />
        <ellipse class="pet-accent-fill" cx="90" cy="78" rx="22" ry="14.5" opacity="0.95" />
        <ellipse cx="62" cy="76" rx="5.5" ry="3" fill="#fb7185" opacity="0.52" />
        <ellipse cx="118" cy="76" rx="5.5" ry="3" fill="#fb7185" opacity="0.52" />
        <ellipse cx="90" cy="73" rx="6.2" ry="4.4" fill="#1e293b" />
        <ellipse cx="88" cy="71.6" rx="2" ry="1.1" fill="#ffffff" opacity="0.7" />
        <g class="eyes-normal">
          <ellipse cx="73" cy="65" rx="5.5" ry="6.5" fill="#1e293b" />
          <ellipse cx="107" cy="65" rx="5.5" ry="6.5" fill="#1e293b" />
          <circle cx="71" cy="62.5" r="2.2" fill="#ffffff" />
          <circle cx="105" cy="62.5" r="2.2" fill="#ffffff" />
        </g>
        <g class="eyes-thinking">
          <ellipse cx="75" cy="63" rx="5" ry="5.8" fill="#1e293b" />
          <ellipse cx="109" cy="63" rx="5" ry="5.8" fill="#1e293b" />
          <circle cx="76.5" cy="61" r="1.9" fill="#ffffff" />
          <circle cx="110.5" cy="61" r="1.9" fill="#ffffff" />
        </g>
        <g class="eyes-coding">
          <ellipse cx="73" cy="66" rx="5.2" ry="4.4" fill="#1e293b" />
          <ellipse cx="107" cy="66" rx="5.2" ry="4.4" fill="#1e293b" />
          <circle cx="72" cy="65" r="1.6" fill="#ffffff" />
          <circle cx="106" cy="65" r="1.6" fill="#ffffff" />
        </g>
        <g class="eyes-waiting">
          <circle cx="73" cy="64.5" r="6.6" fill="#1e293b" />
          <circle cx="107" cy="64.5" r="6.6" fill="#1e293b" />
          <circle cx="70.8" cy="62" r="2.6" fill="#ffffff" />
          <circle cx="104.8" cy="62" r="2.6" fill="#ffffff" />
        </g>
        <g class="eyes-success">
          <path d="M66 67 Q73 57 80 67" fill="none" stroke="#1e293b" stroke-width="3.6" stroke-linecap="round" />
          <path d="M100 67 Q107 57 114 67" fill="none" stroke="#1e293b" stroke-width="3.6" stroke-linecap="round" />
        </g>
        <path class="mouth-normal" d="M83 80 Q86.5 84.5 90 79.5 Q93.5 84.5 97 80" fill="none" stroke="#1e293b" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" />
        <circle class="mouth-thinking" cx="90" cy="82" r="2.4" fill="none" stroke="#1e293b" stroke-width="2" />
        <g class="mouth-waiting">
          <path d="M83 79.5 Q90 85 97 79.5" fill="none" stroke="#1e293b" stroke-width="2.2" stroke-linecap="round" />
          <path d="M86.5 82 Q90 92 93.5 82 Z" fill="#fb7185" stroke="#be123c" stroke-width="1" />
        </g>
        <g class="mouth-success">
          <path d="M81 79 Q90 86 99 79" fill="none" stroke="#1e293b" stroke-width="2.4" stroke-linecap="round" />
          <path d="M86 82 Q90 92 94 82 Z" fill="#fb7185" stroke="#be123c" stroke-width="1" />
        </g>
      `
    ),
  };

  window.PetCharacters = {
    getSvg(character: RendererCharacterType): string {
      return CHARACTERS[character] || CHARACTERS.cat;
    },
  };
})();
