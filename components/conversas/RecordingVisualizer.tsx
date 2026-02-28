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
  // Accumulated bar heights (right = newest)
  const barsRef = useRef<number[]>([]);
  const lastPushRef = useRef<number>(0);

  const BAR_WIDTH = 3;
  const BAR_GAP = 2;
  const MIN_HEIGHT = 3;
  const MAX_HEIGHT = 28;
  const PUSH_INTERVAL = 80; // ms between new bars — controls scroll speed

  const draw = useCallback(() => {
    const analyser = analyserRef.current;
    const data = dataRef.current;
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!analyser || !data || !canvas || !container) return;

    analyser.getByteFrequencyData(data);

    // Compute average amplitude across all frequency bins
    const binCount = analyser.frequencyBinCount;
    let sum = 0;
    for (let i = 0; i < binCount; i++) sum += data[i];
    const avg = sum / binCount; // 0–255
    const height = Math.max(MIN_HEIGHT, (avg / 255) * MAX_HEIGHT);

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

    // Resize canvas to container
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

    // Draw bars right-aligned (newest on the right)
    const bars = barsRef.current;
    const centerY = h / 2;
    // Get computed color from CSS custom property
    const style = getComputedStyle(container);
    ctx.fillStyle =
      style.getPropertyValue("color") || "rgba(150,150,150,0.5)";

    const radius = BAR_WIDTH / 2;
    let x = w - BAR_WIDTH; // start from the right edge
    for (let i = bars.length - 1; i >= 0 && x > -BAR_WIDTH; i--) {
      const barH = bars[i];
      const yTop = centerY - barH / 2;

      // Rounded rect via arcs
      ctx.beginPath();
      ctx.moveTo(x + radius, yTop);
      ctx.lineTo(x + BAR_WIDTH - radius, yTop);
      ctx.arc(
        x + BAR_WIDTH - radius,
        yTop + radius,
        radius,
        -Math.PI / 2,
        0,
      );
      ctx.lineTo(x + BAR_WIDTH, yTop + barH - radius);
      ctx.arc(
        x + BAR_WIDTH - radius,
        yTop + barH - radius,
        radius,
        0,
        Math.PI / 2,
      );
      ctx.lineTo(x + radius, yTop + barH);
      ctx.arc(
        x + radius,
        yTop + barH - radius,
        radius,
        Math.PI / 2,
        Math.PI,
      );
      ctx.lineTo(x, yTop + radius);
      ctx.arc(x + radius, yTop + radius, radius, Math.PI, (3 * Math.PI) / 2);
      ctx.closePath();
      ctx.fill();

      x -= BAR_WIDTH + BAR_GAP;
    }

    animRef.current = requestAnimationFrame(draw);
  }, []);

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
    analyser.smoothingTimeConstant = 0.6;
    analyserRef.current = analyser;
    dataRef.current = new Uint8Array(analyser.frequencyBinCount);

    source.connect(analyser);
    // Don't connect analyser to destination — we don't want to hear ourselves

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
    } else if (analyserRef.current) {
      lastPushRef.current = performance.now();
      animRef.current = requestAnimationFrame(draw);
    }
  }, [isPaused, draw]);

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
