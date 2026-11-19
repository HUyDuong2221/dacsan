export default function HeroBg() {
  return (
    <svg className="d-hero-bg" viewBox="0 0 1440 520" preserveAspectRatio="xMidYMax slice" aria-hidden="true" focusable="false">
      <defs>
        <linearGradient id="hbSky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#7DBDEB"/><stop offset="0.55" stopColor="#C4E2F7"/><stop offset="1" stopColor="#EAF5FC"/></linearGradient>
        <linearGradient id="hbRiver" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#8CC3E8"/><stop offset="1" stopColor="#4A8BC8"/></linearGradient>
        <linearGradient id="hbGold" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#F6D57C"/><stop offset="1" stopColor="#D99A2B"/></linearGradient>
      </defs>
      <rect width="1440" height="520" fill="url(#hbSky)"/>
      <circle cx="1190" cy="150" r="92" fill="#FFF7DC" opacity="0.75"/>
      <g fill="#FFFFFF" opacity="0.7">
        <ellipse cx="330" cy="92" rx="110" ry="17"/>
        <ellipse cx="420" cy="80" rx="70" ry="15"/>
        <ellipse cx="860" cy="62" rx="130" ry="19"/>
      </g>
      <path d="M0 300 L120 230 L210 262 L300 200 L420 270 L520 240 L640 300 L760 275 L880 305 L1000 262 L1120 290 L1260 230 L1440 280 L1440 380 L0 380Z" fill="#A9CCEA" opacity="0.85"/>
      <path d="M0 336 L150 290 L290 325 L430 294 L580 334 L720 304 L870 338 L1020 310 L1180 334 L1330 304 L1440 324 L1440 390 L0 390Z" fill="#8DB9E0"/>
      <g fill="#6FA6D6" opacity="0.8">
        <rect x="10" y="300" width="34" height="90"/><rect x="52" y="322" width="26" height="68"/>
        <rect x="86" y="280" width="40" height="110"/><rect x="134" y="312" width="30" height="78"/>
        <rect x="172" y="262" width="36" height="128"/><rect x="216" y="302" width="28" height="88"/>
        <rect x="252" y="332" width="40" height="58"/>
      </g>
      <g fill="#5E9BD0" opacity="0.85">
        <rect x="1010" y="300" width="30" height="90"/><rect x="1046" y="250" width="36" height="140"/>
        <rect x="1090" y="285" width="28" height="105"/><rect x="1124" y="222" width="34" height="168"/>
        <rect x="1165" y="270" width="30" height="120"/><rect x="1202" y="310" width="26" height="80"/>
        <rect x="1234" y="290" width="32" height="100"/>
      </g>
      <rect x="0" y="384" width="1440" height="136" fill="url(#hbRiver)"/>
      <g stroke="#FFFFFF" strokeOpacity="0.38" strokeWidth="2" fill="none">
        <line x1="90" y1="410" x2="300" y2="410"/><line x1="360" y1="432" x2="520" y2="432"/>
        <line x1="60" y1="462" x2="250" y2="462"/><line x1="560" y1="470" x2="780" y2="470"/>
        <line x1="820" y1="415" x2="960" y2="415"/><line x1="1000" y1="446" x2="1300" y2="446"/>
      </g>
      <path d="M600 378 L1440 378" stroke="url(#hbGold)" strokeWidth="10" fill="none"/>
      <path d="M1040 378 L1040 236 L1051 236 L1051 378Z" fill="url(#hbGold)"/>
      <path d="M1330 378 L1330 226 L1341 226 L1341 378Z" fill="url(#hbGold)"/>
      <path d="M1040 378 Q1185 236 1330 378" fill="none" stroke="url(#hbGold)" strokeWidth="5"/>
      <g stroke="#E8B54E" strokeWidth="1.2" opacity="0.85">
        <line x1="1046" y1="240" x2="960" y2="378"/><line x1="1046" y1="240" x2="1000" y2="378"/>
        <line x1="1046" y1="240" x2="1110" y2="378"/><line x1="1046" y1="240" x2="1150" y2="378"/>
        <line x1="1335" y1="230" x2="1260" y2="378"/><line x1="1335" y1="230" x2="1300" y2="378"/>
        <line x1="1335" y1="230" x2="1370" y2="378"/><line x1="1335" y1="230" x2="1420" y2="378"/>
      </g>
      <g fill="#F3CB6A" opacity="0.35">
        <rect x="1038" y="392" width="8" height="60"/><rect x="1328" y="392" width="8" height="60"/>
      </g>
      <path d="M1440 292 Q1418 282 1408 300 Q1400 318 1414 326 L1440 330Z" fill="url(#hbGold)"/>
    </svg>
  );
}
