"use client";

import { useCallback, useEffect, useState } from "react";

export function useCountdown(totalSeconds: number) {
  const [remaining, setRemaining] = useState(totalSeconds);
  const [running, setRunning] = useState(false);

  useEffect(() => {
    if (!running) return;
    const id = setInterval(() => {
      setRemaining((prev) => Math.max(0, prev - 1));
    }, 1000);
    return () => clearInterval(id);
  }, [running]);

  const start = useCallback(() => {
    setRemaining(totalSeconds);
    setRunning(true);
  }, [totalSeconds]);

  const stop = useCallback(() => setRunning(false), []);

  const reset = useCallback(() => {
    setRunning(false);
    setRemaining(totalSeconds);
  }, [totalSeconds]);

  return {
    remaining,
    running,
    elapsed: totalSeconds - remaining,
    expired: remaining === 0,
    ratio: totalSeconds > 0 ? 1 - remaining / totalSeconds : 0,
    start,
    stop,
    reset,
  };
}
