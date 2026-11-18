import type { CSSProperties } from "react";

// Decorative hero background, drawn on the same 1536 x 660 grid as the reference: the pale body
// silhouette behind the womb, flowing sage waves, a soft pink light and a few slow particles.
// Everything drifts very slowly (CSS keyframes in home.css) and is hidden from assistive tech.

// [x, y, radius, delay s, duration s] - fixed positions keep the render deterministic
const PARTICLES: readonly (readonly [number, number, number, number, number])[] = [
  [1010, 520, 3, 0, 15],
  [1190, 600, 2.4, 3, 18],
  [1330, 560, 3.2, 6, 16],
  [880, 430, 2.2, 2, 19],
  [1450, 470, 2.6, 8, 17],
  [960, 590, 2, 5, 21],
  [1255, 120, 2.4, 1, 20],
  [1060, 90, 2, 9, 22],
  [180, 560, 2.6, 4, 18],
  [380, 600, 2, 7, 20],
];

export function Backdrop() {
  return (
    <div className="backdrop" aria-hidden="true">
      <svg viewBox="0 0 1536 700" preserveAspectRatio="xMidYMin slice">
        {/* Gradients are in user space so the shapes can bleed past the 1536 edges without changing colour. */}
        <defs>
          <linearGradient
            id="bd-body"
            gradientUnits="userSpaceOnUse"
            x1="890"
            y1="0"
            x2="1536"
            y2="660"
          >
            <stop offset="0" stopColor="#efe9e2" />
            <stop offset="1" stopColor="#dfe6dd" />
          </linearGradient>
          <linearGradient
            id="bd-sage"
            gradientUnits="userSpaceOnUse"
            x1="1332"
            y1="96"
            x2="1536"
            y2="620"
          >
            <stop offset="0" stopColor="#c3d9ca" />
            <stop offset="1" stopColor="#8db4a1" />
          </linearGradient>
          <linearGradient id="bd-wave" gradientUnits="userSpaceOnUse" x1="0" y1="0" x2="526" y2="0">
            <stop offset="0" stopColor="#b9d8c5" />
            <stop offset="1" stopColor="#e9f2e8" />
          </linearGradient>
          <linearGradient id="bd-fade" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#fcf7f1" stopOpacity="0" />
            <stop offset="1" stopColor="#fcf7f1" />
          </linearGradient>
          <linearGradient id="bd-ribbon" x1="0" y1="1" x2="1" y2="0">
            <stop offset="0" stopColor="#ffffff" stopOpacity="0" />
            <stop offset="0.5" stopColor="#ffffff" stopOpacity="0.85" />
            <stop offset="1" stopColor="#cfe3d6" stopOpacity="0.2" />
          </linearGradient>
          <radialGradient id="bd-light" cx="0.5" cy="0.5" r="0.5">
            <stop offset="0" stopColor="#e9b5a6" stopOpacity="0.55" />
            <stop offset="1" stopColor="#e9b5a6" stopOpacity="0" />
          </radialGradient>
          <filter id="bd-soft" x="-10%" y="-10%" width="120%" height="120%">
            <feGaussianBlur stdDeviation="6" />
          </filter>
        </defs>

        <circle className="bd-light" cx="1128" cy="350" r="360" fill="url(#bd-light)" />

        <g className="bd-drift a">
          <path
            d="M1040 0C1062 70 1126 108 1104 170 1060 192 906 300 892 430c-6 90 40 160 108 230H3000V0Z"
            fill="url(#bd-body)"
            opacity="0.85"
          />
        </g>
        <g className="bd-drift b">
          <path
            d="M1404 96C1480 140 1536 150 1536 150C1700 156 1900 110 2300 -20V690C1900 700 1700 660 1536 610C1452 620 1384 566 1332 474 1290 384 1340 300 1380 232 1412 180 1384 134 1404 96Z"
            fill="url(#bd-sage)"
            opacity="0.5"
          />
        </g>
        <g className="bd-drift c" filter="url(#bd-soft)">
          <path
            d="M826 472C954 566 1156 586 1304 444 1384 366 1410 304 1536 282"
            fill="none"
            stroke="url(#bd-ribbon)"
            strokeWidth="34"
            strokeLinecap="round"
            opacity="0.7"
          />
          <path
            d="M1062 604C1204 566 1306 504 1366 380"
            fill="none"
            stroke="url(#bd-ribbon)"
            strokeWidth="14"
            strokeLinecap="round"
            opacity="0.6"
          />
        </g>
        <g className="bd-drift d">
          <path
            d="M-1400 590C-1000 540 -500 482 0 468C84 436 174 478 262 520 344 558 424 570 526 602L-1400 680Z"
            fill="url(#bd-wave)"
            opacity="0.7"
          />
          <path
            d="M-1400 640C-900 590 -400 540 0 524C124 504 206 564 336 594L-1400 690Z"
            fill="#e1eee3"
            opacity="0.85"
          />
          <path
            d="M0 440C110 420 214 470 300 520"
            fill="none"
            stroke="#cfe3d6"
            strokeWidth="2"
            opacity="0.7"
          />
        </g>

        {/* fades the waves into the page colour at the bottom edge */}
        <rect x="-1400" y="540" width="4400" height="160" fill="url(#bd-fade)" />

        {PARTICLES.map(([x, y, r, delay, dur]) => (
          <circle
            key={`${x}-${y}`}
            className="bd-particle"
            cx={x}
            cy={y}
            r={r}
            style={{ animationDelay: `${delay}s`, animationDuration: `${dur}s` } as CSSProperties}
          />
        ))}
      </svg>
    </div>
  );
}
