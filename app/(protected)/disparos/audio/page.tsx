"use client";

import { useEffect, useRef, useState } from "react";
import { AppLayout } from "@/components/AppLayout";
import { AudioItem, getAudioStore, setAudioStore } from "@/lib/audioStore";
import { Mic, Plus, Play, Pause, Trash2, Upload, X, Check, CircleStop } from "lucide-react";
import { cn } from "@/lib/utils";

export default function DisparoAudioPage() {
  const [audios, setAudios] = useState<AudioItem[]>(getAudioStore());
  const [showModal, setShowModal] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [playingId, setPlayingId] = useState<string | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [recordTime, setRecordTime] = useState(0);
  const [pendingAudio, setPendingAudio] = useState<{
    base64: string;
    mimetype: string;
    duration: string;
    fileName: string;
  } | null>(null);

  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const audioStreamRef = useRef<MediaStream | null>(null);
  const recordIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const formatDuration = (seconds: number) => {
    const min = Math.floor(seconds / 60);
    const sec = seconds % 60;
    return `${min}:${sec.toString().padStart(2, "0")}`;
  };

  const addAudio = () => {
    if (!newTitle.trim() || !pendingAudio) return;

    const newItem: AudioItem = {
      id: Date.now().toString(),
      title: newTitle.trim(),
      fileName: pendingAudio.fileName,
      duration: pendingAudio.duration,
      createdAt: new Date().toLocaleDateString("pt-BR"),
      base64: pendingAudio.base64,
      mimetype: pendingAudio.mimetype,
    };
    const updated = [newItem, ...audios];
    setAudios(updated);
    setAudioStore(updated);
    setNewTitle("");
    setPendingAudio(null);
    setRecordTime(0);
    setIsRecording(false);
    setIsPaused(false);
    setShowModal(false);
  };

  const stopRecordingInterval = () => {
    if (recordIntervalRef.current) {
      clearInterval(recordIntervalRef.current);
      recordIntervalRef.current = null;
    }
  };

  const cleanupRecording = () => {
    stopRecordingInterval();
    audioStreamRef.current?.getTracks().forEach((t) => t.stop());
    audioStreamRef.current = null;
    mediaRecorderRef.current = null;
    audioChunksRef.current = [];
    setIsRecording(false);
    setIsPaused(false);
  };

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      audioStreamRef.current = stream;
      audioChunksRef.current = [];
      setPendingAudio(null);
      setRecordTime(0);

      const recorder = new MediaRecorder(stream, {
        mimeType: "audio/webm;codecs=opus",
      });

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) audioChunksRef.current.push(e.data);
      };

      recorder.onstop = () => {
        const mimeType = recorder.mimeType || "audio/webm;codecs=opus";
        const blob = new Blob(audioChunksRef.current, { type: mimeType });
        const reader = new FileReader();
        reader.onload = () => {
          const result = String(reader.result || "");
          const base64 = result.includes(",") ? result.split(",", 2)[1] : "";
          setPendingAudio({
            base64,
            mimetype: mimeType,
            duration: formatDuration(recordTime),
            fileName: `${newTitle.trim().toLowerCase().replace(/\s+/g, "-") || "audio-programado"}.webm`,
          });
        };
        reader.readAsDataURL(blob);
        cleanupRecording();
      };

      mediaRecorderRef.current = recorder;
      recorder.start(250);
      setIsRecording(true);
      setIsPaused(false);

      recordIntervalRef.current = setInterval(() => {
        setRecordTime((t) => t + 1);
      }, 1000);
    } catch {
      cleanupRecording();
    }
  };

  const pauseRecording = () => {
    if (mediaRecorderRef.current?.state === "recording") {
      mediaRecorderRef.current.pause();
      setIsPaused(true);
      stopRecordingInterval();
    }
  };

  const resumeRecording = () => {
    if (mediaRecorderRef.current?.state === "paused") {
      mediaRecorderRef.current.resume();
      setIsPaused(false);
      recordIntervalRef.current = setInterval(() => {
        setRecordTime((t) => t + 1);
      }, 1000);
    }
  };

  const stopAndSaveRecording = () => {
    const recorder = mediaRecorderRef.current;
    if (!recorder || recorder.state === "inactive") return;
    stopRecordingInterval();
    recorder.stop();
  };

  const cancelRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
      mediaRecorderRef.current.onstop = null;
      mediaRecorderRef.current.stop();
    }
    cleanupRecording();
  };

  const handleAudioUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const result = String(reader.result || "");
      const base64 = result.includes(",") ? result.split(",", 2)[1] : "";
      setPendingAudio({
        base64,
        mimetype: file.type || "audio/mpeg",
        duration: "0:00",
        fileName: file.name,
      });
      setIsRecording(false);
      setIsPaused(false);
      setRecordTime(0);
    };
    reader.readAsDataURL(file);
    e.target.value = "";
  };

  useEffect(() => {
    return () => cleanupRecording();
  }, []);

  const removeAudio = (id: string) => {
    const updated = audios.filter((a) => a.id !== id);
    setAudios(updated);
    setAudioStore(updated);
  };

  return (
    <AppLayout>
      <div className="space-y-6 animate-fade-in">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Áudio Programado</h1>
            <p className="text-muted-foreground mt-1">
              Grave e armazene áudios para envio rápido nas conversas
            </p>
          </div>
          <button
            onClick={() => setShowModal(true)}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg bg-primary text-primary-foreground font-medium text-sm hover:bg-primary/90 transition-colors"
          >
            <Plus className="w-4 h-4" />
            Novo Áudio
          </button>
        </div>

        {audios.length === 0 ? (
          <div className="glass-card rounded-xl p-12 flex flex-col items-center justify-center text-center">
            <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center mb-4">
              <Mic className="w-8 h-8 text-primary" />
            </div>
            <h3 className="text-lg font-semibold text-foreground mb-2">Nenhum áudio salvo</h3>
            <p className="text-sm text-muted-foreground max-w-md">
              Adicione áudios com títulos para enviar rapidamente durante as conversas.
            </p>
          </div>
        ) : (
          <div className="grid gap-3">
            {audios.map((audio) => (
              <div
                key={audio.id}
                className="glass-card rounded-xl p-5 flex items-center gap-4 hover:shadow-md transition-shadow"
              >
                <button
                  onClick={() => setPlayingId(playingId === audio.id ? null : audio.id)}
                  className={cn(
                    "w-10 h-10 rounded-lg flex items-center justify-center transition-colors",
                    playingId === audio.id ? "bg-primary text-primary-foreground" : "bg-primary/10"
                  )}
                >
                  {playingId === audio.id ? (
                    <Pause className="w-5 h-5" />
                  ) : (
                    <Play className="w-5 h-5 text-primary" />
                  )}
                </button>
                <div className="flex-1">
                  <h3 className="text-sm font-semibold text-foreground">{audio.title}</h3>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {audio.fileName} • {audio.duration}
                  </p>
                </div>
                <span className="text-xs text-muted-foreground">{audio.createdAt}</span>
                <button
                  onClick={() => removeAudio(audio.id)}
                  className="p-2 rounded-lg hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
        )}

        {/* Modal Novo Áudio */}
        {showModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
            <div className="bg-card rounded-2xl p-6 w-full max-w-md mx-4 shadow-xl space-y-5">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-semibold text-foreground">Novo Áudio</h2>
                <button
                  onClick={() => setShowModal(false)}
                  className="p-1 rounded-lg hover:bg-muted transition-colors"
                >
                  <X className="w-5 h-5 text-muted-foreground" />
                </button>
              </div>

              <div className="space-y-3">
                <label className="text-sm font-medium text-foreground">Título do áudio</label>
                <input
                  type="text"
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  placeholder="Ex: Boas-vindas, Promoção..."
                  className="w-full bg-muted/50 border border-border rounded-lg px-4 py-2.5 text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/30 transition-all"
                />
              </div>

              <div className="space-y-3">
                <label className="text-sm font-medium text-foreground">Arquivo de áudio</label>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="audio/*"
                  className="hidden"
                  onChange={handleAudioUpload}
                />

                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    className="w-full flex items-center justify-center gap-2 py-2.5 border border-border rounded-lg hover:border-primary/30 hover:bg-primary/5 transition-all"
                  >
                    <Upload className="w-4 h-4 text-muted-foreground" />
                    <span className="text-sm font-medium text-foreground">Enviar arquivo</span>
                  </button>
                  {!isRecording ? (
                    <button
                      onClick={startRecording}
                      className="w-full flex items-center justify-center gap-2 py-2.5 border border-border rounded-lg hover:border-primary/30 hover:bg-primary/5 transition-all"
                    >
                      <Mic className="w-4 h-4 text-muted-foreground" />
                      <span className="text-sm font-medium text-foreground">Gravar agora</span>
                    </button>
                  ) : (
                    <button
                      onClick={stopAndSaveRecording}
                      className="w-full flex items-center justify-center gap-2 py-2.5 border border-destructive/40 text-destructive rounded-lg hover:bg-destructive/10 transition-all"
                    >
                      <CircleStop className="w-4 h-4" />
                      <span className="text-sm font-medium">Finalizar gravação</span>
                    </button>
                  )}
                </div>

                {isRecording && (
                  <div className="rounded-lg border border-border p-3 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-muted-foreground">Gravando: {formatDuration(recordTime)}</span>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={isPaused ? resumeRecording : pauseRecording}
                          className="text-xs px-2 py-1 rounded border border-border hover:bg-muted"
                        >
                          {isPaused ? "Continuar" : "Pausar"}
                        </button>
                        <button
                          onClick={cancelRecording}
                          className="text-xs px-2 py-1 rounded border border-border hover:bg-muted"
                        >
                          Cancelar
                        </button>
                      </div>
                    </div>
                  </div>
                )}

                {pendingAudio && (
                  <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/5 px-3 py-2 flex items-center gap-2">
                    <Check className="w-4 h-4 text-emerald-600" />
                    <div className="min-w-0">
                      <p className="text-xs font-medium text-foreground truncate">Áudio pronto para salvar</p>
                      <p className="text-xs text-muted-foreground truncate">{pendingAudio.fileName} • {pendingAudio.duration}</p>
                    </div>
                  </div>
                )}
              </div>

              <div className="flex gap-3 justify-end">
                <button
                  onClick={() => setShowModal(false)}
                  className="px-4 py-2.5 rounded-lg text-sm font-medium text-muted-foreground hover:bg-muted transition-colors"
                >
                  Cancelar
                </button>
                <button
                  onClick={addAudio}
                  disabled={!newTitle.trim() || !pendingAudio}
                  className={cn(
                    "px-5 py-2.5 rounded-lg text-sm font-medium transition-colors",
                    !newTitle.trim() || !pendingAudio
                      ? "bg-muted text-muted-foreground cursor-not-allowed"
                      : "bg-primary text-primary-foreground hover:bg-primary/90",
                  )}
                >
                  Salvar Áudio
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </AppLayout>
  );
}
