"use client";

import { useRef, useState, useEffect, useCallback } from "react";
import { Play, Pause } from "lucide-react";
import { cn } from "@/lib/utils";

interface AudioPlayerProps {
  src: string;
  sent: boolean;
}

function formatDuration(sec: number): string {
  if (!isFinite(sec) || sec < 0) return "0:00";
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

// Generate deterministic "waveform" bars from a hash of the src URL
function generateBars(count: number, seed: string): number[] {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    hash = ((hash << 5) - hash + seed.charCodeAt(i)) | 0;
  }
  const bars: number[] = [];
  for (let i = 0; i < count; i++) {
    hash = ((hash << 5) - hash + i * 7 + 13) | 0;
    const val = ((Math.abs(hash) % 60) + 20) / 80; // 0.25–1.0
    bars.push(val);
  }
  return bars;
}

export function AudioPlayer({ src, sent }: AudioPlayerProps) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [playing, setPlaying] = useState(false);
  const [duration, setDuration] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [loaded, setLoaded] = useState(false);
  const [playbackRate, setPlaybackRate] = useState(1);
  const barsRef = useRef(generateBars(32, src));
  const animRef = useRef<number>(0);

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
    if (audio.paused) {
      try { await audio.play(); } catch { /* user gesture needed */ }
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
  const bars = barsRef.current;

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
            : "bg-primary/15 hover:bg-primary/25 text-primary"
        )}
      >
        {playing
          ? <Pause className="w-4 h-4" fill="currentColor" />
          : <Play className="w-4 h-4 ml-0.5" fill="currentColor" />
        }
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
                    ? sent ? "bg-primary-foreground" : "bg-primary"
                    : sent ? "bg-primary-foreground/30" : "bg-primary/25"
                )}
                style={{ height: `${h * 100}%` }}
              />
            );
          })}
        </div>

        {/* Time + speed control */}
        <div className="flex items-center justify-between">
          <span className={cn(
            "text-[10px] font-medium tabular-nums",
            sent ? "text-primary-foreground/70" : "text-muted-foreground"
          )}>
            {playing || currentTime > 0
              ? formatDuration(currentTime)
              : loaded ? formatDuration(duration) : "0:00"
            }
          </span>
          {playing && (
            <button
              onClick={cycleSpeed}
              className={cn(
                "text-[10px] font-bold px-1.5 py-0.5 rounded-full transition-colors",
                sent
                  ? "bg-primary-foreground/20 text-primary-foreground hover:bg-primary-foreground/30"
                  : "bg-primary/10 text-primary hover:bg-primary/20"
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
