"use client";

import { useRef, useEffect, useState, useCallback } from "react";
import { cn } from "@/lib/utils";

interface RecordingVisualizerProps {
  stream: MediaStream | null;
  isPaused: boolean;
  barCount?: number;
}

/**
 * Real-time audio waveform visualizer using Web Audio API AnalyserNode.
 * Reads live frequency data from the microphone stream and renders
 * animated bars whose heights reflect actual audio amplitude.
 */
export function RecordingVisualizer({
  stream,
  isPaused,
  barCount = 30,
}: RecordingVisualizerProps) {
  const [bars, setBars] = useState<number[]>(() =>
    Array.from({ length: barCount }, () => 4)
  );
  const analyserRef = useRef<AnalyserNode | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const sourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const animRef = useRef<number>(0);
  const dataRef = useRef<Uint8Array<ArrayBuffer> | null>(null);

  const draw = useCallback(() => {
    const analyser = analyserRef.current;
    const data = dataRef.current;
    if (!analyser || !data) return;

    analyser.getByteFrequencyData(data);

    // Group frequency bins into barCount buckets
    const binCount = analyser.frequencyBinCount;
    const binsPerBar = Math.floor(binCount / barCount);
    const newBars: number[] = [];

    for (let i = 0; i < barCount; i++) {
      let sum = 0;
      const start = i * binsPerBar;
      for (let j = start; j < start + binsPerBar && j < binCount; j++) {
        sum += data[j];
      }
      const avg = sum / binsPerBar; // 0–255
      // Map to pixel height: min 4px, max 28px
      const height = Math.max(4, (avg / 255) * 28);
      newBars.push(height);
    }

    setBars(newBars);
    animRef.current = requestAnimationFrame(draw);
  }, [barCount]);

  useEffect(() => {
    if (!stream) return;

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
      animRef.current = requestAnimationFrame(draw);
    }
  }, [isPaused, draw]);

  return (
    <div className="flex-1 flex items-center justify-center gap-[3px] h-8 overflow-hidden">
      {bars.map((h, i) => (
        <div
          key={i}
          className={cn(
            "w-[3px] rounded-full transition-[height] duration-75",
            isPaused ? "bg-muted-foreground/25" : "bg-muted-foreground/40"
          )}
          style={{ height: `${h}px` }}
        />
      ))}
    </div>
  );
}
