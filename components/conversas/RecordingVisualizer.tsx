"use client";

import { useRef, useEffect, useCallback } from "react";
import { cn } from "@/lib/utils";

interface RecordingVisualizerProps {
  stream: MediaStream | null;
  isPaused: boolean;
}

/**
 * WhatsApp-style audio waveform visualizer.
 * Bars accumulate from right to left as you speak — like a scrolling trail.
 * Uses Web Audio API AnalyserNode for real-time amplitude data and
 * canvas rendering for performance with hundreds of bars.
 */
export function RecordingVisualizer({
  stream,
  isPaused,
}: RecordingVisualizerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const sourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const animRef = useRef<number>(0);
  const dataRef = useRef<Uint8Array<ArrayBuffer> | null>(null);
  const isPausedRef = useRef(false);
  // Accumulated bar heights (right = newest)
  const barsRef = useRef<number[]>([]);
  const lastPushRef = useRef<number>(0);

  const BAR_WIDTH = 3;
  const BAR_GAP = 2;
  const MIN_HEIGHT = 2;
  const MAX_HEIGHT = 30;
  const PUSH_INTERVAL = 80; // ms between new bars — controls scroll speed

  // Keep isPausedRef in sync
  useEffect(() => {
    isPausedRef.current = isPaused;
  }, [isPaused]);

  /** Render the current bars to the canvas (no new data, no rAF loop). */
  const renderFrame = useCallback(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;

    const dpr = window.devicePixelRatio || 1;
    const w = container.clientWidth;
    const h = container.clientHeight;
    if (canvas.width !== w * dpr || canvas.height !== h * dpr) {
      canvas.width = w * dpr;
      canvas.height = h * dpr;
      canvas.style.width = `${w}px`;
      canvas.style.height = `${h}px`;
    }

    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);

    const bars = barsRef.current;
    const centerY = h / 2;
    const style = getComputedStyle(container);
    ctx.fillStyle =
      style.getPropertyValue("color") || "rgba(150,150,150,0.5)";

    const radius = BAR_WIDTH / 2;
    let x = w - BAR_WIDTH;
    for (let i = bars.length - 1; i >= 0 && x > -BAR_WIDTH; i--) {
      const barH = bars[i];
      const yTop = centerY - barH / 2;

      ctx.beginPath();
      ctx.moveTo(x + radius, yTop);
      ctx.lineTo(x + BAR_WIDTH - radius, yTop);
      ctx.arc(x + BAR_WIDTH - radius, yTop + radius, radius, -Math.PI / 2, 0);
      ctx.lineTo(x + BAR_WIDTH, yTop + barH - radius);
      ctx.arc(x + BAR_WIDTH - radius, yTop + barH - radius, radius, 0, Math.PI / 2);
      ctx.lineTo(x + radius, yTop + barH);
      ctx.arc(x + radius, yTop + barH - radius, radius, Math.PI / 2, Math.PI);
      ctx.lineTo(x, yTop + radius);
      ctx.arc(x + radius, yTop + radius, radius, Math.PI, (3 * Math.PI) / 2);
      ctx.closePath();
      ctx.fill();

      x -= BAR_WIDTH + BAR_GAP;
    }
  }, []);

  const draw = useCallback(() => {
    const analyser = analyserRef.current;
    const data = dataRef.current;
    const container = containerRef.current;
    if (!analyser || !data || !container) return;

    // If paused, render one static frame and stop the loop
    if (isPausedRef.current) {
      renderFrame();
      return; // don't schedule next frame
    }

    analyser.getByteFrequencyData(data);

    // Use only the lower half of frequency bins (voice-relevant range)
    const usableBins = Math.floor(analyser.frequencyBinCount / 2);
    let sum = 0;
    let peak = 0;
    for (let i = 0; i < usableBins; i++) {
      sum += data[i];
      if (data[i] > peak) peak = data[i];
    }
    const avg = sum / usableBins; // 0–255

    // Blend average (40%) + peak (60%) for sensitivity, then apply power curve
    const blended = avg * 0.4 + peak * 0.6;
    const normalized = Math.pow(blended / 255, 0.45); // power curve for sensitivity
    const height = Math.max(MIN_HEIGHT, normalized * MAX_HEIGHT);

    // Push a new bar at a fixed interval
    const now = performance.now();
    if (now - lastPushRef.current >= PUSH_INTERVAL) {
      barsRef.current.push(Math.round(height * 10) / 10);
      lastPushRef.current = now;

      // Trim bars that would be off-screen (keep some extra)
      const maxBars =
        Math.ceil(container.clientWidth / (BAR_WIDTH + BAR_GAP)) + 10;
      if (barsRef.current.length > maxBars) {
        barsRef.current = barsRef.current.slice(
          barsRef.current.length - maxBars,
        );
      }
    }

    renderFrame();
    animRef.current = requestAnimationFrame(draw);
  }, [renderFrame]);

  useEffect(() => {
    if (!stream) return;

    // Reset bars on new stream
    barsRef.current = [];
    lastPushRef.current = performance.now();

    const ac = new (
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext })
        .webkitAudioContext
    )();
    audioCtxRef.current = ac;

    const source = ac.createMediaStreamSource(stream);
    sourceRef.current = source;

    const analyser = ac.createAnalyser();
    analyser.fftSize = 256;
    analyser.smoothingTimeConstant = 0.3;
    analyserRef.current = analyser;
    dataRef.current = new Uint8Array(analyser.frequencyBinCount);

    source.connect(analyser);

    animRef.current = requestAnimationFrame(draw);

    return () => {
      cancelAnimationFrame(animRef.current);
      source.disconnect();
      ac.close().catch(() => {});
      analyserRef.current = null;
      audioCtxRef.current = null;
      sourceRef.current = null;
    };
  }, [stream, draw]);

  // Pause/resume the animation loop
  useEffect(() => {
    if (isPaused) {
      cancelAnimationFrame(animRef.current);
      // Render one last static frame so bars stay visible
      renderFrame();
    } else if (analyserRef.current) {
      lastPushRef.current = performance.now();
      animRef.current = requestAnimationFrame(draw);
    }
  }, [isPaused, draw, renderFrame]);

  return (
    <div
      ref={containerRef}
      className={cn(
        "flex-1 h-8 overflow-hidden relative",
        isPaused ? "text-muted-foreground/25" : "text-muted-foreground/50",
      )}
    >
      <canvas ref={canvasRef} className="absolute inset-0" />
    </div>
  );
}
