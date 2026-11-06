import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import { COLLECTIVE_DURATION } from "../model/collective";
import { COLLECTIVE_INTRO_DURATION } from "../model/collectiveIntro";

const PLAYBACK_RATE = 0.1;

/** Owns the separate introduction/model clocks and the responsive playback view. */
export function useCollectivePlayback(
  theorem: 2 | 3,
  spatialView: "2d" | "3d",
) {
  const [time, setTime] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [playbackOpen, setPlaybackOpen] = useState(false);
  const [introProgress, setIntroProgress] = useState(theorem === 2 ? 1 : 0);
  const introElapsed = useRef(theorem === 2 ? COLLECTIVE_INTRO_DURATION : 0);
  const setIntro = useCallback(
    (progress: number) => {
      // T2 always shows Q directly; only T3 has an explanatory terrain morph.
      const nextProgress = theorem === 2 ? 1 : progress;
      introElapsed.current = nextProgress * COLLECTIVE_INTRO_DURATION;
      setIntroProgress(nextProgress);
    },
    [theorem],
  );
  const [compactLayout, setCompactLayout] = useState(
    () => window.matchMedia("(max-width: 760px)").matches,
  );
  useEffect(() => {
    const media = window.matchMedia("(max-width: 760px)");
    const update = () => {
      setCompactLayout(media.matches);
      // Move playback back to the page without interrupting its clock.
      if (media.matches) setPlaybackOpen(false);
    };
    update();
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, []);
  useEffect(() => {
    // A popup can transfer to an inline 2D view midway through its intro.
    // Finish only the hidden illustration; preserve playback and model time.
    if (compactLayout && spatialView === "2d") setIntro(1);
  }, [compactLayout, spatialView, setIntro]);

  const animationFrame = useRef<number | null>(null);
  const animationGeneration = useRef(0);
  const cancelAnimation = useCallback(() => {
    animationGeneration.current += 1;
    if (animationFrame.current !== null) {
      cancelAnimationFrame(animationFrame.current);
      animationFrame.current = null;
    }
  }, []);
  const stop = useCallback(() => {
    cancelAnimation();
    setPlaying(false);
  }, [cancelAnimation]);
  const reset = useCallback(() => {
    stop();
    setTime(0);
    setIntro(0);
  }, [stop, setIntro]);

  useLayoutEffect(() => {
    reset();
    setPlaybackOpen(false);
  }, [theorem, reset]);
  useEffect(() => {
    if (!playing) return;
    const generation = ++animationGeneration.current;
    let previous: number | null = null;
    const tick = (now: number) => {
      if (generation !== animationGeneration.current) return;
      if (previous !== null) {
        let delta = Math.min((now - previous) / 1000, 0.1);
        // The explanatory morph has its own clock; no model time or force changes.
        if (introElapsed.current < COLLECTIVE_INTRO_DURATION) {
          const consumed = Math.min(
            delta,
            COLLECTIVE_INTRO_DURATION - introElapsed.current,
          );
          introElapsed.current += consumed;
          setIntroProgress(introElapsed.current / COLLECTIVE_INTRO_DURATION);
          delta -= consumed;
        }
        if (delta > 0)
          setTime((t) =>
            generation === animationGeneration.current
              ? Math.min(COLLECTIVE_DURATION, t + delta * PLAYBACK_RATE)
              : t,
          );
      }
      previous = now;
      animationFrame.current = requestAnimationFrame(tick);
    };
    animationFrame.current = requestAnimationFrame(tick);
    return () => {
      if (generation === animationGeneration.current) cancelAnimation();
    };
  }, [playing, cancelAnimation]);
  useEffect(() => {
    if (time >= COLLECTIVE_DURATION) stop();
  }, [time, stop]);

  const togglePlayback = () => {
    if (playing) stop();
    else {
      if (time >= COLLECTIVE_DURATION) {
        setTime(0);
        setIntro(0);
      }
      if (compactLayout && spatialView === "2d") setIntro(1);
      setPlaybackOpen(!compactLayout);
      setPlaying(true);
    }
  };
  const seek = (nextTime: number) => {
    stop();
    setTime(nextTime);
    setIntro(nextTime > 0 ? 1 : 0);
  };
  const closePlayback = () => {
    stop();
    setPlaybackOpen(false);
  };
  const skipIntro = () => setIntro(1);
  const restoreIntro = () => {
    if (time === 0) setIntro(0);
  };
  const scrubIntro = (progress: number) => {
    stop();
    setTime(0);
    setIntro(progress);
  };
  const replayIntro = () => {
    setTime(0);
    setIntro(0);
    setPlaying(true);
  };

  return {
    time,
    playing,
    playbackOpen,
    compactLayout,
    introProgress,
    playbackRate: PLAYBACK_RATE,
    togglePlayback,
    seek,
    reset,
    closePlayback,
    skipIntro,
    restoreIntro,
    scrubIntro,
    replayIntro,
  };
}
