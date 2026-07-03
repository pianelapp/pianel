import { useLayoutEffect, useRef, useState, type CSSProperties, type RefObject } from "react";

const MARQUEE_END_OVERSHOOT = 40;
const MARQUEE_SPEED_PX_PER_SEC = 50;
const MARQUEE_MIN_SLIDE_MS = 1500;
const MARQUEE_SLIDE_RATIO = 0.7; // matches the 15%/85% holds in the @keyframes marquee-x

export const MARQUEE_MASK_IMAGE =
  "linear-gradient(to right, transparent 0%, black 3%, black 97%, transparent 100%)";

function computeMarqueeDuration(distancePx: number): number {
  const slideMs = Math.max(
    MARQUEE_MIN_SLIDE_MS,
    (distancePx / MARQUEE_SPEED_PX_PER_SEC) * 1000,
  );
  return slideMs / MARQUEE_SLIDE_RATIO;
}

export interface MarqueeResult {
  trackRef: RefObject<HTMLDivElement | null>;
  textRef: RefObject<HTMLSpanElement | null>;
  overflows: boolean;
  marqueeStyle: CSSProperties | undefined;
}

/**
 * Width-aware horizontal marquee. Attach `trackRef` to the clipping container
 * and `textRef` to the inner text. A `ResizeObserver` watches both elements,
 * so changes from content updates, container resizes, or async font loads all
 * trigger a re-measure without a dependency array.
 *
 * When the text overflows the track, `marqueeStyle` exposes the
 * `--marquee-distance` and `--marquee-duration` custom properties consumed by
 * the `.animate-marquee-x` class in `global.css`.
 */
export function useMarquee(): MarqueeResult {
  const trackRef = useRef<HTMLDivElement>(null);
  const textRef = useRef<HTMLSpanElement>(null);
  const [overflow, setOverflow] = useState(0);

  useLayoutEffect(() => {
    const track = trackRef.current;
    const text = textRef.current;
    if (!track || !text) return;

    const measure = () => {
      const t = textRef.current;
      const c = trackRef.current;
      if (!t || !c) return;
      const diff =
        t.getBoundingClientRect().width - c.getBoundingClientRect().width;
      setOverflow(diff > 0.5 ? diff : 0);
    };

    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(track);
    ro.observe(text);
    return () => ro.disconnect();
  }, []);

  const overflows = overflow > 0;
  const marqueeStyle: CSSProperties | undefined = overflows
    ? ({
        ["--marquee-distance" as string]: `-${overflow + MARQUEE_END_OVERSHOOT}px`,
        ["--marquee-duration" as string]: `${Math.round(
          computeMarqueeDuration(overflow + MARQUEE_END_OVERSHOOT),
        )}ms`,
      } as CSSProperties)
    : undefined;

  return { trackRef, textRef, overflows, marqueeStyle };
}
