import { useEffect, useRef, useCallback } from 'react';

interface KeystrokeTiming {
  key: string;
  timestamp: number;
  dwellMs: number;
}

interface PasteEvent {
  timestamp: number;
  length: number;
}

interface FocusEvent {
  type: 'blur' | 'focus';
  timestamp: number;
}

interface MousePosition {
  x: number;
  y: number;
  timestamp: number;
}

interface BehavioralSignals {
  keystrokeTimings: KeystrokeTiming[];
  pasteEvents: PasteEvent[];
  focusEvents: FocusEvent[];
  mousePositions: MousePosition[];
  responseTimings: { questionNumber: number; startedAt: number; answeredAt?: number }[];
}

interface UseBehavioralTrackingOptions {
  token: string;
  enabled?: boolean;
  flushIntervalMs?: number;
}

const FLUSH_INTERVAL = 30_000;
const MOUSE_SAMPLE_INTERVAL = 2_000;

export function useBehavioralTracking({
  token,
  enabled = true,
  flushIntervalMs = FLUSH_INTERVAL,
}: UseBehavioralTrackingOptions) {
  const signals = useRef<BehavioralSignals>({
    keystrokeTimings: [],
    pasteEvents: [],
    focusEvents: [],
    mousePositions: [],
    responseTimings: [],
  });

  const lastKeyDown = useRef<number>(0);
  const lastMouseSample = useRef<number>(0);

  const flush = useCallback(async () => {
    const data = signals.current;
    const hasData =
      data.keystrokeTimings.length > 0 ||
      data.pasteEvents.length > 0 ||
      data.focusEvents.length > 0 ||
      data.mousePositions.length > 0 ||
      data.responseTimings.length > 0;

    if (!hasData) return;

    const payload = { ...data };
    signals.current = {
      keystrokeTimings: [],
      pasteEvents: [],
      focusEvents: [],
      mousePositions: [],
      responseTimings: [],
    };

    try {
      await fetch('/api/candidate/behavioral', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-candidate-token': token,
        },
        body: JSON.stringify(payload),
      });
    } catch {
      // Re-enqueue on failure
      signals.current.keystrokeTimings.push(...payload.keystrokeTimings);
      signals.current.pasteEvents.push(...payload.pasteEvents);
      signals.current.focusEvents.push(...payload.focusEvents);
      signals.current.mousePositions.push(...payload.mousePositions);
      signals.current.responseTimings.push(...payload.responseTimings);
    }
  }, [token]);

  const trackResponseStart = useCallback((questionNumber: number) => {
    signals.current.responseTimings.push({
      questionNumber,
      startedAt: Date.now(),
    });
  }, []);

  const trackResponseEnd = useCallback((questionNumber: number) => {
    const entry = signals.current.responseTimings.find(
      (r) => r.questionNumber === questionNumber && !r.answeredAt
    );
    if (entry) {
      entry.answeredAt = Date.now();
    }
  }, []);

  useEffect(() => {
    if (!enabled) return;

    const handleKeyDown = () => {
      lastKeyDown.current = Date.now();
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      const now = Date.now();
      const dwellMs = lastKeyDown.current > 0 ? now - lastKeyDown.current : 0;
      signals.current.keystrokeTimings.push({
        key: e.key.length === 1 ? '*' : e.key,
        timestamp: now,
        dwellMs,
      });
    };

    const handlePaste = (e: ClipboardEvent) => {
      const text = e.clipboardData?.getData('text') || '';
      signals.current.pasteEvents.push({
        timestamp: Date.now(),
        length: text.length,
      });
    };

    const handleVisibilityChange = () => {
      signals.current.focusEvents.push({
        type: document.hidden ? 'blur' : 'focus',
        timestamp: Date.now(),
      });
    };

    const handleBlur = () => {
      signals.current.focusEvents.push({ type: 'blur', timestamp: Date.now() });
    };

    const handleFocus = () => {
      signals.current.focusEvents.push({ type: 'focus', timestamp: Date.now() });
    };

    const handleMouseMove = (e: globalThis.MouseEvent) => {
      const now = Date.now();
      if (now - lastMouseSample.current < MOUSE_SAMPLE_INTERVAL) return;
      lastMouseSample.current = now;
      signals.current.mousePositions.push({
        x: Math.round(e.clientX),
        y: Math.round(e.clientY),
        timestamp: now,
      });
    };

    document.addEventListener('keydown', handleKeyDown);
    document.addEventListener('keyup', handleKeyUp);
    document.addEventListener('paste', handlePaste);
    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('blur', handleBlur);
    window.addEventListener('focus', handleFocus);
    document.addEventListener('mousemove', handleMouseMove);

    const interval = setInterval(flush, flushIntervalMs);

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.removeEventListener('keyup', handleKeyUp);
      document.removeEventListener('paste', handlePaste);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('blur', handleBlur);
      window.removeEventListener('focus', handleFocus);
      document.removeEventListener('mousemove', handleMouseMove);
      clearInterval(interval);
      flush();
    };
  }, [enabled, flush, flushIntervalMs]);

  return { trackResponseStart, trackResponseEnd, flush };
}
