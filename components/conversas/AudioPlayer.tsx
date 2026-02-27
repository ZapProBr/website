"use client";

import { useRef, useState, useEffect, useCallback } from "react";
import { Play, Pause } from "lucide-react";
import { cn } from "@/lib/utils";

interface AudioPlayerProps {
  src: string;
  sent: boolean;
}

const BAR_COUNT = 40;

function formatDuration(sec: number): string {
  if (!isFinite(sec) || sec < 0) return "0:00";
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

// Placeholder bars while real waveform loads
function placeholderBars(count: number): number[] {
  return Array.from({ length: count }, () => 0.15);
}

// Extract real waveform amplitudes from decoded audio buffer
function extractWaveform(buffer: AudioBuffer, barCount: number): number[] {
  const channel = buffer.getChannelData(0); // mono or first channel
  const samplesPerBar = Math.floor(channel.length / barCount);
  const bars: number[] = [];

  for (let i = 0; i < barCount; i++) {
    let sum = 0;
    const start = i * samplesPerBar;
    const end = Math.min(start + samplesPerBar, channel.length);
    for (let j = start; j < end; j++) {
      sum += Math.abs(channel[j]);
    }
    bars.push(sum / (end - start));
  }

  // Normalize to 0.1–1.0 range
  const max = Math.max(...bars, 0.001);
  return bars.map((v) => Math.max(0.1, v / max));
}

export function AudioPlayer({ src, sent }: AudioPlayerProps) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [playing, setPlaying] = useState(false);
  const [duration, setDuration] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [loaded, setLoaded] = useState(false);
  const [playbackRate, setPlaybackRate] = useState(1);
  const [bars, setBars] = useState<number[]>(placeholderBars(BAR_COUNT));
  const animRef = useRef<number>(0);
  const waveformFetched = useRef(false);

  // Lazy waveform: only decode audio data the first time the user hits Play.
  // This avoids downloading every audio file on mount (expensive on long chat histories).
  const fetchWaveform = useCallback(() => {
    if (waveformFetched.current) return;
    waveformFetched.current = true;

    const ac = new (
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext })
        .webkitAudioContext
    )();

    fetch(src)
      .then((res) => res.arrayBuffer())
      .then((buf) => ac.decodeAudioData(buf))
      .then((decoded) => {
        setBars(extractWaveform(decoded, BAR_COUNT));
      })
      .catch(() => {
        // Keep placeholder bars on failure
      })
      .finally(() => {
        ac.close().catch(() => {});
      });
  }, [src]);

  // Update current time via requestAnimationFrame for smooth progress
  const tick = useCallback(() => {
    const audio = audioRef.current;
    if (audio && !audio.paused) {
      setCurrentTime(audio.currentTime);
      animRef.current = requestAnimationFrame(tick);
    }
  }, []);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const onLoaded = () => {
      setDuration(audio.duration);
      setLoaded(true);
    };
    const onTimeUpdate = () => setCurrentTime(audio.currentTime);
    const onEnded = () => {
      setPlaying(false);
      setCurrentTime(0);
      cancelAnimationFrame(animRef.current);
    };
    const onPlay = () => {
      setPlaying(true);
      animRef.current = requestAnimationFrame(tick);
    };
    const onPause = () => {
      setPlaying(false);
      cancelAnimationFrame(animRef.current);
    };

    audio.addEventListener("loadedmetadata", onLoaded);
    audio.addEventListener("durationchange", onLoaded);
    audio.addEventListener("timeupdate", onTimeUpdate);
    audio.addEventListener("ended", onEnded);
    audio.addEventListener("play", onPlay);
    audio.addEventListener("pause", onPause);

    return () => {
      audio.removeEventListener("loadedmetadata", onLoaded);
      audio.removeEventListener("durationchange", onLoaded);
      audio.removeEventListener("timeupdate", onTimeUpdate);
      audio.removeEventListener("ended", onEnded);
      audio.removeEventListener("play", onPlay);
      audio.removeEventListener("pause", onPause);
      cancelAnimationFrame(animRef.current);
    };
  }, [tick]);

  const togglePlay = async () => {
    const audio = audioRef.current;
    if (!audio) return;
    // Lazily decode the waveform on first play (avoids fetching all audio on mount)
    fetchWaveform();
    if (audio.paused) {
      try {
        await audio.play();
      } catch {
        /* user gesture needed */
      }
    } else {
      audio.pause();
    }
  };

  const handleSeek = (e: React.MouseEvent<HTMLDivElement>) => {
    const audio = audioRef.current;
    if (!audio || !duration) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const pct = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    audio.currentTime = pct * duration;
    setCurrentTime(audio.currentTime);
  };

  const cycleSpeed = () => {
    const audio = audioRef.current;
    if (!audio) return;
    const next = playbackRate === 1 ? 1.5 : playbackRate === 1.5 ? 2 : 1;
    audio.playbackRate = next;
    setPlaybackRate(next);
  };

  const progress = duration > 0 ? currentTime / duration : 0;

  return (
    <div className="flex items-center gap-2.5 px-3 py-2 min-w-[240px] max-w-[320px]">
      <audio ref={audioRef} src={src} preload="metadata" />

      {/* Play/Pause button */}
      <button
        onClick={togglePlay}
        className={cn(
          "flex-shrink-0 w-9 h-9 rounded-full flex items-center justify-center transition-colors",
          sent
            ? "bg-primary-foreground/20 hover:bg-primary-foreground/30 text-primary-foreground"
            : "bg-primary/15 hover:bg-primary/25 text-primary",
        )}
      >
        {playing ? (
          <Pause className="w-4 h-4" fill="currentColor" />
        ) : (
          <Play className="w-4 h-4 ml-0.5" fill="currentColor" />
        )}
      </button>

      {/* Waveform + progress */}
      <div className="flex-1 flex flex-col gap-1">
        <div
          className="flex items-end gap-[2px] h-6 cursor-pointer"
          onClick={handleSeek}
        >
          {bars.map((h, i) => {
            const barProgress = i / bars.length;
            const isPlayed = barProgress <= progress;
            return (
              <div
                key={i}
                className={cn(
                  "flex-1 rounded-full min-w-[2px] transition-colors duration-100",
                  isPlayed
                    ? sent
                      ? "bg-primary-foreground"
                      : "bg-primary"
                    : sent
                      ? "bg-primary-foreground/30"
                      : "bg-primary/25",
                )}
                style={{ height: `${h * 100}%` }}
              />
            );
          })}
        </div>

        {/* Time + speed control */}
        <div className="flex items-center justify-between">
          <span
            className={cn(
              "text-[10px] font-medium tabular-nums",
              sent ? "text-primary-foreground/70" : "text-muted-foreground",
            )}
          >
            {playing || currentTime > 0
              ? formatDuration(currentTime)
              : loaded
                ? formatDuration(duration)
                : "0:00"}
          </span>
          {playing && (
            <button
              onClick={cycleSpeed}
              className={cn(
                "text-[10px] font-bold px-1.5 py-0.5 rounded-full transition-colors",
                sent
                  ? "bg-primary-foreground/20 text-primary-foreground hover:bg-primary-foreground/30"
                  : "bg-primary/10 text-primary hover:bg-primary/20",
              )}
            >
              {playbackRate}x
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
