"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { AppLayout } from "@/components/AppLayout";
import {
  MessageSquarePlus,
  Save,
  ToggleRight,
  Mic,
  Type,
  Upload,
  Smartphone,
  Play,
  Pause,
  X,
  CheckCircle2,
  Library,
  Loader2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import {
  listInstances,
  listAutoReplyConfigs,
  upsertAutoReplyConfig,
  listSavedAudios,
  getSavedAudio,
  type EvolutionInstance,
  type AutoReplyConfig,
  type SavedAudio,
} from "@/lib/api";
import { AudioPlayer } from "@/components/conversas/AudioPlayer";

type ResponseType = "text" | "audio" | "both";
type AudioTab = "upload" | "record" | "saved";

interface InstanceConfig {
  active: boolean;
  response_type: ResponseType;
  welcome_message: string;
  audio_base64: string | null;
  audio_mimetype: string | null;
  audio_filename: string | null;
  dirty: boolean;
}

const DEFAULT_CONFIG: InstanceConfig = {
  active: false,
  response_type: "text",
  welcome_message:
    "Olá! Obrigado por entrar em contato. Em breve um de nossos atendentes irá te responder. 😊",
  audio_base64: null,
  audio_mimetype: null,
  audio_filename: null,
  dirty: false,
};

export default function DisparoRecepcaoPage() {
  // ── Data ──
  const [instances, setInstances] = useState<EvolutionInstance[]>([]);
  const [configs, setConfigs] = useState<Map<string, InstanceConfig>>(new Map());
  const [savedAudios, setSavedAudios] = useState<SavedAudio[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // ── Selection ──
  const [selectedInstance, setSelectedInstance] = useState<string | null>(null);

  // ── Audio sub-state ──
  const [audioTab, setAudioTab] = useState<AudioTab>("upload");
  const [isRecording, setIsRecording] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [recordTime, setRecordTime] = useState(0);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const audioStreamRef = useRef<MediaStream | null>(null);
  const recordIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [loadingSavedId, setLoadingSavedId] = useState<string | null>(null);

  // ── Derived ──
  const config = selectedInstance ? configs.get(selectedInstance) ?? { ...DEFAULT_CONFIG } : null;

  const updateConfig = useCallback(
    (patch: Partial<InstanceConfig>) => {
      if (!selectedInstance) return;
      setConfigs((prev) => {
        const next = new Map(prev);
        const current = next.get(selectedInstance) ?? { ...DEFAULT_CONFIG };
        next.set(selectedInstance, { ...current, ...patch, dirty: true });
        return next;
      });
    },
    [selectedInstance],
  );

  // ── Load data on mount ──
  useEffect(() => {
    (async () => {
      try {
        const [inst, cfgs, audios] = await Promise.all([
          listInstances(),
          listAutoReplyConfigs(),
          listSavedAudios(),
        ]);
        const connected = inst.filter((i) => i.status === "open");
        setInstances(connected);
        setSavedAudios(audios);

        const map = new Map<string, InstanceConfig>();
        for (const c of cfgs) {
          map.set(c.instance_name, {
            active: c.active,
            response_type: c.response_type as ResponseType,
            welcome_message: c.welcome_message ?? DEFAULT_CONFIG.welcome_message,
            audio_base64: c.audio_base64,
            audio_mimetype: c.audio_mimetype,
            audio_filename: c.audio_filename,
            dirty: false,
          });
        }
        setConfigs(map);
        if (connected.length > 0) {
          setSelectedInstance(connected[0].instanceName);
        }
      } catch {
        toast.error("Erro ao carregar dados");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  // ── Audio helpers ──
  const formatTime = (s: number) => {
    const m = Math.floor(s / 60);
    const ss = s % 60;
    return `${m}:${ss.toString().padStart(2, "0")}`;
  };

  const stopRecordingCleanup = () => {
    if (recordIntervalRef.current) {
      clearInterval(recordIntervalRef.current);
      recordIntervalRef.current = null;
    }
    audioStreamRef.current?.getTracks().forEach((t) => t.stop());
    audioStreamRef.current = null;
    setIsRecording(false);
    setIsPaused(false);
  };

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      audioStreamRef.current = stream;
      audioChunksRef.current = [];
      setRecordTime(0);

      const recorder = new MediaRecorder(stream, {
        mimeType: "audio/webm;codecs=opus",
      });
      mediaRecorderRef.current = recorder;
      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) audioChunksRef.current.push(e.data);
      };

      recorder.onstop = () => {
        const mime = recorder.mimeType || "audio/webm;codecs=opus";
        const blob = new Blob(audioChunksRef.current, { type: mime });
        const reader = new FileReader();
        reader.onload = () => {
          const result = reader.result as string;
          const b64 = result.includes(",") ? result.split(",")[1] : result;
          updateConfig({
            audio_base64: b64,
            audio_mimetype: mime,
            audio_filename: `gravacao-${Date.now()}.webm`,
          });
        };
        reader.readAsDataURL(blob);
        stopRecordingCleanup();
      };

      recorder.start(250);
      setIsRecording(true);
      setIsPaused(false);
      recordIntervalRef.current = setInterval(
        () => setRecordTime((t) => t + 1),
        1000,
      );
    } catch {
      toast.error("Não foi possível acessar o microfone.");
    }
  };

  const pauseRecording = () => {
    if (mediaRecorderRef.current?.state === "recording")
      mediaRecorderRef.current.pause();
    setIsPaused(true);
    if (recordIntervalRef.current) {
      clearInterval(recordIntervalRef.current);
      recordIntervalRef.current = null;
    }
  };

  const resumeRecording = () => {
    if (mediaRecorderRef.current?.state === "paused")
      mediaRecorderRef.current.resume();
    setIsPaused(false);
    recordIntervalRef.current = setInterval(
      () => setRecordTime((t) => t + 1),
      1000,
    );
  };

  const cancelRecording = () => {
    if (
      mediaRecorderRef.current &&
      mediaRecorderRef.current.state !== "inactive"
    ) {
      mediaRecorderRef.current.onstop = null;
      mediaRecorderRef.current.stop();
    }
    audioChunksRef.current = [];
    setRecordTime(0);
    stopRecordingCleanup();
  };

  const finishRecording = () => {
    if (
      mediaRecorderRef.current &&
      mediaRecorderRef.current.state !== "inactive"
    ) {
      mediaRecorderRef.current.stop();
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      const b64 = result.includes(",") ? result.split(",")[1] : result;
      updateConfig({
        audio_base64: b64,
        audio_mimetype: f.type || "audio/ogg",
        audio_filename: f.name,
      });
    };
    reader.readAsDataURL(f);
    e.target.value = "";
  };

  const pickSavedAudio = async (audio: SavedAudio) => {
    setLoadingSavedId(audio.id);
    try {
      const full = await getSavedAudio(audio.id);
      updateConfig({
        audio_base64: full.audio_base64,
        audio_mimetype: full.mimetype,
        audio_filename: `${audio.title}.webm`,
      });
    } catch {
      toast.error("Erro ao carregar áudio salvo");
    } finally {
      setLoadingSavedId(null);
    }
  };

  const clearAudio = () => {
    updateConfig({
      audio_base64: null,
      audio_mimetype: null,
      audio_filename: null,
    });
  };

  const audioSrcUrl =
    config?.audio_base64 && config.audio_mimetype
      ? `data:${config.audio_mimetype};base64,${config.audio_base64}`
      : null;

  // ── Save ──
  const handleSave = async () => {
    if (!selectedInstance || !config) return;
    setSaving(true);
    try {
      await upsertAutoReplyConfig(selectedInstance, {
        active: config.active,
        response_type: config.response_type,
        welcome_message: config.welcome_message || null,
        audio_base64: config.audio_base64,
        audio_mimetype: config.audio_mimetype,
        audio_filename: config.audio_filename,
      });
      setConfigs((prev) => {
        const next = new Map(prev);
        const current = next.get(selectedInstance);
        if (current) next.set(selectedInstance, { ...current, dirty: false });
        return next;
      });
      toast.success("Configuração salva com sucesso");
    } catch {
      toast.error("Erro ao salvar configuração");
    } finally {
      setSaving(false);
    }
  };

  const responseOptions: {
    value: ResponseType;
    label: string;
    icon: typeof Type;
  }[] = [
    { value: "text", label: "Mensagem de Texto", icon: Type },
    { value: "audio", label: "Áudio", icon: Mic },
    { value: "both", label: "Texto + Áudio", icon: MessageSquarePlus },
  ];

  const hasAudio = !!config?.audio_base64;

  if (loading) {
    return (
      <AppLayout>
        <div className="flex items-center justify-center h-64">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="space-y-6 animate-fade-in">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground">
              Recepção Automática
            </h1>
            <p className="text-muted-foreground mt-1">
              Configure a resposta automática para novos atendimentos
            </p>
          </div>
        </div>

        {instances.length === 0 ? (
          <div className="glass-card rounded-xl p-8 text-center">
            <Smartphone className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
            <p className="text-sm text-muted-foreground">
              Nenhuma conexão ativa encontrada. Conecte uma instância primeiro.
            </p>
          </div>
        ) : (
          <>
            {/* Connection selector */}
            <div className="space-y-3">
              <h3 className="text-sm font-semibold text-foreground">Conexão</h3>
              <div className="grid grid-cols-2 gap-3">
                {instances.map((inst) => {
                  const instConfig = configs.get(inst.instanceName);
                  const isSelected = selectedInstance === inst.instanceName;
                  return (
                    <button
                      key={inst.instanceName}
                      onClick={() => setSelectedInstance(inst.instanceName)}
                      className={cn(
                        "glass-card rounded-xl p-4 flex items-center gap-3 transition-all",
                        isSelected
                          ? "ring-2 ring-primary bg-primary/5"
                          : "hover:bg-muted/60",
                      )}
                    >
                      <Smartphone
                        className={cn(
                          "w-5 h-5",
                          isSelected
                            ? "text-primary"
                            : "text-muted-foreground",
                        )}
                      />
                      <div className="text-left flex-1 min-w-0">
                        <span
                          className={cn(
                            "text-sm font-medium block truncate",
                            isSelected ? "text-primary" : "text-foreground",
                          )}
                        >
                          {inst.profileName || inst.instanceName}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          {inst.number || inst.instanceName}
                        </span>
                      </div>
                      {instConfig?.active && (
                        <div className="w-2 h-2 rounded-full bg-green-500 flex-shrink-0" />
                      )}
                    </button>
                  );
                })}
              </div>
            </div>

            {config && selectedInstance && (
              <>
                {/* Active toggle */}
                <div className="glass-card rounded-xl p-5 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div
                      className={cn(
                        "w-10 h-10 rounded-lg flex items-center justify-center",
                        config.active ? "bg-primary/10" : "bg-muted",
                      )}
                    >
                      <MessageSquarePlus
                        className={cn(
                          "w-5 h-5",
                          config.active
                            ? "text-primary"
                            : "text-muted-foreground",
                        )}
                      />
                    </div>
                    <div>
                      <h3 className="text-sm font-semibold text-foreground">
                        Resposta automática
                      </h3>
                      <p className="text-xs text-muted-foreground">
                        Enviar automaticamente ao receber um novo contato
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={() => updateConfig({ active: !config.active })}
                    className={cn(
                      "flex items-center gap-2 text-xs font-medium px-4 py-2 rounded-full transition-colors",
                      config.active
                        ? "bg-primary/10 text-primary"
                        : "bg-muted text-muted-foreground",
                    )}
                  >
                    <ToggleRight className="w-4 h-4" />
                    {config.active ? "Ativo" : "Inativo"}
                  </button>
                </div>

                {config.active && (
                  <>
                    {/* Response type */}
                    <div className="space-y-3">
                      <h3 className="text-sm font-semibold text-foreground">
                        Tipo de resposta
                      </h3>
                      <div className="grid grid-cols-3 gap-3">
                        {responseOptions.map((opt) => (
                          <button
                            key={opt.value}
                            onClick={() =>
                              updateConfig({ response_type: opt.value })
                            }
                            className={cn(
                              "glass-card rounded-xl p-4 flex flex-col items-center gap-2 transition-all text-center",
                              config.response_type === opt.value
                                ? "ring-2 ring-primary bg-primary/5"
                                : "hover:bg-muted/60",
                            )}
                          >
                            <opt.icon
                              className={cn(
                                "w-5 h-5",
                                config.response_type === opt.value
                                  ? "text-primary"
                                  : "text-muted-foreground",
                              )}
                            />
                            <span
                              className={cn(
                                "text-xs font-medium",
                                config.response_type === opt.value
                                  ? "text-primary"
                                  : "text-muted-foreground",
                              )}
                            >
                              {opt.label}
                            </span>
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Text message */}
                    {(config.response_type === "text" ||
                      config.response_type === "both") && (
                      <div className="space-y-3">
                        <h3 className="text-sm font-semibold text-foreground">
                          Mensagem de boas-vindas
                        </h3>
                        <div className="glass-card rounded-xl p-5">
                          <textarea
                            value={config.welcome_message}
                            onChange={(e) =>
                              updateConfig({
                                welcome_message: e.target.value,
                              })
                            }
                            placeholder="Digite a mensagem automática..."
                            rows={4}
                            className="w-full bg-muted/50 border border-border rounded-lg px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/30 transition-all resize-none"
                          />
                          <p className="text-xs text-muted-foreground mt-2">
                            Variáveis disponíveis:{" "}
                            <code className="bg-muted px-1.5 py-0.5 rounded text-primary text-[11px]">
                              {"{{nome}}"}
                            </code>{" "}
                            <code className="bg-muted px-1.5 py-0.5 rounded text-primary text-[11px]">
                              {"{{numero}}"}
                            </code>
                          </p>
                        </div>
                      </div>
                    )}

                    {/* Audio section */}
                    {(config.response_type === "audio" ||
                      config.response_type === "both") && (
                      <div className="space-y-3">
                        <h3 className="text-sm font-semibold text-foreground">
                          Áudio de boas-vindas
                        </h3>
                        <div className="glass-card rounded-xl p-5">
                          {hasAudio && audioSrcUrl ? (
                            <div className="rounded-lg border border-border bg-background">
                              <div className="flex items-center gap-1">
                                <div className="flex-1 min-w-0">
                                  <AudioPlayer src={audioSrcUrl} sent={false} />
                                </div>
                                <button
                                  type="button"
                                  onClick={clearAudio}
                                  className="p-1.5 mr-2 rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors flex-shrink-0"
                                  title="Remover áudio"
                                >
                                  <X className="w-4 h-4" />
                                </button>
                              </div>
                              <div className="px-3 pb-2 -mt-1">
                                <span className="text-[10px] text-muted-foreground truncate block">
                                  {config.audio_filename || "Áudio gravado"}
                                </span>
                              </div>
                            </div>
                          ) : isRecording ? (
                            <div className="flex items-center gap-3 p-3 rounded-lg border border-primary/30 bg-primary/5">
                              <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
                              <span className="text-sm font-medium text-foreground tabular-nums">
                                {formatTime(recordTime)}
                              </span>
                              <div className="flex-1" />
                              {!isPaused ? (
                                <button
                                  type="button"
                                  onClick={pauseRecording}
                                  className="p-1.5 rounded-lg hover:bg-muted transition-colors text-muted-foreground"
                                  title="Pausar"
                                >
                                  <Pause className="w-4 h-4" />
                                </button>
                              ) : (
                                <button
                                  type="button"
                                  onClick={resumeRecording}
                                  className="p-1.5 rounded-lg hover:bg-muted transition-colors text-primary"
                                  title="Retomar"
                                >
                                  <Play className="w-4 h-4" />
                                </button>
                              )}
                              <button
                                type="button"
                                onClick={cancelRecording}
                                className="p-1.5 rounded-lg hover:bg-destructive/10 transition-colors text-muted-foreground hover:text-destructive"
                                title="Cancelar"
                              >
                                <X className="w-4 h-4" />
                              </button>
                              <button
                                type="button"
                                onClick={finishRecording}
                                className="p-1.5 rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
                                title="Concluir gravação"
                              >
                                <CheckCircle2 className="w-4 h-4" />
                              </button>
                            </div>
                          ) : (
                            <div className="space-y-2">
                              <div className="flex gap-1 bg-muted rounded-lg p-0.5">
                                {(
                                  [
                                    {
                                      key: "upload" as AudioTab,
                                      label: "Arquivo",
                                      icon: Upload,
                                    },
                                    {
                                      key: "record" as AudioTab,
                                      label: "Gravar",
                                      icon: Mic,
                                    },
                                    {
                                      key: "saved" as AudioTab,
                                      label: "Salvos",
                                      icon: Library,
                                    },
                                  ] as const
                                ).map((t) => (
                                  <button
                                    key={t.key}
                                    type="button"
                                    onClick={() => setAudioTab(t.key)}
                                    className={cn(
                                      "flex-1 flex items-center justify-center gap-1 px-2 py-1.5 rounded-md text-xs font-medium transition-all",
                                      audioTab === t.key
                                        ? "bg-background text-foreground shadow-sm"
                                        : "text-muted-foreground hover:text-foreground",
                                    )}
                                  >
                                    <t.icon className="w-3.5 h-3.5" />
                                    {t.label}
                                  </button>
                                ))}
                              </div>

                              {audioTab === "upload" && (
                                <>
                                  <input
                                    ref={fileInputRef}
                                    type="file"
                                    accept="audio/*"
                                    className="hidden"
                                    onChange={handleFileUpload}
                                  />
                                  <button
                                    type="button"
                                    onClick={() =>
                                      fileInputRef.current?.click()
                                    }
                                    className="w-full flex items-center gap-2 py-3 border-2 border-dashed border-border rounded-lg hover:border-primary/30 hover:bg-primary/5 transition-all justify-center"
                                  >
                                    <Upload className="w-4 h-4 text-muted-foreground" />
                                    <span className="text-xs text-muted-foreground">
                                      Selecionar áudio (MP3, OGG, WAV)
                                    </span>
                                  </button>
                                </>
                              )}

                              {audioTab === "record" && (
                                <button
                                  type="button"
                                  onClick={startRecording}
                                  className="w-full flex items-center gap-2 py-3 border-2 border-dashed border-border rounded-lg hover:border-primary/30 hover:bg-primary/5 transition-all justify-center"
                                >
                                  <Mic className="w-4 h-4 text-red-500" />
                                  <span className="text-xs text-muted-foreground">
                                    Clique para começar a gravar
                                  </span>
                                </button>
                              )}

                              {audioTab === "saved" && (
                                <div className="max-h-40 overflow-y-auto space-y-1 border border-border rounded-lg p-1.5">
                                  {savedAudios.length === 0 ? (
                                    <p className="text-xs text-muted-foreground text-center py-3">
                                      Nenhum áudio salvo
                                    </p>
                                  ) : (
                                    savedAudios.map((a) => (
                                      <button
                                        key={a.id}
                                        type="button"
                                        disabled={loadingSavedId === a.id}
                                        onClick={() => pickSavedAudio(a)}
                                        className="w-full flex items-center gap-2 px-2.5 py-2 rounded-lg hover:bg-muted transition-colors text-left"
                                      >
                                        {loadingSavedId === a.id ? (
                                          <Loader2 className="w-3.5 h-3.5 animate-spin text-primary flex-shrink-0" />
                                        ) : (
                                          <Play className="w-3.5 h-3.5 text-primary flex-shrink-0" />
                                        )}
                                        <span className="text-xs text-foreground truncate flex-1">
                                          {a.title}
                                        </span>
                                        {a.duration && (
                                          <span className="text-[10px] text-muted-foreground tabular-nums">
                                            {a.duration}
                                          </span>
                                        )}
                                      </button>
                                    ))
                                  )}
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                    )}

                    {/* Save button */}
                    <div className="flex justify-end">
                      <button
                        onClick={handleSave}
                        disabled={saving || !config.dirty}
                        className={cn(
                          "inline-flex items-center gap-2 px-5 py-2.5 rounded-lg font-medium text-sm transition-colors",
                          config.dirty
                            ? "bg-primary text-primary-foreground hover:bg-primary/90"
                            : "bg-muted text-muted-foreground cursor-not-allowed",
                        )}
                      >
                        {saving ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <Save className="w-4 h-4" />
                        )}
                        Salvar Configuração
                      </button>
                    </div>
                  </>
                )}
              </>
            )}
          </>
        )}
      </div>
    </AppLayout>
  );
}
