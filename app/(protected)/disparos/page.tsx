"use client";

import { AppLayout } from "@/components/AppLayout";
import { useEffect, useState, useCallback, useRef } from "react";
import {
  Megaphone, Plus, Clock, CheckCircle2, AlertCircle, X, Type, Mic, Image,
  Users, Tag, Send, Smartphone, FileText, Loader2, Trash2, Play, RefreshCw,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import {
  listBroadcasts, createBroadcast, sendBroadcast, deleteBroadcast, getBroadcast,
  listInstances, listTags, listContacts,
  type BroadcastItem, type EvolutionInstance, type Tag as TagType, type Contact,
} from "@/lib/api";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";

type ContentType = "text" | "audio" | "image" | "document";

const statusConfig: Record<string, { icon: typeof CheckCircle2; label: string; class: string }> = {
  rascunho: { icon: AlertCircle, label: "Rascunho", class: "text-muted-foreground bg-muted" },
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
      // strip "data:...;base64," prefix
      resolve(result.split(",")[1]);
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
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
  const [contentType, setContentType] = useState<ContentType>("text");
  const [message, setMessage] = useState("");
  const [targetType, setTargetType] = useState<"todos" | "tags" | "manual">("todos");
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [selectedContacts, setSelectedContacts] = useState<string[]>([]);
  const [selectedInstance, setSelectedInstance] = useState("");
  const [mediaFile, setMediaFile] = useState<File | null>(null);
  const [contactSearch, setContactSearch] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

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
        const [instRes, tagsRes, contactsRes] = await Promise.all([
          listInstances(),
          listTags(),
          listContacts({ limit: 5000 }),
        ]);
        setInstances(instRes.filter((i) => i.status === "open"));
        setTags(tagsRes);
        setContacts(contactsRes);
        if (instRes.length > 0) {
          const open = instRes.find((i) => i.status === "open");
          if (open) setSelectedInstance(open.instanceName);
        }
      } catch {}
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

  // ── Helpers ─────────────────────────────────────────
  const toggleTag = (id: string) =>
    setSelectedTags((prev) => (prev.includes(id) ? prev.filter((t) => t !== id) : [...prev, id]));

  const toggleContact = (id: string) =>
    setSelectedContacts((prev) => (prev.includes(id) ? prev.filter((c) => c !== id) : [...prev, id]));

  const resetForm = () => {
    setTitle("");
    setContentType("text");
    setMessage("");
    setTargetType("todos");
    setSelectedTags([]);
    setSelectedContacts([]);
    setMediaFile(null);
    setContactSearch("");
  };

  const openNewModal = () => {
    resetForm();
    if (instances.length > 0) setSelectedInstance(instances[0].instanceName);
    setShowModal(true);
  };

  // ── Actions ─────────────────────────────────────────
  const handleCreate = async () => {
    if (!title.trim()) return;
    if (!selectedInstance) {
      toast.error("Selecione uma conexão");
      return;
    }
    if (contentType === "text" && !message.trim()) {
      toast.error("Digite a mensagem");
      return;
    }
    if (contentType !== "text" && !mediaFile) {
      toast.error("Selecione um arquivo");
      return;
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
      let media_base64: string | undefined;
      let media_mimetype: string | undefined;
      let media_filename: string | undefined;

      if (mediaFile) {
        media_base64 = await fileToBase64(mediaFile);
        media_mimetype = mediaFile.type;
        media_filename = mediaFile.name;
      }

      const b = await createBroadcast({
        title: title.trim(),
        connection_id: selectedInstance,
        message_type: contentType,
        content: message || undefined,
        media_base64,
        media_mimetype,
        media_filename,
        target_type: targetType,
        tag_ids: targetType === "tags" ? selectedTags : undefined,
        contact_ids: targetType === "manual" ? selectedContacts : undefined,
      });

      // Immediately send
      await sendBroadcast(b.id);

      toast.success(`Disparo "${b.title}" criado e iniciado!`);
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
      toast.success("Disparo reiniciado");
      await loadBroadcasts();
    } catch (err: any) {
      toast.error(err.message || "Erro ao reenviar");
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

  const getAcceptMime = () => {
    switch (contentType) {
      case "audio": return "audio/*";
      case "image": return "image/*";
      case "document": return ".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.csv,.zip";
      default: return "*/*";
    }
  };

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
                  <th className="text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider px-5 py-3">Tipo</th>
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
                  const typeLabel =
                    d.message_type === "text" ? "Texto" :
                    d.message_type === "audio" ? "Áudio" :
                    d.message_type === "image" ? "Imagem" : "Documento";
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
                      <td className="px-5 py-4 text-sm text-muted-foreground">{typeLabel}</td>
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
                        {new Date(d.created_at).toLocaleDateString("pt-BR")}
                      </td>
                      <td className="px-5 py-4 text-right">
                        <div className="flex items-center justify-end gap-1">
                          {(d.status === "rascunho" || d.status === "erro") && (
                            <button
                              onClick={() => handleResend(d.id)}
                              className="p-1.5 rounded-lg hover:bg-muted transition-colors text-muted-foreground hover:text-primary"
                              title="Enviar"
                            >
                              <Play className="w-4 h-4" />
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
            <DialogTitle>Novo Disparo</DialogTitle>
            <DialogDescription>
              Crie e envie uma campanha de disparo de mensagens.
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

            {/* Content type */}
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-foreground">Tipo de conteúdo</label>
              <div className="flex gap-2 flex-wrap">
                {contentOptions.map((opt) => {
                  const isActive = contentType === opt.value;
                  return (
                    <button
                      key={opt.value}
                      onClick={() => {
                        setContentType(opt.value);
                        setMediaFile(null);
                      }}
                      className={cn(
                        "flex items-center gap-1.5 px-3 py-2 rounded-lg border text-sm font-medium transition-all",
                        isActive
                          ? "border-primary bg-primary/5 text-primary"
                          : "border-border text-muted-foreground hover:bg-muted"
                      )}
                    >
                      <opt.icon className="w-4 h-4" />
                      {opt.label}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Text content (always available for caption with media) */}
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-foreground">
                {contentType === "text" ? "Mensagem" : "Legenda (opcional)"}
              </label>
              <textarea
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder={
                  contentType === "text"
                    ? "Digite a mensagem..."
                    : "Legenda para a mídia (opcional)..."
                }
                rows={3}
                className="w-full bg-muted/50 border border-border rounded-lg px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/30 transition-all resize-none"
              />
            </div>

            {/* File upload (audio, image, document) */}
            {contentType !== "text" && (
              <div className="space-y-1.5">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept={getAcceptMime()}
                  className="hidden"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) setMediaFile(f);
                  }}
                />
                {mediaFile ? (
                  <div className="flex items-center gap-3 p-3 rounded-xl border border-border bg-muted/30">
                    {contentType === "audio" && <Mic className="w-5 h-5 text-primary" />}
                    {contentType === "image" && <Image className="w-5 h-5 text-primary" />}
                    {contentType === "document" && <FileText className="w-5 h-5 text-primary" />}
                    <span className="text-sm text-foreground truncate flex-1">
                      {mediaFile.name}
                    </span>
                    <button
                      onClick={() => setMediaFile(null)}
                      className="text-muted-foreground hover:text-destructive"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    className="w-full flex items-center gap-2 py-4 border-2 border-dashed border-border rounded-lg hover:border-primary/30 hover:bg-primary/5 transition-all justify-center"
                  >
                    {contentType === "audio" && <Mic className="w-5 h-5 text-muted-foreground" />}
                    {contentType === "image" && <Image className="w-5 h-5 text-muted-foreground" />}
                    {contentType === "document" && <FileText className="w-5 h-5 text-muted-foreground" />}
                    <span className="text-sm text-muted-foreground">
                      {contentType === "audio" && "Selecionar áudio (MP3, OGG, WAV)"}
                      {contentType === "image" && "Selecionar imagem (JPG, PNG, WEBP)"}
                      {contentType === "document" && "Selecionar documento (PDF, DOC, XLS…)"}
                    </span>
                  </button>
                )}
              </div>
            )}

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
            <Button variant="outline" onClick={() => setShowModal(false)} disabled={creating}>
              Cancelar
            </Button>
            <Button onClick={handleCreate} disabled={!title.trim() || creating}>
              {creating ? (
                <Loader2 className="w-4 h-4 mr-1.5 animate-spin" />
              ) : (
                <Send className="w-4 h-4 mr-1.5" />
              )}
              {creating ? "Criando…" : "Criar e Enviar"}
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
