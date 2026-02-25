"use client";

import { useState } from "react";
import { AppLayout } from "@/components/AppLayout";
import { getTagStore, getTagColor } from "@/lib/tagStore";
import {
  CalendarDays, Plus, Clock, X, Type, Mic, Image, FileText, File, Users, Tag, Trash2, Send, Upload, Smartphone,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

const CONEXOES = [
  { id: "1", name: "Comercial 1", number: "(11) 99999-1234" },
  { id: "2", name: "Suporte", number: "(21) 98888-5678" },
];

type ContentType = "texto" | "audio" | "imagem" | "pdf" | "word";
type TargetType = "todos" | "tags";

interface Agendamento {
  id: string;
  title: string;
  contentTypes: ContentType[];
  date: string;
  time: string;
  target: string;
  status: "agendado" | "enviado";
}

const contentTypes: { value: ContentType; label: string; icon: typeof Type }[] = [
  { value: "texto", label: "Texto", icon: Type },
  { value: "audio", label: "Áudio", icon: Mic },
  { value: "imagem", label: "Imagem", icon: Image },
  { value: "pdf", label: "PDF", icon: FileText },
  { value: "word", label: "Word", icon: File },
];

const initialAgendamentos: Agendamento[] = [
  { id: "1", title: "Promoção Black Friday", contentTypes: ["texto"], date: "25/02/2026", time: "09:00", target: "Todos os contatos", status: "agendado" },
  { id: "2", title: "Catálogo de produtos", contentTypes: ["pdf"], date: "26/02/2026", time: "14:00", target: "Lead Quente, Cliente VIP", status: "agendado" },
  { id: "3", title: "Áudio de boas-vindas", contentTypes: ["audio"], date: "22/02/2026", time: "10:00", target: "Lead Quente", status: "enviado" },
];

export default function DisparoAgendamentoPage() {
  const [agendamentos, setAgendamentos] = useState<Agendamento[]>(initialAgendamentos);
  const [showModal, setShowModal] = useState(false);

  const [title, setTitle] = useState("");
  const [selectedContentTypes, setSelectedContentTypes] = useState<ContentType[]>(["texto"]);
  const [message, setMessage] = useState("");
  const [date, setDate] = useState<Date>();
  const [time, setTime] = useState("09:00");
  const [targetType, setTargetType] = useState<TargetType>("todos");
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [selectedConexao, setSelectedConexao] = useState(CONEXOES[0].id);

  const toggleContentType = (type: ContentType) => {
    setSelectedContentTypes(prev => prev.includes(type) ? prev.filter(t => t !== type) : [...prev, type]);
  };

  const toggleTag = (tag: string) => {
    setSelectedTags(prev => prev.includes(tag) ? prev.filter(t => t !== tag) : [...prev, tag]);
  };

  const resetForm = () => {
    setTitle("");
    setSelectedContentTypes(["texto"]);
    setMessage("");
    setDate(undefined);
    setTime("09:00");
    setTargetType("todos");
    setSelectedTags([]);
    setSelectedConexao(CONEXOES[0].id);
  };

  const handleSave = () => {
    if (!title.trim() || !date) return;
    const newItem: Agendamento = {
      id: Date.now().toString(),
      title: title.trim(),
      contentTypes: selectedContentTypes,
      date: format(date, "dd/MM/yyyy"),
      time,
      target: targetType === "todos" ? "Todos os contatos" : selectedTags.join(", "),
      status: "agendado",
    };
    setAgendamentos([newItem, ...agendamentos]);
    resetForm();
    setShowModal(false);
  };

  const removeAgendamento = (id: string) => {
    setAgendamentos(agendamentos.filter((a) => a.id !== id));
  };

  return (
    <AppLayout>
      <div className="space-y-6 animate-fade-in">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Agendamento de Disparos</h1>
            <p className="text-muted-foreground mt-1">Programe o envio de mensagens, áudios e arquivos com data e hora</p>
          </div>
          <button onClick={() => setShowModal(true)} className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg bg-primary text-primary-foreground font-medium text-sm hover:bg-primary/90 transition-colors">
            <Plus className="w-4 h-4" />
            Novo Agendamento
          </button>
        </div>

        {agendamentos.length === 0 ? (
          <div className="glass-card rounded-xl p-12 flex flex-col items-center justify-center text-center">
            <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center mb-4">
              <CalendarDays className="w-8 h-8 text-primary" />
            </div>
            <h3 className="text-lg font-semibold text-foreground mb-2">Nenhum agendamento</h3>
            <p className="text-sm text-muted-foreground max-w-md">Programe o envio de mensagens, áudios e arquivos para seus contatos.</p>
          </div>
        ) : (
          <div className="grid gap-3">
            {agendamentos.map((a) => {
              const icons = a.contentTypes.map(ct => contentTypes.find(c => c.value === ct)?.icon || Type);
              const FirstIcon = icons[0];
              return (
                <div key={a.id} className="glass-card rounded-xl p-5 flex items-center gap-4 hover:shadow-md transition-shadow">
                  <div className={cn("w-10 h-10 rounded-lg flex items-center justify-center", a.status === "enviado" ? "bg-muted" : "bg-primary/10")}>
                    <FirstIcon className={cn("w-5 h-5", a.status === "enviado" ? "text-muted-foreground" : "text-primary")} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="text-sm font-semibold text-foreground">{a.title}</h3>
                    <p className="text-xs text-muted-foreground mt-0.5 flex items-center gap-2">
                      <span>{a.contentTypes.map(ct => ct.charAt(0).toUpperCase() + ct.slice(1)).join(" + ")}</span>
                      <span>•</span>
                      <Users className="w-3 h-3 inline" />
                      <span className="truncate">{a.target}</span>
                    </p>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <p className="text-sm font-medium text-foreground">{a.date}</p>
                    <p className="text-xs text-muted-foreground flex items-center gap-1 justify-end">
                      <Clock className="w-3 h-3" />{a.time}
                    </p>
                  </div>
                  <span className={cn("text-xs font-medium px-2.5 py-1 rounded-full flex-shrink-0", a.status === "agendado" ? "bg-chart-4/10 text-chart-4" : "bg-primary/10 text-primary")}>
                    {a.status === "agendado" ? "Agendado" : "Enviado"}
                  </span>
                  {a.status === "agendado" && (
                    <button onClick={() => removeAgendamento(a.id)} className="p-2 rounded-lg hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors flex-shrink-0">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* Modal */}
        {showModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
            <div className="bg-card rounded-2xl p-6 w-full max-w-lg mx-4 shadow-xl space-y-5 max-h-[90vh] overflow-y-auto">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-semibold text-foreground">Novo Agendamento</h2>
                <button onClick={() => { resetForm(); setShowModal(false); }} className="p-1 rounded-lg hover:bg-muted transition-colors">
                  <X className="w-5 h-5 text-muted-foreground" />
                </button>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium text-foreground">Conexão de envio</label>
                <div className="grid grid-cols-2 gap-2">
                  {CONEXOES.map(c => (
                    <button key={c.id} onClick={() => setSelectedConexao(c.id)} className={cn("flex items-center gap-2 p-3 rounded-xl border transition-all text-left", selectedConexao === c.id ? "border-primary bg-primary/5 ring-1 ring-primary" : "border-border hover:bg-muted/60")}>
                      <Smartphone className={cn("w-5 h-5", selectedConexao === c.id ? "text-primary" : "text-muted-foreground")} />
                      <div>
                        <span className={cn("text-sm font-medium block", selectedConexao === c.id ? "text-primary" : "text-foreground")}>{c.name}</span>
                        <span className="text-xs text-muted-foreground">{c.number}</span>
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium text-foreground">Título</label>
                <input type="text" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Ex: Promoção de Natal" className="w-full bg-muted/50 border border-border rounded-lg px-4 py-2.5 text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/30 transition-all" />
              </div>

              {/* Multi-select content type */}
              <div className="space-y-2">
                <label className="text-sm font-medium text-foreground">Tipo de conteúdo (selecione um ou mais)</label>
                <div className="grid grid-cols-5 gap-2">
                  {contentTypes.map((ct) => {
                    const isActive = selectedContentTypes.includes(ct.value);
                    return (
                      <button key={ct.value} onClick={() => toggleContentType(ct.value)} className={cn("flex flex-col items-center gap-1.5 p-3 rounded-xl border transition-all text-center", isActive ? "border-primary bg-primary/5 ring-1 ring-primary" : "border-border hover:bg-muted/60")}>
                        <ct.icon className={cn("w-5 h-5", isActive ? "text-primary" : "text-muted-foreground")} />
                        <span className={cn("text-[11px] font-medium", isActive ? "text-primary" : "text-muted-foreground")}>{ct.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Show fields per selected content type */}
              {selectedContentTypes.includes("texto") && (
                <div className="space-y-2">
                  <label className="text-sm font-medium text-foreground">Mensagem</label>
                  <textarea value={message} onChange={(e) => setMessage(e.target.value)} placeholder="Digite a mensagem..." rows={3} className="w-full bg-muted/50 border border-border rounded-lg px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/30 transition-all resize-none" />
                </div>
              )}

              {selectedContentTypes.filter(t => t !== "texto").map(ct => {
                const ctInfo = contentTypes.find(c => c.value === ct);
                const Icon = ctInfo?.icon || File;
                return (
                  <button key={ct} className="w-full flex flex-col items-center gap-2 py-6 border-2 border-dashed border-border rounded-lg hover:border-primary/30 hover:bg-primary/5 transition-all cursor-pointer">
                    <Icon className="w-7 h-7 text-muted-foreground" />
                    <p className="text-sm font-medium text-foreground">Enviar {ctInfo?.label}</p>
                    <p className="text-xs text-muted-foreground">
                      {ct === "audio" && "MP3, OGG ou WAV • Máx. 5MB"}
                      {ct === "imagem" && "JPG, PNG ou WEBP • Máx. 5MB"}
                      {ct === "pdf" && "PDF • Máx. 10MB"}
                      {ct === "word" && "DOCX ou DOC • Máx. 10MB"}
                    </p>
                  </button>
                );
              })}

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium text-foreground">Data</label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <button className={cn("w-full flex items-center gap-2 bg-muted/50 border border-border rounded-lg px-4 py-2.5 text-sm text-left transition-all", !date ? "text-muted-foreground/50" : "text-foreground")}>
                        <CalendarDays className="w-4 h-4 text-muted-foreground" />
                        {date ? format(date, "dd/MM/yyyy") : "Selecionar data"}
                      </button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar mode="single" selected={date} onSelect={setDate} disabled={(d) => d < new Date()} initialFocus className="p-3 pointer-events-auto" />
                    </PopoverContent>
                  </Popover>
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium text-foreground">Horário</label>
                  <div className="relative">
                    <Clock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <input type="time" value={time} onChange={(e) => setTime(e.target.value)} className="w-full bg-muted/50 border border-border rounded-lg pl-9 pr-4 py-2.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/30 transition-all" />
                  </div>
                </div>
              </div>

              <div className="space-y-3">
                <label className="text-sm font-medium text-foreground">Destinatários</label>
                <div className="grid grid-cols-2 gap-3">
                  <button onClick={() => { setTargetType("todos"); setSelectedTags([]); }} className={cn("flex items-center gap-2 p-3 rounded-xl border transition-all", targetType === "todos" ? "border-primary bg-primary/5 ring-1 ring-primary" : "border-border hover:bg-muted/60")}>
                    <Users className={cn("w-5 h-5", targetType === "todos" ? "text-primary" : "text-muted-foreground")} />
                    <span className={cn("text-sm font-medium", targetType === "todos" ? "text-primary" : "text-muted-foreground")}>Todos os contatos</span>
                  </button>
                  <button onClick={() => setTargetType("tags")} className={cn("flex items-center gap-2 p-3 rounded-xl border transition-all", targetType === "tags" ? "border-primary bg-primary/5 ring-1 ring-primary" : "border-border hover:bg-muted/60")}>
                    <Tag className={cn("w-5 h-5", targetType === "tags" ? "text-primary" : "text-muted-foreground")} />
                    <span className={cn("text-sm font-medium", targetType === "tags" ? "text-primary" : "text-muted-foreground")}>Filtrar por tags</span>
                  </button>
                </div>
                {targetType === "tags" && (
                  <div className="flex flex-wrap gap-2 pt-1">
                    {getTagStore().map(tagItem => (
                      <button key={tagItem.name} onClick={() => toggleTag(tagItem.name)} className={cn("text-xs font-medium px-3 py-1.5 rounded-full border transition-colors", selectedTags.includes(tagItem.name) ? "text-white border-transparent" : "bg-muted text-muted-foreground border-border hover:border-primary/20")} style={selectedTags.includes(tagItem.name) ? { backgroundColor: tagItem.color } : {}}>
                        {tagItem.name}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              <div className="flex gap-3 justify-end pt-2">
                <button onClick={() => { resetForm(); setShowModal(false); }} className="px-4 py-2.5 rounded-lg text-sm font-medium text-muted-foreground hover:bg-muted transition-colors">Cancelar</button>
                <button onClick={handleSave} className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors">
                  <Send className="w-4 h-4" />
                  Agendar Envio
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </AppLayout>
  );
}
