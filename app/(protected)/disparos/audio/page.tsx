"use client";

import { useState } from "react";
import { AppLayout } from "@/components/AppLayout";
import { AudioItem, getAudioStore, setAudioStore } from "@/lib/audioStore";
import { Mic, Plus, Play, Pause, Trash2, Upload, X } from "lucide-react";
import { cn } from "@/lib/utils";

export default function DisparoAudioPage() {
  const [audios, setAudios] = useState<AudioItem[]>(getAudioStore());
  const [showModal, setShowModal] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [playingId, setPlayingId] = useState<string | null>(null);

  const addAudio = () => {
    if (!newTitle.trim()) return;
    const newItem: AudioItem = {
      id: Date.now().toString(),
      title: newTitle.trim(),
      fileName: `${newTitle.trim().toLowerCase().replace(/\s+/g, "-")}.mp3`,
      duration: "0:00",
      createdAt: new Date().toLocaleDateString("pt-BR"),
    };
    const updated = [newItem, ...audios];
    setAudios(updated);
    setAudioStore(updated);
    setNewTitle("");
    setShowModal(false);
  };

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
                <button className="w-full flex flex-col items-center gap-3 py-8 border-2 border-dashed border-border rounded-lg hover:border-primary/30 hover:bg-primary/5 transition-all cursor-pointer">
                  <Upload className="w-8 h-8 text-muted-foreground" />
                  <div className="text-center">
                    <p className="text-sm font-medium text-foreground">Clique para enviar um áudio</p>
                    <p className="text-xs text-muted-foreground mt-1">MP3, OGG ou WAV • Máx. 5MB</p>
                  </div>
                </button>
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
                  className="px-5 py-2.5 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors"
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
