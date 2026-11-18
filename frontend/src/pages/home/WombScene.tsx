import { memo } from "react";
import wombFinal from "../../assets/womb-final.jpg";
import {
  FIRST_WEEK,
  LAST_WEEK,
  STAGE_WEEKS,
  lookup,
  trimesterOf,
  useDevelopment,
} from "./development";
import { WombSvg } from "./Fetus";
import { BarsIcon, HeartIcon, ReplayIcon } from "./icons";

// How the womb, the fetus and the counter change with `week`. Tables are [week, value].
const WOMB_SCALE = [
  [8, 0.5],
  [40, 1],
] as const; // the womb grows with the baby
const ART_IN = [
  [22, 0],
  [27, 1],
] as const; // the reference artwork fades in over weeks 22-27...
const SVG_OUT = [
  [24, 1],
  [29, 0],
] as const; // ...while the drawn stage fades out
const ART_BLUR = [
  [22, 5],
  [34, 0],
] as const; // and sharpens as the baby matures
const GLOW = [
  [8, 0.25],
  [40, 1],
] as const; // warm light inside the womb

// One heartbeat of an ECG trace: 50 units wide on a 30-unit-high strip (P wave, QRS spike, T wave).
// Six beats are drawn; the CSS scrolls exactly two beats per loop, so the trace never jumps.
const BEAT = "h12 q3 -6 6 0 h8 l2 2 l4 -17 l4 21 l2 -6 h4 q4 -6 8 0";
const ECG_PATH = `M0 15 ${`${BEAT} `.repeat(6)}`;

/** Fetal Heart Rate card. Decorative: the value is demo data, not a measurement. */
const HeartCard = memo(function HeartCard() {
  return (
    <div
      className="fcard heart-card"
      role="img"
      aria-label="Illustrative demo: fetal heart rate 146 beats per minute"
    >
      <div className="heart-top" aria-hidden="true">
        <div className="ecg">
          <svg viewBox="0 0 300 30" preserveAspectRatio="none">
            <path className="ecg-line" d={ECG_PATH} />
          </svg>
        </div>
        <HeartIcon className="heart-icon" />
      </div>
      <p className="heart-label">Fetal heart rate</p>
      <p className="heart-value">
        146 bpm<span className="demo-tag">demo</span>
      </p>
    </div>
  );
});

/** Risk status card. Decorative: it is not a real patient's assessment. */
const RiskCard = memo(function RiskCard() {
  return (
    <div className="fcard risk-card" role="img" aria-label="Illustrative demo: risk status low">
      <BarsIcon className="risk-icon" />
      <div>
        <p className="risk-label">Risk status</p>
        <p className="risk-value">
          <i className="pulse-dot" />
          Low
        </p>
      </div>
    </div>
  );
});

/** Current week, trimester and a clickable stage timeline; the Replay button re-runs the sequence. */
function WeekPill({
  week,
  playing,
  canReplay,
  onReplay,
  onGoTo,
}: {
  week: number;
  playing: boolean;
  canReplay: boolean;
  onReplay: () => void;
  onGoTo: (w: number) => void;
}) {
  const shown = Math.round(week);
  const first = FIRST_WEEK;
  const last = LAST_WEEK;
  const progress = ((week - first) / (last - first)) * 100;
  return (
    <div className="week-pill">
      <div className="week-head">
        <p className="week-now" aria-live="off">
          Week <b>{shown}</b>
          <span>{trimesterOf(week)}</span>
        </p>
        {canReplay ? (
          <button
            type="button"
            className="week-replay"
            onClick={onReplay}
            aria-label="Replay the pregnancy development animation"
            title="Replay"
          >
            <ReplayIcon className={playing ? "spin" : undefined} />
          </button>
        ) : null}
      </div>
      <div className="week-track">
        <i className="week-fill" style={{ width: `${progress}%` }} />
        {STAGE_WEEKS.map((w) => (
          <button
            key={w}
            type="button"
            className={`week-stop${week >= w - 0.01 ? " done" : ""}`}
            style={{ left: `${((w - first) / (last - first)) * 100}%` }}
            onClick={() => onGoTo(w)}
            aria-label={`Show week ${w}`}
          >
            <span>{w}</span>
          </button>
        ))}
      </div>
      <p className="week-note">Illustrative visualisation · demo data</p>
    </div>
  );
}

/** The right half of the hero: the womb, the developing fetus, the floating cards and the timeline. */
export function WombScene() {
  const { week, playing, reduced, replay, goTo } = useDevelopment();
  const scale = lookup(WOMB_SCALE, week);
  const artOpacity = lookup(ART_IN, week);
  const svgOpacity = lookup(SVG_OUT, week);

  return (
    <div className="stage">
      <div className="womb-float">
        <div className="womb" style={{ transform: `scale(${scale})` }}>
          <div className="womb-glow" style={{ opacity: lookup(GLOW, week) }} />
          <div style={{ opacity: svgOpacity }} className="womb-layer">
            {svgOpacity > 0 ? <WombSvg week={week} /> : null}
          </div>
          <img
            className="womb-art womb-layer"
            src={wombFinal}
            alt="Illustration of a baby in the womb"
            style={{
              opacity: artOpacity,
              filter: week < 34 ? `blur(${lookup(ART_BLUR, week).toFixed(2)}px)` : undefined,
            }}
          />
        </div>
      </div>
      <RiskCard />
      <HeartCard />
      <WeekPill
        week={week}
        playing={playing}
        canReplay={!reduced}
        onReplay={replay}
        onGoTo={goTo}
      />
    </div>
  );
}
