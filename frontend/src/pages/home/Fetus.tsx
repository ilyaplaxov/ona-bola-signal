import { lookup } from "./development";

// Weeks 8-24 of the hero animation: a soft, stylised womb and fetus drawn in SVG. The pose is the
// same one as the reference artwork (womb-final.jpg takes over from week ~24), so the early stages
// grow into it instead of swapping to something unrelated. All coordinates are in the 500 x 520
// space of womb-final.jpg.
//
// Each body part is driven by a small keyframe table (week -> value). An early embryo differs from
// a later fetus in more than size: the head is proportionally huge, the limbs are buds, the body is
// tightly curled, and there is no face yet.

type Pt = readonly [number, number];
type Table = readonly (readonly [number, number])[];

const SCALE: Table = [
  [8, 0.3],
  [12, 0.45],
  [16, 0.62],
  [20, 0.82],
  [24, 1],
]; // whole fetus
const HEAD: Table = [
  [8, 1.8],
  [12, 1.5],
  [16, 1.28],
  [20, 1.1],
  [24, 1],
]; // head vs body
const LIMB: Table = [
  [8, 0.32],
  [12, 0.6],
  [16, 0.8],
  [20, 0.93],
  [24, 1],
]; // limb length
const CURL: Table = [
  [8, 42],
  [12, 28],
  [16, 16],
  [20, 6],
  [24, 0],
]; // legs folded up, degrees
const FACE: Table = [
  [8, 0],
  [13, 0],
  [18, 1],
]; // ear, eye, nose and mouth fade in
const SOFT: Table = [
  [8, 3.2],
  [12, 2.4],
  [16, 1.6],
  [20, 1.1],
  [24, 0.8],
]; // blur, in womb units
const YOLK: Table = [
  [8, 1],
  [11.5, 0],
]; // yolk sac, only the first weeks

const PIVOT: Pt = [265, 268];
const NECK: Pt = [318, 228];
const SHOULDER: Pt = [365, 268];
const HIP: Pt = [300, 346];

const at = (p: Pt, o: Pt, f: number): Pt => [o[0] + (p[0] - o[0]) * f, o[1] + (p[1] - o[1]) * f];
const rot = (p: Pt, o: Pt, deg: number): Pt => {
  const a = (deg * Math.PI) / 180;
  const dx = p[0] - o[0];
  const dy = p[1] - o[1];
  return [o[0] + dx * Math.cos(a) - dy * Math.sin(a), o[1] + dx * Math.sin(a) + dy * Math.cos(a)];
};
const xy = (p: Pt) => `${p[0].toFixed(1)} ${p[1].toFixed(1)}`;

/** A tapered limb segment from `a` (radius ra) to `b` (radius rb), with round ends. */
function capsule(a: Pt, b: Pt, ra: number, rb: number): string {
  const len = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1;
  const nx = -(b[1] - a[1]) / len;
  const ny = (b[0] - a[0]) / len;
  const side = (c: Pt, r: number, s: number): Pt => [c[0] + nx * r * s, c[1] + ny * r * s];
  return `M${xy(side(a, ra, 1))} L${xy(side(b, rb, 1))} A${rb} ${rb} 0 0 0 ${xy(side(b, rb, -1))} L${xy(side(a, ra, -1))} A${ra} ${ra} 0 0 0 ${xy(side(a, ra, 1))}Z`;
}

function Fetus({ week }: { week: number }) {
  const k = lookup(SCALE, week);
  const head = lookup(HEAD, week);
  const limb = lookup(LIMB, week);
  const curl = lookup(CURL, week);
  const face = lookup(FACE, week);
  const soft = lookup(SOFT, week);
  const yolk = lookup(YOLK, week);
  const bulk = 0.6 + 0.4 * limb; // limbs get thicker as they get longer

  // Legs: hip -> knee -> ankle, shortened by `limb` and folded up by `curl` around the hip.
  const leg = (hip: Pt, knee0: Pt, ankle0: Pt) => ({
    hip,
    knee: rot(at(knee0, hip, limb), hip, curl),
    ankle: rot(at(ankle0, hip, limb), hip, curl * 1.25),
  });
  const front = leg(HIP, [180, 302], [96, 372]);
  const back = leg([312, 356], [204, 322], [124, 386]);
  // Arm: shoulder -> elbow -> hand, reaching up to the chin as the fetus matures.
  const elbow = at([300, 330], SHOULDER, limb);
  const hand = at([258, 252], SHOULDER, 0.55 + 0.45 * limb);
  const headAnchor = `translate(${NECK[0]} ${NECK[1]}) scale(${head}) translate(${-NECK[0]} ${-NECK[1]})`;

  const body = (
    <g>
      {/* umbilical cord, behind the body */}
      <path
        d="M262 306 C 222 300 196 262 160 244 C 128 230 108 262 118 304"
        fill="none"
        stroke="#f3957f"
        strokeWidth={9}
        strokeLinecap="round"
        opacity={0.85}
      />
      {/* far leg, in shade */}
      <path d={capsule(back.hip, back.knee, 28 * bulk, 20 * bulk)} fill="#e28e78" />
      <path d={capsule(back.knee, back.ankle, 19 * bulk, 11 * bulk)} fill="#e28e78" />
      {/* torso */}
      <path
        d="M288 232 C 320 214 372 212 396 240 C 426 272 424 330 392 360 C 362 386 312 376 282 358 C 250 340 232 312 246 280 C 252 262 268 244 288 232 Z"
        fill="url(#fetus-skin)"
      />
      {/* near leg: thigh, shin, foot */}
      <path d={capsule(front.hip, front.knee, 36 * bulk, 25 * bulk)} fill="url(#fetus-skin)" />
      <path d={capsule(front.knee, front.ankle, 23 * bulk, 13 * bulk)} fill="url(#fetus-skin)" />
      <ellipse
        cx={front.ankle[0] - 8}
        cy={front.ankle[1] + 6}
        rx={29 * bulk}
        ry={13 * bulk}
        transform={`rotate(24 ${front.ankle[0]} ${front.ankle[1]})`}
        fill="url(#fetus-skin)"
      />
      {/* arm and hand */}
      <path d={capsule(SHOULDER, elbow, 21 * bulk, 15 * bulk)} fill="url(#fetus-skin)" />
      <path d={capsule(elbow, hand, 15 * bulk, 12 * bulk)} fill="url(#fetus-skin)" />
      <ellipse
        cx={hand[0]}
        cy={hand[1] - 2}
        rx={24 * bulk}
        ry={18 * bulk}
        fill="url(#fetus-skin)"
      />
      {/* head, larger in proportion early on, anchored at the neck */}
      <g transform={headAnchor}>
        <ellipse
          cx={325}
          cy={135}
          rx={86}
          ry={90}
          transform="rotate(-12 325 135)"
          fill="url(#fetus-skin)"
        />
        <ellipse
          cx={294}
          cy={196}
          rx={50}
          ry={44}
          transform="rotate(-24 294 196)"
          fill="url(#fetus-skin)"
        />
        <ellipse cx={353} cy={170} rx={12} ry={17} fill="#f0a283" opacity={face} />
        <g opacity={face} fill="none" stroke="#b9635a" strokeLinecap="round">
          <path d="M270 192 q10 7 22 0" strokeWidth={2.4} />
          <path d="M256 208 q-4 8 4 12" strokeWidth={2} opacity={0.7} />
          <path d="M262 236 q8 5 16 1" strokeWidth={2.2} />
        </g>
      </g>
      {/* yolk sac: only visible in the first weeks */}
      <circle cx={352} cy={330} r={18} fill="#f8dca8" opacity={yolk * 0.9} />
    </g>
  );

  return (
    <g
      transform={`translate(${PIVOT[0]} ${PIVOT[1]}) scale(${k}) translate(${-PIVOT[0]} ${-PIVOT[1]})`}
    >
      <defs>
        <g id="fetus-body">{body}</g>
      </defs>
      {/* the body is only drawn through these two copies, so no sharp edge shows through the blur */}
      <use href="#fetus-body" filter="url(#fetus-glow)" opacity={0.6} />
      <use
        href="#fetus-body"
        filter={`url(#fetus-blur-${soft > 2 ? "hi" : soft > 1.2 ? "mid" : "lo"})`}
      />
    </g>
  );
}

/** The womb membrane (the same ellipse as the artwork) with the fetus inside it. */
export function WombSvg({ week }: { week: number }) {
  return (
    <svg className="womb-svg" viewBox="0 0 500 520" aria-hidden="true">
      <defs>
        <radialGradient id="womb-fill" cx="0.42" cy="0.6" r="0.72">
          <stop offset="0" stopColor="#fbd2bd" />
          <stop offset="0.5" stopColor="#f2a597" />
          <stop offset="0.85" stopColor="#da7b82" />
          <stop offset="1" stopColor="#c7677a" />
        </radialGradient>
        <radialGradient id="womb-core" cx="0.5" cy="0.5" r="0.5">
          <stop offset="0" stopColor="#ffe2cf" stopOpacity="0.85" />
          <stop offset="1" stopColor="#ffe2cf" stopOpacity="0" />
        </radialGradient>
        <linearGradient id="womb-rim" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#fff" stopOpacity="0.95" />
          <stop offset="0.5" stopColor="#fbd9d2" stopOpacity="0.3" />
          <stop offset="1" stopColor="#fff" stopOpacity="0" />
        </linearGradient>
        {/* one gradient in womb space so every body part is lit from the upper left */}
        <radialGradient id="fetus-skin" gradientUnits="userSpaceOnUse" cx="270" cy="200" r="260">
          <stop offset="0" stopColor="#ffd9b8" />
          <stop offset="0.5" stopColor="#f8b58c" />
          <stop offset="1" stopColor="#e8907a" />
        </radialGradient>
        <filter id="fetus-blur-hi" x="-30%" y="-30%" width="160%" height="160%">
          <feGaussianBlur stdDeviation="3.4" />
        </filter>
        <filter id="fetus-blur-mid" x="-30%" y="-30%" width="160%" height="160%">
          <feGaussianBlur stdDeviation="1.8" />
        </filter>
        <filter id="fetus-blur-lo" x="-30%" y="-30%" width="160%" height="160%">
          <feGaussianBlur stdDeviation="0.9" />
        </filter>
        <filter id="fetus-glow" x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="14" />
        </filter>
        <filter id="womb-halo" x="-30%" y="-30%" width="160%" height="160%">
          <feGaussianBlur stdDeviation="20" />
        </filter>
        <filter id="womb-soft" x="-10%" y="-10%" width="120%" height="120%">
          <feGaussianBlur stdDeviation="1.6" />
        </filter>
        <filter id="vein-blur">
          <feGaussianBlur stdDeviation="0.8" />
        </filter>
      </defs>
      <g transform="rotate(28 258 250)">
        <ellipse
          cx={258}
          cy={250}
          rx={224}
          ry={254}
          fill="#f7cfc6"
          opacity={0.5}
          filter="url(#womb-halo)"
        />
        <ellipse
          cx={258}
          cy={250}
          rx={200}
          ry={230}
          fill="url(#womb-fill)"
          opacity={0.86}
          filter="url(#womb-soft)"
        />
        <ellipse cx={236} cy={282} rx={150} ry={176} fill="url(#womb-core)" />
        <ellipse
          cx={258}
          cy={250}
          rx={198}
          ry={228}
          fill="none"
          stroke="url(#womb-rim)"
          strokeWidth={6}
          opacity={0.9}
          filter="url(#womb-soft)"
        />
      </g>
      <g fill="none" stroke="#f9a58f" strokeLinecap="round" opacity={0.5} filter="url(#vein-blur)">
        <path d="M122 160 C 150 196 190 208 216 252" strokeWidth={2.6} />
        <path d="M176 108 C 188 160 206 194 216 252" strokeWidth={2.2} />
        <path d="M108 236 C 150 238 186 246 216 252" strokeWidth={2.2} />
        <path d="M216 252 C 236 272 248 292 262 306" strokeWidth={3} />
        <path d="M150 140 C 168 150 186 150 200 168" strokeWidth={1.4} />
        <path d="M232 120 C 226 150 222 176 216 252" strokeWidth={1.4} />
      </g>
      <Fetus week={week} />
    </svg>
  );
}
