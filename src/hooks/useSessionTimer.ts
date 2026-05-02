// hooks/useSessionTimer.ts
'use client';

import { useState, useEffect, useRef, useCallback } from 'react';

interface UseSessionTimerReturn {
  elapsed:   number; // seconds elapsed
  remaining: number; // seconds remaining
  formatted: string; // "MM:SS"
  isExpired: boolean;
  start:     () => void;
  reset:     () => void;
}

export function useSessionTimer(durationSec = 900): UseSessionTimerReturn {
  const [elapsed, setElapsed] = useState(0);
  const [running, setRunning] = useState(false);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  const start = useCallback(() => setRunning(true), []);
  const reset = useCallback(() => {
    setRunning(false);
    setElapsed(0);
    if (intervalRef.current) clearInterval(intervalRef.current);
  }, []);

  useEffect(() => {
    if (!running) return;

    intervalRef.current = setInterval(() => {
      setElapsed((e) => e + 1);
    }, 1000);

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [running]);

  const remaining = Math.max(0, durationSec - elapsed);
  const isExpired = remaining === 0;

  const minutes = Math.floor(remaining / 60).toString().padStart(2, '0');
  const seconds = (remaining % 60).toString().padStart(2, '0');

  return { elapsed, remaining, formatted: `${minutes}:${seconds}`, isExpired, start, reset };
}
