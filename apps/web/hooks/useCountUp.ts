'use client';

import { useEffect, useRef, useState } from 'react';

export function useCountUp(target: number, duration = 1.1): number {
  const [value, setValue]   = useState(0);
  const frameRef            = useRef<number>(0);
  const startRef            = useRef<number | null>(null);
  const prevTargetRef       = useRef(0);

  useEffect(() => {
    if (target === prevTargetRef.current) return;
    prevTargetRef.current = target;

    startRef.current = null;
    const from = value;

    const tick = (ts: number) => {
      if (startRef.current === null) startRef.current = ts;
      const t = Math.min((ts - startRef.current) / (duration * 1000), 1);
      // easeOutExpo — fast start, gentle landing
      const eased = t === 1 ? 1 : 1 - Math.pow(2, -10 * t);
      setValue(Math.round(from + (target - from) * eased));
      if (t < 1) frameRef.current = requestAnimationFrame(tick);
    };

    frameRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frameRef.current);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [target, duration]);

  return value;
}
