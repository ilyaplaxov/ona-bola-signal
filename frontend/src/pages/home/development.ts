import { useCallback, useEffect, useRef, useState } from "react";

// The pregnancy-development sequence on the Home Page hero.
// One number drives everything: `week` (a float between 8 and 40). The womb, the fetus, the week
// counter and the timeline all read it, so they cannot drift out of sync.

type Point = readonly [number, number];

// [week, seconds into the sequence]: when the counter reaches each stage. The whole sequence is
// 22 s, slower through the early weeks where the fetus changes shape the most.
const TIMELINE: readonly Point[] = [
  [8, 0],
  [12, 3.4],
  [16, 7],
  [20, 10.8],
  [28, 15.4],
  [36, 19],
  [40, 22],
];
export const STAGE_WEEKS: readonly number[] = TIMELINE.map(([week]) => week);
export const FIRST_WEEK = 8;
export const LAST_WEEK = 40;
export const SEQUENCE_SECONDS = 22;

const easeInOut = (u: number) => 0.5 - 0.5 * Math.cos(Math.PI * u);

/** Piecewise-linear lookup in a [week, value] table; clamps outside the table. */
export function lookup(table: readonly Point[], week: number): number {
  let prev: Point | undefined;
  for (const point of table) {
    if (week <= point[0]) {
      if (!prev) return point[1];
      return prev[1] + ((point[1] - prev[1]) * (week - prev[0])) / (point[0] - prev[0]);
    }
    prev = point;
  }
  return prev ? prev[1] : 0;
}

/** Week counter for `seconds` into the sequence: eased between stages, so it settles on each one. */
export function weekAt(seconds: number): number {
  let prev: Point | undefined;
  for (const point of TIMELINE) {
    if (prev && seconds <= point[1]) {
      const u = Math.max((seconds - prev[1]) / (point[1] - prev[1]), 0);
      return prev[0] + (point[0] - prev[0]) * easeInOut(u);
    }
    prev = point;
  }
  return LAST_WEEK;
}

export function trimesterOf(week: number): string {
  if (week < 14) return "1st trimester";
  if (week < 28) return "2nd trimester";
  return "3rd trimester";
}

export function usePrefersReducedMotion(): boolean {
  const [reduced, setReduced] = useState(
    () => window.matchMedia("(prefers-reduced-motion: reduce)").matches,
  );
  useEffect(() => {
    const query = window.matchMedia("(prefers-reduced-motion: reduce)");
    const onChange = () => setReduced(query.matches);
    query.addEventListener("change", onChange);
    return () => query.removeEventListener("change", onChange);
  }, []);
  return reduced;
}

// The sequence plays once per page load: coming back to Home from the dashboard shows the final
// stage. The Replay button is the only way to run it again.
let played = false;

export function useDevelopment() {
  const reduced = usePrefersReducedMotion();
  const [week, setWeek] = useState(played || reduced ? LAST_WEEK : FIRST_WEEK);
  const [playing, setPlaying] = useState(false);
  const weekRef = useRef(week);
  const frame = useRef(0);

  /** Runs `weekFor(secondsElapsed)` for `duration` seconds, one render per animation frame. */
  const run = useCallback(
    (weekFor: (seconds: number) => number, duration: number, markPlayed: boolean) => {
      cancelAnimationFrame(frame.current);
      setPlaying(true);
      // Time advances only by frames that were really drawn (each step capped at 100 ms). A hidden
      // tab pauses requestAnimationFrame while the clock keeps running; measuring against the clock
      // would skip the whole sequence the moment the tab is shown. This pauses and resumes instead.
      let seconds = 0;
      let last: number | undefined;
      const tick = (now: number) => {
        if (last !== undefined)
          seconds = Math.min(seconds + Math.min((now - last) / 1000, 0.1), duration);
        last = now;
        weekRef.current = weekFor(seconds);
        setWeek(weekRef.current);
        if (seconds < duration) {
          frame.current = requestAnimationFrame(tick);
        } else {
          setPlaying(false);
          if (markPlayed) played = true;
        }
      };
      frame.current = requestAnimationFrame(tick);
    },
    [],
  );

  const replay = useCallback(() => {
    if (reduced) return;
    run(weekAt, SEQUENCE_SECONDS, true);
  }, [reduced, run]);

  /** Manual navigation: glide from the current week to `target` (a stage on the timeline). */
  const goTo = useCallback(
    (target: number) => {
      const from = weekRef.current;
      if (reduced) {
        weekRef.current = target;
        setWeek(target);
        return;
      }
      const duration = Math.min(2.4, 0.6 + Math.abs(target - from) * 0.06);
      run((s) => from + (target - from) * easeInOut(s / duration), duration, true);
    },
    [reduced, run],
  );

  useEffect(() => {
    if (!played && !reduced) run(weekAt, SEQUENCE_SECONDS, true);
    return () => cancelAnimationFrame(frame.current); // also covers StrictMode's double mount
  }, [reduced, run]);

  return { week, playing, reduced, replay, goTo };
}
