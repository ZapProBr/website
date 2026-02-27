"use client";

import { useEffect, useState, useCallback } from "react";
import { AppLayout } from "@/components/AppLayout";
import {
  CalendarDays, Plus, Clock, Megaphone, Loader2, Trash2, Send,
  CalendarX2, Play, CheckCircle2, Type, Mic, Image, FileText, Users, Tag,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { toast } from "sonner";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import {
  listBroadcasts, scheduleBroadcast, unscheduleBroadcast, sendBroadcast,
  deleteBroadcast,
  type BroadcastItem,
} from "@/lib/api";

function typeLabel(t: string) {
  switch (t) {
    case "text": return "Texto";
    case "audio": return "Áudio";
    case "image": return "Imagem";
    case "document": return "Documento";
    default: return t;
  }
}

function typeIcon(t: string) {
  switch (t) {
    case "text": return Type;
    case "audio": return Mic;
    case "image": return Image;
    case "document": return FileText;
    default: return Type;
  }
}

function targetLabel(b: BroadcastItem) {
  if (b.target_type === "todos") return "Todos os contatos";
  if (b.target_type === "tags" && b.tags.length > 0) return b.tags.map((t) => t.name).join(", ");
  if (b.target_type === "manual") return `${b.contact_ids.length} contatos`;
  return b.target_type;
}

export default function DisparoAgendamentoPage() {
  const [broadcasts, setBroadcasts] = useState<BroadcastItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [scheduling, setScheduling] = useState(false);

  // Modal state
  const [selectedBroadcastId, setSelectedBroadcastId] = useState("");
  const [date, setDate] = useState<Date>();
  const [time, setTime] = useState("09:00");

  const loadBroadcasts = useCallback(async () => {
    try {
      const res = await listBroadcasts({ limit: 200 });
      setBroadcasts(res.broadcasts);
    } catch {
      toast.error("Erro ao carregar disparos");
    }
  }, []);

  useEffect(() => {
    (async () => {
      setLoading(true);
      await loadBroadcasts();
      setLoading(false);
    })();
  }, [loadBroadcasts]);

  // Derived lists
  const schedulable = broadcasts.filter((b) =>
    b.status === "rascunho" || b.status === "erro" || b.status === "concluido"
  );
  const scheduled = broadcasts.filter((b) => b.status === "agendado");
  const sentScheduled = broadcasts.filter(
    (b) => b.status === "concluido" && b.total_recipients > 0
  );

  const resetModal = () => {
    setSelectedBroadcastId("");
    setDate(undefined);
    setTime("09:00");
  };

  const handleSchedule = async () => {
    if (!selectedBroadcastId || !date) return;

    // Combine date + time into ISO string (user's local timezone)
    const [hours, minutes] = time.split(":").map(Number);
    const scheduled = new Date(date);
    scheduled.setHours(hours, minutes, 0, 0);

    if (scheduled <= new Date()) {
      toast.error("A data/hora deve ser no futuro");
      return;
    }

    setScheduling(true);
    try {
      await scheduleBroadcast(selectedBroadcastId, scheduled.toISOString());
      toast.success("Disparo agendado!");
      setShowModal(false);
      resetModal();
      await loadBroadcasts();
    } catch (err: any) {
      toast.error(err.message || "Erro ao agendar");
    } finally {
      setScheduling(false);
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

  const handleSendNow = async (id: string) => {
    try {
      await sendBroadcast(id);
      toast.success("Disparo iniciado");
      await loadBroadcasts();
    } catch (err: any) {
      toast.error(err.message || "Erro ao enviar");
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteBroadcast(id);
      toast.success("Disparo excluído");
      await loadBroadcasts();
    } catch (err: any) {
      toast.error(err.message || "Erro ao excluir");
    }
  };

  return (
    <AppLayout>
      <div className="space-y-6 animate-fade-in">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Agendamento de Disparos</h1>
            <p className="text-muted-foreground mt-1">
              Programe o envio automático de disparos com data e hora
            </p>
          </div>
          <button
            onClick={() => { resetModal(); setShowModal(true); }}
            disabled={schedulable.length === 0}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg bg-primary text-primary-foreground font-medium text-sm hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Plus className="w-4 h-4" />
            Novo Agendamento
          </button>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <>
            {/* Scheduled broadcasts */}
            {scheduled.length === 0 && sentScheduled.length === 0 ? (
              <div className="glass-card rounded-xl p-12 flex flex-col items-center justify-center text-center">
                <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center mb-4">
                  <CalendarDays className="w-8 h-8 text-primary" />
                </div>
                <h3 className="text-lg font-semibold text-foreground mb-2">Nenhum agendamento</h3>
                <p className="text-sm text-muted-foreground max-w-md">
                  {schedulable.length > 0
                    ? "Crie um agendamento selecionando um disparo existente e definindo data e hora."
                    : "Crie um disparo na aba Disparos para poder agendar."}
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                {/* Active schedules */}
                {scheduled.length > 0 && (
                  <div className="space-y-3">
                    <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
                      Agendamentos ativos ({scheduled.length})
                    </h2>
                    <div className="grid gap-3">
                      {scheduled.map((b) => {
                        const ItemIcon = b.items.length > 0 ? typeIcon(b.items[0].message_type) : Megaphone;
                        const itemsSummary =
                          b.items.length === 0
                            ? "-"
                            : b.items.length === 1
                              ? typeLabel(b.items[0].message_type)
                              : `${b.items.length} itens (${b.items.map((i) => typeLabel(i.message_type)).join(", ")})`;

                        return (
                          <div
                            key={b.id}
                            className="glass-card rounded-xl p-5 flex items-center gap-4 hover:shadow-md transition-shadow"
                          >
                            <div className="w-10 h-10 rounded-lg bg-chart-4/10 flex items-center justify-center flex-shrink-0">
                              <ItemIcon className="w-5 h-5 text-chart-4" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <h3 className="text-sm font-semibold text-foreground">{b.title}</h3>
                              <p className="text-xs text-muted-foreground mt-0.5 flex items-center gap-2">
                                <span>{itemsSummary}</span>
                                <span>•</span>
                                {b.target_type === "tags" ? (
                                  <Tag className="w-3 h-3 inline" />
                                ) : (
                                  <Users className="w-3 h-3 inline" />
                                )}
                                <span className="truncate">{targetLabel(b)}</span>
                              </p>
                              <p className="text-xs text-muted-foreground mt-0.5">
                                Conexão: {b.connection_id}
                              </p>
                            </div>
                            <div className="text-right flex-shrink-0">
                              {b.scheduled_at && (
                                <>
                                  <p className="text-sm font-medium text-foreground">
                                    {new Date(b.scheduled_at).toLocaleDateString("pt-BR")}
                                  </p>
                                  <p className="text-xs text-chart-4 flex items-center gap-1 justify-end">
                                    <Clock className="w-3 h-3" />
                                    {new Date(b.scheduled_at).toLocaleTimeString("pt-BR", {
                                      hour: "2-digit",
                                      minute: "2-digit",
                                    })}
                                  </p>
                                </>
                              )}
                            </div>
                            <span className="text-xs font-medium px-2.5 py-1 rounded-full bg-chart-4/10 text-chart-4 flex-shrink-0">
                              Agendado
                            </span>
                            <div className="flex items-center gap-1 flex-shrink-0">
                              <button
                                onClick={() => handleSendNow(b.id)}
                                className="p-2 rounded-lg hover:bg-primary/10 text-muted-foreground hover:text-primary transition-colors"
                                title="Enviar agora"
                              >
                                <Play className="w-4 h-4" />
                              </button>
                              <button
                                onClick={() => handleUnschedule(b.id)}
                                className="p-2 rounded-lg hover:bg-chart-4/10 text-muted-foreground hover:text-chart-4 transition-colors"
                                title="Cancelar agendamento"
                              >
                                <CalendarX2 className="w-4 h-4" />
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Completed schedules */}
                {sentScheduled.length > 0 && (
                  <div className="space-y-3">
                    <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
                      Enviados ({sentScheduled.length})
                    </h2>
                    <div className="grid gap-3">
                      {sentScheduled.map((b) => {
                        const ItemIcon = b.items.length > 0 ? typeIcon(b.items[0].message_type) : Megaphone;
                        return (
                          <div
                            key={b.id}
                            className="glass-card rounded-xl p-5 flex items-center gap-4 opacity-70"
                          >
                            <div className="w-10 h-10 rounded-lg bg-muted flex items-center justify-center flex-shrink-0">
                              <ItemIcon className="w-5 h-5 text-muted-foreground" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <h3 className="text-sm font-semibold text-foreground">{b.title}</h3>
                              <p className="text-xs text-muted-foreground mt-0.5">
                                {b.sent_count}/{b.total_recipients} enviados
                                {b.failed_count > 0 && ` • ${b.failed_count} falhas`}
                              </p>
                            </div>
                            <div className="text-right flex-shrink-0">
                              <p className="text-sm text-muted-foreground">
                                {new Date(b.updated_at).toLocaleDateString("pt-BR")}
                              </p>
                            </div>
                            <span className="text-xs font-medium px-2.5 py-1 rounded-full bg-primary/10 text-primary flex-shrink-0">
                              <CheckCircle2 className="w-3 h-3 inline mr-1" />
                              Enviado
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </div>

      {/* ── Schedule Modal ──────────────────────────── */}
      <Dialog open={showModal} onOpenChange={setShowModal}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Novo Agendamento</DialogTitle>
            <DialogDescription>
              Selecione um disparo existente e defina a data e hora para envio automático.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {/* Select broadcast */}
            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground">Disparo</label>
              {schedulable.length === 0 ? (
                <p className="text-sm text-muted-foreground py-2">
                  Nenhum disparo disponível. Crie um na aba Disparos primeiro.
                </p>
              ) : (
                <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                  {schedulable.map((b) => {
                    const ItemIcon = b.items.length > 0 ? typeIcon(b.items[0].message_type) : Megaphone;
                    const itemsSummary =
                      b.items.length === 0
                        ? ""
                        : b.items.length === 1
                          ? typeLabel(b.items[0].message_type)
                          : `${b.items.length} itens`;

                    return (
                      <button
                        key={b.id}
                        onClick={() => setSelectedBroadcastId(b.id)}
                        className={cn(
                          "w-full flex items-center gap-3 p-3 rounded-xl border transition-all text-left",
                          selectedBroadcastId === b.id
                            ? "border-primary bg-primary/5 ring-1 ring-primary"
                            : "border-border hover:bg-muted/60"
                        )}
                      >
                        <div
                          className={cn(
                            "w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0",
                            selectedBroadcastId === b.id ? "bg-primary/10" : "bg-muted"
                          )}
                        >
                          <ItemIcon
                            className={cn(
                              "w-4 h-4",
                              selectedBroadcastId === b.id ? "text-primary" : "text-muted-foreground"
                            )}
                          />
                        </div>
                        <div className="flex-1 min-w-0">
                          <span
                            className={cn(
                              "text-sm font-medium block truncate",
                              selectedBroadcastId === b.id ? "text-primary" : "text-foreground"
                            )}
                          >
                            {b.title}
                          </span>
                          <span className="text-xs text-muted-foreground">
                            {itemsSummary}
                            {itemsSummary && " • "}
                            {targetLabel(b)}
                            {" • "}
                            {b.connection_id}
                          </span>
                        </div>
                        <span
                          className={cn(
                            "text-[10px] font-medium px-2 py-0.5 rounded-full flex-shrink-0",
                            b.status === "rascunho"
                              ? "bg-muted text-muted-foreground"
                              : b.status === "concluido"
                                ? "bg-primary/10 text-primary"
                                : "bg-destructive/10 text-destructive"
                          )}
                        >
                          {b.status === "rascunho"
                            ? "Rascunho"
                            : b.status === "concluido"
                              ? "Concluído"
                              : "Erro"}
                        </span>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Date & Time */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-sm font-medium text-foreground">Data</label>
                <Popover>
                  <PopoverTrigger asChild>
                    <button
                      className={cn(
                        "w-full flex items-center gap-2 bg-muted/50 border border-border rounded-lg px-4 py-2.5 text-sm text-left transition-all",
                        !date ? "text-muted-foreground/50" : "text-foreground"
                      )}
                    >
                      <CalendarDays className="w-4 h-4 text-muted-foreground" />
                      {date ? format(date, "dd/MM/yyyy") : "Selecionar data"}
                    </button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={date}
                      onSelect={setDate}
                      disabled={(d) => d < new Date(new Date().setHours(0, 0, 0, 0))}
                      initialFocus
                      className="p-3 pointer-events-auto"
                    />
                  </PopoverContent>
                </Popover>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium text-foreground">Horário</label>
                <div className="relative">
                  <Clock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <input
                    type="time"
                    value={time}
                    onChange={(e) => setTime(e.target.value)}
                    className="w-full bg-muted/50 border border-border rounded-lg pl-9 pr-4 py-2.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/30 transition-all"
                  />
                </div>
              </div>
            </div>

            {/* Actions */}
            <div className="flex gap-3 justify-end pt-2">
              <Button
                variant="ghost"
                onClick={() => {
                  resetModal();
                  setShowModal(false);
                }}
              >
                Cancelar
              </Button>
              <Button
                onClick={handleSchedule}
                disabled={!selectedBroadcastId || !date || scheduling}
              >
                {scheduling ? (
                  <Loader2 className="w-4 h-4 animate-spin mr-2" />
                ) : (
                  <Send className="w-4 h-4 mr-2" />
                )}
                Agendar Envio
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}