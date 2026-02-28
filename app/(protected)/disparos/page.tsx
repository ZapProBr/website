"use client";

import { AppLayout } from "@/components/AppLayout";
import { useEffect, useState, useCallback, useRef } from "react";
import {
  Megaphone, Plus, Clock, CheckCircle2, AlertCircle, X, Type, Mic, Image,
  Users, Tag, Send, Smartphone, FileText, Loader2, Trash2, Play, RefreshCw,
  Square, Pause, Upload, Library, CircleStop, Pencil, CalendarX2, CalendarClock,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import {
  listBroadcasts, createBroadcast, sendBroadcast, deleteBroadcast, getBroadcast,
  stopBroadcast, updateBroadcast, unscheduleBroadcast,
  listInstances, listTags, listContacts,
  listSavedAudios, getSavedAudio, createSavedAudio,
  type BroadcastItem, type EvolutionInstance, type Tag as TagType, type Contact,
  type SavedAudio, type SavedAudioWithData,
} from "@/lib/api";
import { AudioPlayer } from "@/components/conversas/AudioPlayer";
import { RecordingVisualizer } from "@/components/conversas/RecordingVisualizer";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";

type ContentType = "text" | "audio" | "image" | "document";

interface ContentItemDraft {
  id: string; // local uuid for React key
  message_type: ContentType;
  content: string;
  mediaFile: File | null;
  // For saved/recorded audio (pre-resolved base64)
  savedAudioBase64?: string;
  savedAudioMimetype?: string;
  savedAudioName?: string;
  // For edit mode – reuse media from an existing item without re-uploading
  existingItemId?: string;
  existingMediaMimetype?: string;
  existingMediaFilename?: string;
}

function newDraftItem(): ContentItemDraft {
  return { id: crypto.randomUUID(), message_type: "text", content: "", mediaFile: null };
}

const statusConfig: Record<string, { icon: typeof CheckCircle2; label: string; class: string }> = {
  rascunho: { icon: AlertCircle, label: "Rascunho", class: "text-muted-foreground bg-muted" },
  agendado: { icon: CalendarClock, label: "Agendado", class: "text-chart-4 bg-chart-4/10" },
  enviando: { icon: Loader2, label: "Enviando…", class: "text-chart-4 bg-chart-4/10" },
  concluido: { icon: CheckCircle2, label: "Concluído", class: "text-primary bg-primary/10" },
  erro: { icon: AlertCircle, label: "Erro", class: "text-destructive bg-destructive/10" },
};

const contentOptions: { value: ContentType; label: string; icon: typeof Type }[] = [
  { value: "text", label: "Texto", icon: Type },
  { value: "audio", label: "Áudio", icon: Mic },
  { value: "image", label: "Imagem", icon: Image },
  { value: "document", label: "Documento", icon: FileText },
];

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      resolve(result.split(",")[1]);
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function getAcceptMime(type: ContentType) {
  switch (type) {
    case "audio": return "audio/*";
    case "image": return "image/*";
    case "document": return ".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.csv,.zip";
    default: return "*/*";
  }
}

function typeLabel(t: string) {
  switch (t) {
    case "text": return "Texto";
    case "audio": return "Áudio";
    case "image": return "Imagem";
    case "document": return "Documento";
    default: return t;
  }
}

export default function DisparosPage() {
  // ── Data state ──────────────────────────────────────
  const [broadcasts, setBroadcasts] = useState<BroadcastItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [instances, setInstances] = useState<EvolutionInstance[]>([]);
  const [tags, setTags] = useState<TagType[]>([]);
  const [contacts, setContacts] = useState<Contact[]>([]);

  // ── Modal state ─────────────────────────────────────
  const [showModal, setShowModal] = useState(false);
  const [creating, setCreating] = useState(false);
  const [title, setTitle] = useState("");
  const [items, setItems] = useState<ContentItemDraft[]>([newDraftItem()]);
  const [targetType, setTargetType] = useState<"todos" | "tags" | "manual">("todos");
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [selectedContacts, setSelectedContacts] = useState<string[]>([]);
  const [selectedInstance, setSelectedInstance] = useState("");
  const [contactSearch, setContactSearch] = useState("");
  const [savedAudios, setSavedAudios] = useState<SavedAudio[]>([]);

  // ── Edit mode ───────────────────────────────────────
  const [editingBroadcast, setEditingBroadcast] = useState<BroadcastItem | null>(null);

  // ── Delete dialog ───────────────────────────────────
  const [deleteId, setDeleteId] = useState<string | null>(null);

  // ── Polling for "enviando" broadcasts ───────────────
  const pollRef = useRef<NodeJS.Timeout | null>(null);

  // ── Load data ───────────────────────────────────────
  const loadBroadcasts = useCallback(async () => {
    try {
      const res = await listBroadcasts({ limit: 200 });
      setBroadcasts(res.broadcasts);
    } catch (err: any) {
      toast.error("Erro ao carregar disparos");
    }
  }, []);

  useEffect(() => {
    (async () => {
      setLoading(true);

      try {
        const instRes = await listInstances();
        const open = instRes.filter((i) => i.status === "open");
        setInstances(open);
        if (open.length > 0) setSelectedInstance(open[0].instanceName);
      } catch (e) {
        console.error("Erro ao carregar instâncias:", e);
      }

      try {
        const tagsRes = await listTags();
        setTags(tagsRes);
      } catch (e) {
        console.error("Erro ao carregar tags:", e);
      }

      try {
        const contactsRes = await listContacts({ limit: 5000 });
        setContacts(contactsRes);
      } catch (e) {
        console.error("Erro ao carregar contatos:", e);
      }

      try {
        const audiosRes = await listSavedAudios();
        setSavedAudios(audiosRes);
      } catch (e) {
        console.error("Erro ao carregar áudios salvos:", e);
      }

      await loadBroadcasts();
      setLoading(false);
    })();
  }, [loadBroadcasts]);

  // Poll while any broadcast is "enviando"
  useEffect(() => {
    const hasSending = broadcasts.some((b) => b.status === "enviando");
    if (hasSending && !pollRef.current) {
      pollRef.current = setInterval(loadBroadcasts, 4000);
    }
    if (!hasSending && pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [broadcasts, loadBroadcasts]);

  // ── Item helpers ────────────────────────────────────
  const updateItem = (id: string, patch: Partial<ContentItemDraft>) => {
    setItems((prev) => prev.map((it) => (it.id === id ? { ...it, ...patch } : it)));
  };

  const removeItem = (id: string) => {
    setItems((prev) => {
      const next = prev.filter((it) => it.id !== id);
      return next.length === 0 ? [newDraftItem()] : next;
    });
  };

  const addItem = () => {
    setItems((prev) => [...prev, newDraftItem()]);
  };

  // ── Helpers ─────────────────────────────────────────
  const toggleTag = (id: string) =>
    setSelectedTags((prev) => (prev.includes(id) ? prev.filter((t) => t !== id) : [...prev, id]));

  const toggleContact = (id: string) =>
    setSelectedContacts((prev) => (prev.includes(id) ? prev.filter((c) => c !== id) : [...prev, id]));

  const resetForm = () => {
    setTitle("");
    setItems([newDraftItem()]);
    setTargetType("todos");
    setSelectedTags([]);
    setSelectedContacts([]);
    setContactSearch("");
  };

  const openNewModal = () => {
    resetForm();
    setEditingBroadcast(null);
    if (instances.length > 0) setSelectedInstance(instances[0].instanceName);
    setShowModal(true);
  };

  const openEditModal = (broadcast: BroadcastItem) => {
    setEditingBroadcast(broadcast);
    setTitle(broadcast.title);
    setSelectedInstance(broadcast.connection_id);
    setTargetType(broadcast.target_type as "todos" | "tags" | "manual");
    setSelectedTags(broadcast.tags?.map((t) => t.id) || []);
    setSelectedContacts(broadcast.contact_ids || []);
    setContactSearch("");

    // Map existing items to drafts
    const drafts: ContentItemDraft[] = broadcast.items.map((it) => ({
      id: crypto.randomUUID(),
      message_type: it.message_type as ContentType,
      content: it.content || "",
      mediaFile: null,
      existingItemId: it.id,
      existingMediaMimetype: it.has_media ? (it.media_mimetype || undefined) : undefined,
      existingMediaFilename: it.has_media ? (it.media_filename || undefined) : undefined,
    }));

    setItems(drafts.length > 0 ? drafts : [newDraftItem()]);
    setShowModal(true);
  };

  // ── Actions ─────────────────────────────────────────
  const handleCreate = async () => {
    if (!title.trim()) return;
    if (!selectedInstance) {
      toast.error("Selecione uma conexão");
      return;
    }

    // Validate items
    for (let i = 0; i < items.length; i++) {
      const it = items[i];
      if (it.message_type === "text" && !it.content.trim()) {
        toast.error(`Item ${i + 1}: digite a mensagem`);
        return;
      }
      if (it.message_type !== "text" && !it.mediaFile && !it.savedAudioBase64) {
        toast.error(`Item ${i + 1}: selecione um arquivo`);
        return;
      }
    }

    if (targetType === "tags" && selectedTags.length === 0) {
      toast.error("Selecione pelo menos uma tag");
      return;
    }
    if (targetType === "manual" && selectedContacts.length === 0) {
      toast.error("Selecione pelo menos um contato");
      return;
    }

    setCreating(true);
    try {
      const builtItems = await Promise.all(
        items.map(async (it) => {
          let media_base64: string | undefined;
          let media_mimetype: string | undefined;
          let media_filename: string | undefined;
          if (it.mediaFile) {
            media_base64 = await fileToBase64(it.mediaFile);
            media_mimetype = it.mediaFile.type;
            media_filename = it.mediaFile.name;
          } else if (it.savedAudioBase64) {
            media_base64 = it.savedAudioBase64;
            media_mimetype = it.savedAudioMimetype || "audio/webm;codecs=opus";
            media_filename = it.savedAudioName || "audio.webm";
          }
          return {
            message_type: it.message_type,
            content: it.content || undefined,
            media_base64,
            media_mimetype,
            media_filename,
          };
        })
      );

      const b = await createBroadcast({
        title: title.trim(),
        connection_id: selectedInstance,
        items: builtItems,
        target_type: targetType,
        tag_ids: targetType === "tags" ? selectedTags : undefined,
        contact_ids: targetType === "manual" ? selectedContacts : undefined,
      });

      toast.success(`Disparo "${b.title}" criado como rascunho!`);
      setShowModal(false);
      await loadBroadcasts();
    } catch (err: any) {
      toast.error(err.message || "Erro ao criar disparo");
    } finally {
      setCreating(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    try {
      await deleteBroadcast(deleteId);
      toast.success("Disparo excluído");
      setDeleteId(null);
      await loadBroadcasts();
    } catch (err: any) {
      toast.error(err.message || "Erro ao excluir");
    }
  };

  const handleResend = async (id: string) => {
    try {
      await sendBroadcast(id);
      toast.success("Disparo iniciado");
      await loadBroadcasts();
    } catch (err: any) {
      toast.error(err.message || "Erro ao enviar");
    }
  };

  const handleStop = async (id: string) => {
    try {
      await stopBroadcast(id);
      toast.success("Disparo interrompido");
      await loadBroadcasts();
    } catch (err: any) {
      toast.error(err.message || "Erro ao parar disparo");
    }
  };

  const handleUnschedule = async (id: string) => {
    try {
      await unscheduleBroadcast(id);
      toast.success("Agendamento cancelado");
      await loadBroadcasts();
    } catch (err: any) {
      toast.error(err.message || "Erro ao cancelar agendamento");
    }
  };

  const handleUpdate = async () => {
    if (!editingBroadcast || !title.trim()) return;
    if (!selectedInstance) {
      toast.error("Selecione uma conexão");
      return;
    }

    // Validate items
    for (let i = 0; i < items.length; i++) {
      const it = items[i];
      if (it.message_type === "text" && !it.content.trim()) {
        toast.error(`Item ${i + 1}: digite a mensagem`);
        return;
      }
      if (
        it.message_type !== "text" &&
        !it.mediaFile &&
        !it.savedAudioBase64 &&
        !it.existingItemId
      ) {
        toast.error(`Item ${i + 1}: selecione um arquivo`);
        return;
      }
    }

    if (targetType === "tags" && selectedTags.length === 0) {
      toast.error("Selecione pelo menos uma tag");
      return;
    }
    if (targetType === "manual" && selectedContacts.length === 0) {
      toast.error("Selecione pelo menos um contato");
      return;
    }

    setCreating(true);
    try {
      const builtItems = await Promise.all(
        items.map(async (it) => {
          let media_base64: string | undefined;
          let media_mimetype: string | undefined;
          let media_filename: string | undefined;
          let existing_item_id: string | undefined;

          if (it.mediaFile) {
            media_base64 = await fileToBase64(it.mediaFile);
            media_mimetype = it.mediaFile.type;
            media_filename = it.mediaFile.name;
          } else if (it.savedAudioBase64) {
            media_base64 = it.savedAudioBase64;
            media_mimetype = it.savedAudioMimetype || "audio/webm;codecs=opus";
            media_filename = it.savedAudioName || "audio.webm";
          } else if (it.existingItemId) {
            existing_item_id = it.existingItemId;
          }

          return {
            message_type: it.message_type,
            content: it.content || undefined,
            media_base64,
            media_mimetype,
            media_filename,
            existing_item_id,
          };
        })
      );

      await updateBroadcast(editingBroadcast.id, {
        title: title.trim(),
        connection_id: selectedInstance,
        items: builtItems,
        target_type: targetType,
        tag_ids: targetType === "tags" ? selectedTags : undefined,
        contact_ids: targetType === "manual" ? selectedContacts : undefined,
      });

      toast.success("Disparo atualizado!");
      setShowModal(false);
      setEditingBroadcast(null);
      await loadBroadcasts();
    } catch (err: any) {
      toast.error(err.message || "Erro ao atualizar disparo");
    } finally {
      setCreating(false);
    }
  };

  // Filtered contacts for manual selection
  const filteredContacts = contactSearch
    ? contacts.filter(
        (c) =>
          c.name.toLowerCase().includes(contactSearch.toLowerCase()) ||
          c.phone.includes(contactSearch)
      )
    : contacts;

  return (
    <AppLayout>
      <div className="space-y-6 animate-fade-in">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Disparos</h1>
            <p className="text-muted-foreground mt-1">
              Gerencie suas campanhas de disparo de mensagens
            </p>
          </div>
          <button
            onClick={openNewModal}
            disabled={instances.length === 0}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg bg-primary text-primary-foreground font-medium text-sm hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Plus className="w-4 h-4" />
            Novo Disparo
          </button>
        </div>

        {instances.length === 0 && !loading && (
          <div className="glass-card rounded-xl p-6 text-center text-muted-foreground">
            <Smartphone className="w-8 h-8 mx-auto mb-2 opacity-50" />
            <p className="text-sm">
              Nenhuma conexão ativa. Conecte uma instância WhatsApp na aba
              <strong> Conexões</strong> para criar disparos.
            </p>
          </div>
        )}

        {/* Table */}
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
          </div>
        ) : broadcasts.length === 0 ? (
          <div className="glass-card rounded-xl p-12 text-center">
            <Megaphone className="w-10 h-10 mx-auto mb-3 text-muted-foreground/40" />
            <p className="text-muted-foreground">Nenhum disparo criado ainda</p>
          </div>
        ) : (
          <div className="glass-card rounded-xl overflow-hidden">
            <table className="w-full">
              <thead>
                <tr className="border-b border-border bg-muted/50">
                  <th className="text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider px-5 py-3">Campanha</th>
                  <th className="text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider px-5 py-3">Itens</th>
                  <th className="text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider px-5 py-3">Progresso</th>
                  <th className="text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider px-5 py-3">Status</th>
                  <th className="text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider px-5 py-3">Data</th>
                  <th className="text-right text-xs font-semibold text-muted-foreground uppercase tracking-wider px-5 py-3">Ações</th>
                </tr>
              </thead>
              <tbody>
                {broadcasts.map((d) => {
                  const st = statusConfig[d.status] || statusConfig.rascunho;
                  const StIcon = st.icon;

                  const itemsSummary =
                    d.items.length === 0
                      ? "-"
                      : d.items.length === 1
                        ? typeLabel(d.items[0].message_type)
                        : `${d.items.length} itens`;

                  const progress = d.total_recipients > 0
                    ? `${d.sent_count + d.failed_count}/${d.total_recipients}`
                    : "-";

                  return (
                    <tr key={d.id} className="border-b border-border/50 hover:bg-muted/30 transition-colors">
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
                            <Megaphone className="w-4 h-4 text-primary" />
                          </div>
                          <div>
                            <span className="text-sm font-medium text-foreground block">{d.title}</span>
                            <span className="text-xs text-muted-foreground">{d.connection_id}</span>
                          </div>
                        </div>
                      </td>
                      <td className="px-5 py-4 text-sm text-muted-foreground">{itemsSummary}</td>
                      <td className="px-5 py-4">
                        <span className="text-sm font-medium text-foreground">{progress}</span>
                        {d.failed_count > 0 && (
                          <span className="text-xs text-destructive ml-1">({d.failed_count} falhas)</span>
                        )}
                      </td>
                      <td className="px-5 py-4">
                        <span
                          className={cn(
                            "inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full",
                            st.class
                          )}
                        >
                          <StIcon className={cn("w-3.5 h-3.5", d.status === "enviando" && "animate-spin")} />
                          {st.label}
                        </span>
                      </td>
                      <td className="px-5 py-4 text-sm text-muted-foreground">
                        {d.scheduled_at ? (
                          <div>
                            <span className="block">{new Date(d.scheduled_at).toLocaleDateString("pt-BR")}</span>
                            <span className="text-xs text-chart-4">{new Date(d.scheduled_at).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}</span>
                          </div>
                        ) : (
                          new Date(d.created_at).toLocaleDateString("pt-BR")
                        )}
                      </td>
                      <td className="px-5 py-4 text-right">
                        <div className="flex items-center justify-end gap-1">
                          {d.status !== "enviando" && d.status !== "agendado" && (
                            <button
                              onClick={() => handleResend(d.id)}
                              className="p-1.5 rounded-lg hover:bg-muted transition-colors text-muted-foreground hover:text-primary"
                              title={d.status === "concluido" ? "Enviar novamente" : "Enviar"}
                            >
                              {d.status === "concluido" ? <RefreshCw className="w-4 h-4" /> : <Play className="w-4 h-4" />}
                            </button>
                          )}
                          {d.status === "agendado" && (
                            <>
                              <button
                                onClick={() => handleResend(d.id)}
                                className="p-1.5 rounded-lg hover:bg-muted transition-colors text-muted-foreground hover:text-primary"
                                title="Enviar agora"
                              >
                                <Play className="w-4 h-4" />
                              </button>
                              <button
                                onClick={() => handleUnschedule(d.id)}
                                className="p-1.5 rounded-lg hover:bg-muted transition-colors text-muted-foreground hover:text-chart-4"
                                title="Cancelar agendamento"
                              >
                                <CalendarX2 className="w-4 h-4" />
                              </button>
                            </>
                          )}
                          {d.status !== "enviando" && (
                            <button
                              onClick={() => openEditModal(d)}
                              className="p-1.5 rounded-lg hover:bg-muted transition-colors text-muted-foreground hover:text-foreground"
                              title="Editar"
                            >
                              <Pencil className="w-4 h-4" />
                            </button>
                          )}
                          {d.status === "enviando" && (
                            <button
                              onClick={() => handleStop(d.id)}
                              className="p-1.5 rounded-lg hover:bg-muted transition-colors text-muted-foreground hover:text-destructive"
                              title="Parar envio"
                            >
                              <CircleStop className="w-4 h-4" />
                            </button>
                          )}
                          {d.status !== "enviando" && (
                            <button
                              onClick={() => setDeleteId(d.id)}
                              className="p-1.5 rounded-lg hover:bg-muted transition-colors text-muted-foreground hover:text-destructive"
                              title="Excluir"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ── New Disparo Modal ──────────────────────────── */}
      <Dialog open={showModal} onOpenChange={setShowModal}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingBroadcast ? "Editar Disparo" : "Novo Disparo"}</DialogTitle>
            <DialogDescription>
              {editingBroadcast
                ? "Edite os dados da campanha. As alterações serão salvas como rascunho."
                : "Crie uma campanha de disparo de mensagens. Você pode adicionar vários itens de conteúdo (texto, áudio, imagem, documento) — cada um será enviado como uma mensagem separada por contato, com intervalo entre si."}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {/* Connection */}
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-foreground">Conexão de envio</label>
              {instances.length === 0 ? (
                <p className="text-sm text-muted-foreground">Nenhuma conexão ativa</p>
              ) : (
                <div className="grid grid-cols-2 gap-2">
                  {instances.map((inst) => (
                    <button
                      key={inst.instanceName}
                      onClick={() => setSelectedInstance(inst.instanceName)}
                      className={cn(
                        "flex items-center gap-2 p-3 rounded-xl border transition-all text-left",
                        selectedInstance === inst.instanceName
                          ? "border-primary bg-primary/5 ring-1 ring-primary"
                          : "border-border hover:bg-muted/60"
                      )}
                    >
                      <Smartphone
                        className={cn(
                          "w-5 h-5",
                          selectedInstance === inst.instanceName
                            ? "text-primary"
                            : "text-muted-foreground"
                        )}
                      />
                      <div className="min-w-0">
                        <span
                          className={cn(
                            "text-sm font-medium block truncate",
                            selectedInstance === inst.instanceName
                              ? "text-primary"
                              : "text-foreground"
                          )}
                        >
                          {inst.profileName || inst.instanceName}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          {inst.number || inst.instanceName}
                        </span>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Title */}
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-foreground">Título da campanha</label>
              <input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Ex: Promoção de Natal"
                className="w-full bg-muted/50 border border-border rounded-lg px-4 py-2.5 text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/30 transition-all"
              />
            </div>

            {/* ── Content items ────────────────────────── */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <label className="text-sm font-medium text-foreground">
                  Conteúdo ({items.length} {items.length === 1 ? "item" : "itens"})
                </label>
                <button
                  type="button"
                  onClick={addItem}
                  className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:text-primary/80 transition-colors"
                >
                  <Plus className="w-3.5 h-3.5" />
                  Adicionar item
                </button>
              </div>

              {items.map((item, idx) => (
                <ContentItemEditor
                  key={item.id}
                  item={item}
                  index={idx}
                  canRemove={items.length > 1}
                  onUpdate={(patch) => updateItem(item.id, patch)}
                  onRemove={() => removeItem(item.id)}
                  savedAudios={savedAudios}
                />
              ))}
            </div>

            {/* Recipients */}
            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground">Destinatários</label>
              <div className="grid grid-cols-3 gap-2">
                <button
                  onClick={() => {
                    setTargetType("todos");
                    setSelectedTags([]);
                    setSelectedContacts([]);
                  }}
                  className={cn(
                    "flex items-center gap-2 p-3 rounded-xl border transition-all",
                    targetType === "todos"
                      ? "border-primary bg-primary/5 ring-1 ring-primary"
                      : "border-border hover:bg-muted/60"
                  )}
                >
                  <Users
                    className={cn(
                      "w-5 h-5",
                      targetType === "todos" ? "text-primary" : "text-muted-foreground"
                    )}
                  />
                  <span
                    className={cn(
                      "text-sm font-medium",
                      targetType === "todos" ? "text-primary" : "text-muted-foreground"
                    )}
                  >
                    Todos
                  </span>
                </button>
                <button
                  onClick={() => {
                    setTargetType("tags");
                    setSelectedContacts([]);
                  }}
                  className={cn(
                    "flex items-center gap-2 p-3 rounded-xl border transition-all",
                    targetType === "tags"
                      ? "border-primary bg-primary/5 ring-1 ring-primary"
                      : "border-border hover:bg-muted/60"
                  )}
                >
                  <Tag
                    className={cn(
                      "w-5 h-5",
                      targetType === "tags" ? "text-primary" : "text-muted-foreground"
                    )}
                  />
                  <span
                    className={cn(
                      "text-sm font-medium",
                      targetType === "tags" ? "text-primary" : "text-muted-foreground"
                    )}
                  >
                    Tags
                  </span>
                </button>
                <button
                  onClick={() => {
                    setTargetType("manual");
                    setSelectedTags([]);
                  }}
                  className={cn(
                    "flex items-center gap-2 p-3 rounded-xl border transition-all",
                    targetType === "manual"
                      ? "border-primary bg-primary/5 ring-1 ring-primary"
                      : "border-border hover:bg-muted/60"
                  )}
                >
                  <Users
                    className={cn(
                      "w-5 h-5",
                      targetType === "manual" ? "text-primary" : "text-muted-foreground"
                    )}
                  />
                  <span
                    className={cn(
                      "text-sm font-medium",
                      targetType === "manual" ? "text-primary" : "text-muted-foreground"
                    )}
                  >
                    Manual
                  </span>
                </button>
              </div>

              {/* Tag selection */}
              {targetType === "tags" && (
                <div className="flex flex-wrap gap-2 pt-1">
                  {tags.length === 0 ? (
                    <p className="text-xs text-muted-foreground">Nenhuma tag cadastrada</p>
                  ) : (
                    tags.map((t) => (
                      <button
                        key={t.id}
                        onClick={() => toggleTag(t.id)}
                        className={cn(
                          "text-xs font-medium px-3 py-1.5 rounded-full border transition-colors",
                          selectedTags.includes(t.id)
                            ? "text-white border-transparent"
                            : "bg-muted text-muted-foreground border-border hover:border-primary/20"
                        )}
                        style={
                          selectedTags.includes(t.id)
                            ? { backgroundColor: t.color }
                            : {}
                        }
                      >
                        {t.name}
                      </button>
                    ))
                  )}
                </div>
              )}

              {/* Manual contact selection */}
              {targetType === "manual" && (
                <div className="space-y-2 pt-1">
                  <input
                    value={contactSearch}
                    onChange={(e) => setContactSearch(e.target.value)}
                    placeholder="Buscar contato..."
                    className="w-full bg-muted/50 border border-border rounded-lg px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-primary/20"
                  />
                  {selectedContacts.length > 0 && (
                    <p className="text-xs text-muted-foreground">
                      {selectedContacts.length} contato(s) selecionado(s)
                    </p>
                  )}
                  <div className="max-h-40 overflow-y-auto space-y-1 border border-border rounded-lg p-2">
                    {filteredContacts.slice(0, 100).map((c) => (
                      <button
                        key={c.id}
                        onClick={() => toggleContact(c.id)}
                        className={cn(
                          "w-full flex items-center gap-2 px-2 py-1.5 rounded-lg text-left transition-colors text-sm",
                          selectedContacts.includes(c.id)
                            ? "bg-primary/10 text-primary"
                            : "hover:bg-muted/60 text-foreground"
                        )}
                      >
                        <div
                          className={cn(
                            "w-4 h-4 rounded border flex items-center justify-center flex-shrink-0",
                            selectedContacts.includes(c.id)
                              ? "bg-primary border-primary"
                              : "border-border"
                          )}
                        >
                          {selectedContacts.includes(c.id) && (
                            <CheckCircle2 className="w-3 h-3 text-primary-foreground" />
                          )}
                        </div>
                        <span className="truncate">{c.name}</span>
                        <span className="text-xs text-muted-foreground ml-auto flex-shrink-0">
                          {c.phone}
                        </span>
                      </button>
                    ))}
                    {filteredContacts.length === 0 && (
                      <p className="text-xs text-muted-foreground text-center py-2">
                        Nenhum contato encontrado
                      </p>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => { setShowModal(false); setEditingBroadcast(null); }} disabled={creating}>
              Cancelar
            </Button>
            <Button onClick={editingBroadcast ? handleUpdate : handleCreate} disabled={!title.trim() || creating}>
              {creating ? (
                <Loader2 className="w-4 h-4 mr-1.5 animate-spin" />
              ) : editingBroadcast ? (
                <CheckCircle2 className="w-4 h-4 mr-1.5" />
              ) : (
                <Plus className="w-4 h-4 mr-1.5" />
              )}
              {creating ? "Salvando…" : editingBroadcast ? "Salvar Alterações" : "Criar Disparo"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete confirmation */}
      <AlertDialog open={!!deleteId} onOpenChange={(open) => !open && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir disparo?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação não pode ser desfeita. O disparo e todos os registros de envio serão
              removidos permanentemente.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AppLayout>
  );
}

/* ── Sub-component: single content item editor ──────── */
type AudioTab = "upload" | "record" | "saved";

function ContentItemEditor({
  item,
  index,
  canRemove,
  onUpdate,
  onRemove,
  savedAudios,
}: {
  item: ContentItemDraft;
  index: number;
  canRemove: boolean;
  onUpdate: (patch: Partial<ContentItemDraft>) => void;
  onRemove: () => void;
  savedAudios: SavedAudio[];
}) {
  const fileInputRef = useRef<HTMLInputElement>(null);

  // ── Audio sub-state ──
  const [audioTab, setAudioTab] = useState<AudioTab>("upload");
  const [isRecording, setIsRecording] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [recordTime, setRecordTime] = useState(0);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const audioStreamRef = useRef<MediaStream | null>(null);
  const recordIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [loadingSavedId, setLoadingSavedId] = useState<string | null>(null);

  const formatTime = (s: number) => {
    const m = Math.floor(s / 60);
    const ss = s % 60;
    return `${m}:${ss.toString().padStart(2, "0")}`;
  };

  const stopRecordingCleanup = () => {
    if (recordIntervalRef.current) { clearInterval(recordIntervalRef.current); recordIntervalRef.current = null; }
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

      const recorder = new MediaRecorder(stream, { mimeType: "audio/webm;codecs=opus" });
      mediaRecorderRef.current = recorder;
      recorder.ondataavailable = (e) => { if (e.data.size > 0) audioChunksRef.current.push(e.data); };

      recorder.onstop = () => {
        const mime = recorder.mimeType || "audio/webm;codecs=opus";
        const blob = new Blob(audioChunksRef.current, { type: mime });
        const reader = new FileReader();
        reader.onload = () => {
          const result = reader.result as string;
          const b64 = result.includes(",") ? result.split(",")[1] : result;
          onUpdate({
            mediaFile: null,
            savedAudioBase64: b64,
            savedAudioMimetype: mime,
            savedAudioName: `gravacao-${Date.now()}.webm`,
          });
        };
        reader.readAsDataURL(blob);
        stopRecordingCleanup();
      };

      recorder.start(250);
      setIsRecording(true);
      setIsPaused(false);
      recordIntervalRef.current = setInterval(() => setRecordTime((t) => t + 1), 1000);
    } catch {
      toast.error("Não foi possível acessar o microfone.");
    }
  };

  const pauseRecording = () => {
    if (mediaRecorderRef.current?.state === "recording") mediaRecorderRef.current.pause();
    setIsPaused(true);
    if (recordIntervalRef.current) { clearInterval(recordIntervalRef.current); recordIntervalRef.current = null; }
  };

  const resumeRecording = () => {
    if (mediaRecorderRef.current?.state === "paused") mediaRecorderRef.current.resume();
    setIsPaused(false);
    recordIntervalRef.current = setInterval(() => setRecordTime((t) => t + 1), 1000);
  };

  const cancelRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
      mediaRecorderRef.current.onstop = null;
      mediaRecorderRef.current.stop();
    }
    audioChunksRef.current = [];
    setRecordTime(0);
    stopRecordingCleanup();
  };

  const finishRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
      mediaRecorderRef.current.stop(); // triggers onstop → sets savedAudioBase64
    }
  };

  const pickSavedAudio = async (audio: SavedAudio) => {
    setLoadingSavedId(audio.id);
    try {
      const full = await getSavedAudio(audio.id);
      onUpdate({
        mediaFile: null,
        savedAudioBase64: full.audio_base64,
        savedAudioMimetype: full.mimetype,
        savedAudioName: `${audio.title}.webm`,
      });
    } catch {
      toast.error("Erro ao carregar áudio salvo");
    } finally {
      setLoadingSavedId(null);
    }
  };

  const hasAudio = !!(item.mediaFile || item.savedAudioBase64 || (item.existingItemId && item.existingMediaMimetype?.startsWith("audio")));

  // Build a playable URL for the selected/recorded audio
  const [audioSrcUrl, setAudioSrcUrl] = useState<string | null>(null);
  useEffect(() => {
    // Revoke previous object URL to avoid memory leaks
    return () => {
      if (audioSrcUrl && audioSrcUrl.startsWith("blob:")) {
        URL.revokeObjectURL(audioSrcUrl);
      }
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [audioSrcUrl]);

  useEffect(() => {
    if (item.mediaFile) {
      const url = URL.createObjectURL(item.mediaFile);
      setAudioSrcUrl(url);
    } else if (item.savedAudioBase64) {
      const mime = item.savedAudioMimetype || "audio/webm;codecs=opus";
      setAudioSrcUrl(`data:${mime};base64,${item.savedAudioBase64}`);
    } else {
      setAudioSrcUrl(null);
    }
  }, [item.mediaFile, item.savedAudioBase64, item.savedAudioMimetype]);

  const clearAudio = () => {
    onUpdate({
      mediaFile: null,
      savedAudioBase64: undefined,
      savedAudioMimetype: undefined,
      savedAudioName: undefined,
      existingItemId: undefined,
      existingMediaMimetype: undefined,
      existingMediaFilename: undefined,
    });
  };

  return (
    <div className="border border-border rounded-xl p-3 space-y-2.5 bg-muted/20">
      {/* Header */}
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
          Item {index + 1}
        </span>
        {canRemove && (
          <button
            type="button"
            onClick={onRemove}
            className="p-1 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors"
            title="Remover item"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* Type selector */}
      <div className="flex gap-1.5 flex-wrap">
        {contentOptions.map((opt) => {
          const isActive = item.message_type === opt.value;
          return (
            <button
              key={opt.value}
              type="button"
              onClick={() => onUpdate({ message_type: opt.value, mediaFile: null, savedAudioBase64: undefined, savedAudioMimetype: undefined, savedAudioName: undefined })}
              className={cn(
                "flex items-center gap-1 px-2.5 py-1.5 rounded-lg border text-xs font-medium transition-all",
                isActive
                  ? "border-primary bg-primary/5 text-primary"
                  : "border-border text-muted-foreground hover:bg-muted"
              )}
            >
              <opt.icon className="w-3.5 h-3.5" />
              {opt.label}
            </button>
          );
        })}
      </div>

      {/* Text / caption */}
      <textarea
        value={item.content}
        onChange={(e) => onUpdate({ content: e.target.value })}
        placeholder={
          item.message_type === "text"
            ? "Digite a mensagem…"
            : "Legenda para a mídia (opcional)…"
        }
        rows={2}
        className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/30 transition-all resize-none"
      />

      {/* ── Audio-specific section with tabs ── */}
      {item.message_type === "audio" && (
        <>
          {hasAudio && audioSrcUrl ? (
            /* Audio already chosen – show player like in conversations */
            <div className="rounded-lg border border-border bg-background">
              <div className="flex items-center gap-1">
                <div className="flex-1 min-w-0">
                  <AudioPlayer src={audioSrcUrl} sent={false} />
                </div>
                <button type="button" onClick={clearAudio} className="p-1.5 mr-2 rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors flex-shrink-0" title="Remover áudio">
                  <X className="w-4 h-4" />
                </button>
              </div>
              <div className="px-3 pb-2 -mt-1">
                <span className="text-[10px] text-muted-foreground truncate block">
                  {item.mediaFile?.name || item.savedAudioName || "Áudio gravado"}
                </span>
              </div>
            </div>
          ) : hasAudio && item.existingItemId ? (
            /* Existing audio from server (no base64 available for preview) */
            <div className="flex items-center gap-3 p-2.5 rounded-lg border border-border bg-background">
              <Mic className="w-4 h-4 text-primary flex-shrink-0" />
              <span className="text-xs text-foreground truncate flex-1">
                {item.existingMediaFilename || "Áudio existente"}
              </span>
              <span className="text-[10px] text-muted-foreground">(mantido)</span>
              <button
                type="button"
                onClick={clearAudio}
                className="text-muted-foreground hover:text-destructive flex-shrink-0"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          ) : isRecording ? (
            /* Recording in progress */
            <div className="flex items-center gap-3 p-3 rounded-lg border border-primary/30 bg-primary/5">
              <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
              <span className="text-sm font-medium text-foreground tabular-nums">{formatTime(recordTime)}</span>
              <RecordingVisualizer stream={audioStreamRef.current} isPaused={isPaused} />
              {!isPaused ? (
                <button type="button" onClick={pauseRecording} className="p-1.5 rounded-lg hover:bg-muted transition-colors text-muted-foreground" title="Pausar">
                  <Pause className="w-4 h-4" />
                </button>
              ) : (
                <button type="button" onClick={resumeRecording} className="p-1.5 rounded-lg hover:bg-muted transition-colors text-primary" title="Retomar">
                  <Play className="w-4 h-4" />
                </button>
              )}
              <button type="button" onClick={cancelRecording} className="p-1.5 rounded-lg hover:bg-destructive/10 transition-colors text-muted-foreground hover:text-destructive" title="Cancelar">
                <X className="w-4 h-4" />
              </button>
              <button type="button" onClick={finishRecording} className="p-1.5 rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 transition-colors" title="Concluir gravação">
                <CheckCircle2 className="w-4 h-4" />
              </button>
            </div>
          ) : (
            /* Audio source tabs */
            <div className="space-y-2">
              {/* Tab bar */}
              <div className="flex gap-1 bg-muted rounded-lg p-0.5">
                {([
                  { key: "upload" as AudioTab, label: "Arquivo", icon: Upload },
                  { key: "record" as AudioTab, label: "Gravar", icon: Mic },
                  { key: "saved" as AudioTab, label: "Salvos", icon: Library },
                ] as const).map((t) => (
                  <button
                    key={t.key}
                    type="button"
                    onClick={() => setAudioTab(t.key)}
                    className={cn(
                      "flex-1 flex items-center justify-center gap-1 px-2 py-1.5 rounded-md text-xs font-medium transition-all",
                      audioTab === t.key
                        ? "bg-background text-foreground shadow-sm"
                        : "text-muted-foreground hover:text-foreground"
                    )}
                  >
                    <t.icon className="w-3.5 h-3.5" />
                    {t.label}
                  </button>
                ))}
              </div>

              {/* Tab content */}
              {audioTab === "upload" && (
                <>
                  <input ref={fileInputRef} type="file" accept={getAcceptMime("audio")} className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) onUpdate({ mediaFile: f, savedAudioBase64: undefined, savedAudioMimetype: undefined, savedAudioName: undefined }); }} />
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="w-full flex items-center gap-2 py-3 border-2 border-dashed border-border rounded-lg hover:border-primary/30 hover:bg-primary/5 transition-all justify-center"
                  >
                    <Upload className="w-4 h-4 text-muted-foreground" />
                    <span className="text-xs text-muted-foreground">Selecionar áudio (MP3, OGG, WAV)</span>
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
                  <span className="text-xs text-muted-foreground">Clique para começar a gravar</span>
                </button>
              )}

              {audioTab === "saved" && (
                <div className="max-h-40 overflow-y-auto space-y-1 border border-border rounded-lg p-1.5">
                  {savedAudios.length === 0 ? (
                    <p className="text-xs text-muted-foreground text-center py-3">Nenhum áudio salvo</p>
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
                        <span className="text-xs text-foreground truncate flex-1">{a.title}</span>
                        {a.duration && <span className="text-[10px] text-muted-foreground tabular-nums">{a.duration}</span>}
                      </button>
                    ))
                  )}
                </div>
              )}
            </div>
          )}
        </>
      )}

      {/* File upload for image / document */}
      {item.message_type !== "text" && item.message_type !== "audio" && (
        <>
          <input
            ref={fileInputRef}
            type="file"
            accept={getAcceptMime(item.message_type)}
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) onUpdate({ mediaFile: f, existingItemId: undefined, existingMediaMimetype: undefined, existingMediaFilename: undefined });
            }}
          />
          {item.mediaFile ? (
            <div className="flex items-center gap-3 p-2.5 rounded-lg border border-border bg-background">
              {item.message_type === "image" && <Image className="w-4 h-4 text-primary flex-shrink-0" />}
              {item.message_type === "document" && <FileText className="w-4 h-4 text-primary flex-shrink-0" />}
              <span className="text-xs text-foreground truncate flex-1">
                {item.mediaFile.name}
              </span>
              <button
                type="button"
                onClick={() => onUpdate({ mediaFile: null })}
                className="text-muted-foreground hover:text-destructive flex-shrink-0"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          ) : item.existingItemId && item.existingMediaFilename ? (
            <div className="flex items-center gap-3 p-2.5 rounded-lg border border-border bg-background">
              {item.message_type === "image" && <Image className="w-4 h-4 text-primary flex-shrink-0" />}
              {item.message_type === "document" && <FileText className="w-4 h-4 text-primary flex-shrink-0" />}
              <span className="text-xs text-foreground truncate flex-1">
                {item.existingMediaFilename}
              </span>
              <span className="text-[10px] text-muted-foreground">(mantido)</span>
              <button
                type="button"
                onClick={() => onUpdate({ existingItemId: undefined, existingMediaMimetype: undefined, existingMediaFilename: undefined })}
                className="text-muted-foreground hover:text-destructive flex-shrink-0"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="w-full flex items-center gap-2 py-3 border-2 border-dashed border-border rounded-lg hover:border-primary/30 hover:bg-primary/5 transition-all justify-center"
            >
              {item.message_type === "image" && <Image className="w-4 h-4 text-muted-foreground" />}
              {item.message_type === "document" && <FileText className="w-4 h-4 text-muted-foreground" />}
              <span className="text-xs text-muted-foreground">
                {item.message_type === "image" && "Selecionar imagem (JPG, PNG, WEBP)"}
                {item.message_type === "document" && "Selecionar documento (PDF, DOC, XLS…)"}
              </span>
            </button>
          )}
        </>
      )}
    </div>
  );
}
