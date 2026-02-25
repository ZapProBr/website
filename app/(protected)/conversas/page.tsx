"use client";

import { AppLayout } from "@/components/AppLayout";
import { useState, useRef } from "react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import {
  Search, Check, CheckCheck, Mic, X, Send as SendIcon,
  Smile, Image, FileText, Sticker, Plus,
  Trash2, Pause, Play, CircleStop, ArrowRightLeft, ChevronDown, CircleX,
  Phone, Filter, Clock, User, MessageCircle,
} from "lucide-react";
import { getAudioStore } from "@/lib/audioStore";
import { getTagColor, getTagStore } from "@/lib/tagStore";
import { ClientDetailPanel } from "@/components/conversas/ClientDetailPanel";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

type ConversationStatus = "aguardando" | "atendendo" | "finalizado";

interface Conversation {
  id: string;
  name: string;
  phone: string;
  lastMessage: string;
  time: string;
  unread: number;
  avatar: string;
  status: "online" | "offline";
  atendimentoStatus: ConversationStatus;
  tags: string[];
  attendant?: string;
  connection?: string;
  department?: string;
}

const conversations: Conversation[] = [
  { id: "1", name: "João Silva", phone: "(11) 99999-1234", lastMessage: "Olá, gostaria de saber mais sobre o produto...", time: "10:32", unread: 3, avatar: "JS", status: "online", atendimentoStatus: "aguardando", tags: ["Lead Quente"], attendant: "Ana", connection: "Comercial 1", department: "Vendas" },
  { id: "2", name: "Maria Souza", phone: "(21) 98888-5678", lastMessage: "Ok, pode enviar o orçamento", time: "09:15", unread: 0, avatar: "MS", status: "online", atendimentoStatus: "atendendo", tags: [], attendant: "Carlos", connection: "Suporte", department: "Suporte" },
  { id: "3", name: "Carlos Lima", phone: "(31) 97777-9012", lastMessage: "Perfeito, vamos fechar então!", time: "Ontem", unread: 0, avatar: "CL", status: "offline", atendimentoStatus: "finalizado", tags: ["Cliente VIP"], attendant: "Ana", connection: "Comercial 1", department: "Vendas" },
  { id: "4", name: "Ana Costa", phone: "(41) 96666-3456", lastMessage: "Preciso de mais informações", time: "Ontem", unread: 1, avatar: "AC", status: "offline", atendimentoStatus: "aguardando", tags: [], attendant: "Julia", connection: "Comercial 1", department: "Financeiro" },
  { id: "5", name: "Pedro Rocha", phone: "(51) 95555-7890", lastMessage: "Obrigado pelo atendimento!", time: "23/02", unread: 0, avatar: "PR", status: "offline", atendimentoStatus: "finalizado", tags: ["Parceiro"], attendant: "Carlos", connection: "Suporte", department: "Suporte" },
  { id: "6", name: "Fernanda Dias", phone: "(11) 91234-5678", lastMessage: "Quero saber sobre o plano Enterprise", time: "10:05", unread: 2, avatar: "FD", status: "online", atendimentoStatus: "atendendo", tags: ["Lead Quente", "Cliente VIP"], attendant: "Ana", connection: "Comercial 1", department: "Gestão" },
];

const statusFilters: { value: ConversationStatus | "todos"; label: string }[] = [
  { value: "atendendo", label: "Atendendo" },
  { value: "aguardando", label: "Aguardando" },
  { value: "finalizado", label: "Finalizado" },
];

const availableAttendants = ["Ana", "Carlos", "Julia"];
const departments = ["Gestão", "Suporte", "Vendas", "Financeiro"];
const connections = ["Comercial", "Suporte"];
const departmentUsers: Record<string, string[]> = {
  "Gestão": ["Admin Principal"],
  "Suporte": ["Ana Paula"],
  "Vendas": ["Carlos Silva"],
  "Financeiro": ["Julia Mendes"],
};

interface Message {
  id: string;
  text: string;
  time: string;
  sent: boolean;
  read: boolean;
  isSystem?: boolean;
}

const initialMessages: Message[] = [
  { id: "sys-0", text: "Atendimento iniciado", time: "10:19", sent: false, read: true, isSystem: true },
  { id: "1", text: "Olá, boa tarde!", time: "10:20", sent: false, read: true },
  { id: "2", text: "Boa tarde! Como posso ajudar?", time: "10:22", sent: true, read: true },
  { id: "3", text: "Gostaria de saber mais sobre o produto Premium", time: "10:25", sent: false, read: true },
  { id: "4", text: "Claro! O plano Premium inclui disparos ilimitados, CRM avançado e automações completas.", time: "10:28", sent: true, read: true },
  { id: "5", text: "Olá, gostaria de saber mais sobre o produto...", time: "10:32", sent: false, read: false },
];

export default function ConversasPage() {
  const [selected, setSelected] = useState<string>("1");
  const [chatMessages, setChatMessages] = useState<Message[]>(initialMessages);
  const [messageText, setMessageText] = useState("");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<ConversationStatus | "todos">("atendendo");
  const [showAudioList, setShowAudioList] = useState(false);
  const [showAttach, setShowAttach] = useState(false);
  const [showEmoji, setShowEmoji] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [recordTime, setRecordTime] = useState(0);
  const recordInterval = useRef<ReturnType<typeof setInterval> | null>(null);
  const [showTagMenu, setShowTagMenu] = useState(false);
  const [showTransferDialog, setShowTransferDialog] = useState(false);
  const [showStatusMenu, setShowStatusMenu] = useState(false);
  const [convTags, setConvTags] = useState<Record<string, string[]>>({
    "1": ["Lead Quente"],
    "3": ["Cliente VIP"],
    "5": ["Parceiro"],
    "6": ["Lead Quente", "Cliente VIP"],
  });
  const [convStatuses, setConvStatuses] = useState<Record<string, ConversationStatus>>({
    "1": "aguardando",
    "2": "atendendo",
    "3": "finalizado",
    "4": "aguardando",
    "5": "finalizado",
    "6": "atendendo",
  });
  const [showClientPanel, setShowClientPanel] = useState(false);
  const [removedConvIds, setRemovedConvIds] = useState<string[]>([]);

  // Advanced filters
  const [showAdvFilters, setShowAdvFilters] = useState(false);
  const [filterAttendant, setFilterAttendant] = useState<string | null>(null);
  const [filterTag, setFilterTag] = useState<string | null>(null);

  // Transfer dialog state
  const [transferConnection, setTransferConnection] = useState(connections[0]);
  const [transferDept, setTransferDept] = useState(departments[0]);
  const [transferUser, setTransferUser] = useState("");

  const getConvStatus = (id: string) => convStatuses[id] || conversations.find((c) => c.id === id)?.atendimentoStatus || "aguardando";

  const activeConversations = conversations.filter(c => !removedConvIds.includes(c.id));

  const filtered = activeConversations.filter((c) => {
    const matchesSearch = c.name.toLowerCase().includes(search.toLowerCase());
    const matchesStatus = statusFilter === "todos" || getConvStatus(c.id) === statusFilter;
    const matchesAttendant = !filterAttendant || c.attendant === filterAttendant;
    const matchesTag = !filterTag || (convTags[c.id] || c.tags || []).includes(filterTag);
    return matchesSearch && matchesStatus && matchesAttendant && matchesTag;
  });

  const statusCounts = {
    aguardando: activeConversations.filter((c) => getConvStatus(c.id) === "aguardando").length,
    atendendo: activeConversations.filter((c) => getConvStatus(c.id) === "atendendo").length,
    finalizado: activeConversations.filter((c) => getConvStatus(c.id) === "finalizado").length,
  };

  const toggleConvTag = (tag: string) => {
    const current = convTags[selected] || [];
    const updated = current.includes(tag)
      ? current.filter((t) => t !== tag)
      : [...current, tag];
    setConvTags({ ...convTags, [selected]: updated });
  };

  const selectedConv = activeConversations.find((c) => c.id === selected);

  const addSystemMessage = (text: string) => {
    const now = new Date();
    const time = `${now.getHours().toString().padStart(2, "0")}:${now.getMinutes().toString().padStart(2, "0")}`;
    setChatMessages((prev) => [
      ...prev,
      { id: `sys-${Date.now()}`, text, time, sent: false, read: true, isSystem: true },
    ]);
  };

  const startRecording = () => {
    setIsRecording(true);
    setIsPaused(false);
    setRecordTime(0);
    recordInterval.current = setInterval(() => {
      setRecordTime((t) => t + 1);
    }, 1000);
  };

  const pauseRecording = () => {
    setIsPaused(true);
    if (recordInterval.current) clearInterval(recordInterval.current);
  };

  const resumeRecording = () => {
    setIsPaused(false);
    recordInterval.current = setInterval(() => {
      setRecordTime((t) => t + 1);
    }, 1000);
  };

  const stopRecording = () => {
    setIsRecording(false);
    setIsPaused(false);
    setRecordTime(0);
    if (recordInterval.current) clearInterval(recordInterval.current);
  };

  const formatRecordTime = (s: number) => {
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${m}:${sec.toString().padStart(2, "0")}`;
  };

  const sendMessage = () => {
    if (!messageText.trim()) return;
    const now = new Date();
    const time = `${now.getHours().toString().padStart(2, "0")}:${now.getMinutes().toString().padStart(2, "0")}`;
    setChatMessages((prev) => [
      ...prev,
      { id: Date.now().toString(), text: messageText, time, sent: true, read: false },
    ]);
    setMessageText("");
  };

  const insertEmoji = (emoji: string) => {
    setMessageText((prev) => prev + emoji);
    setShowEmoji(false);
  };

  const handleTransfer = () => {
    if (!transferUser) {
      toast.error("Selecione um usuário");
      return;
    }
    addSystemMessage(`Conversa transferida para ${transferUser} (${transferDept})`);
    toast.success(`Conversa transferida para ${transferUser}`);
    setRemovedConvIds([...removedConvIds, selected]);
    setShowTransferDialog(false);
    // Select next available conversation
    const remaining = activeConversations.filter(c => c.id !== selected);
    if (remaining.length > 0) setSelected(remaining[0].id);
  };

  return (
    <AppLayout fullHeight>
      <div className="animate-fade-in h-full flex overflow-hidden border-l border-border">
        {/* Contacts List */}
        <div className="w-[340px] border-r border-border flex flex-col bg-card">
          <div className="p-4 border-b border-border space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-foreground">Conversas</h2>
              <button
                onClick={() => setShowAdvFilters(!showAdvFilters)}
                className={cn(
                  "p-1.5 rounded-lg transition-colors",
                  showAdvFilters ? "bg-primary/10 text-primary" : "text-muted-foreground hover:bg-muted"
                )}
              >
                <Filter className="w-4 h-4" />
              </button>
            </div>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <input
                type="text"
                placeholder="Buscar conversa..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full bg-muted rounded-lg pl-9 pr-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary/50"
              />
            </div>

            {/* Advanced filters */}
            {showAdvFilters && (
              <div className="space-y-2 pt-1">
                <div className="flex gap-2">
                  <select
                    value={filterAttendant || ""}
                    onChange={(e) => setFilterAttendant(e.target.value || null)}
                    className="flex-1 bg-muted rounded-lg px-3 py-1.5 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary/50"
                  >
                    <option value="">Todos atendentes</option>
                    {availableAttendants.map(a => <option key={a} value={a}>{a}</option>)}
                  </select>
                  <select
                    value={filterTag || ""}
                    onChange={(e) => setFilterTag(e.target.value || null)}
                    className="flex-1 bg-muted rounded-lg px-3 py-1.5 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary/50"
                  >
                    <option value="">Todas tags</option>
                    {getTagStore().map(t => <option key={t.name} value={t.name}>{t.name}</option>)}
                  </select>
                </div>
              </div>
            )}

            {/* Status filters */}
            <div className="flex gap-1.5">
              {statusFilters.map((sf) => {
                const count = statusCounts[sf.value as ConversationStatus] ?? 0;
                const isActive = statusFilter === sf.value;
                return (
                  <button
                    key={sf.value}
                    onClick={() => setStatusFilter(isActive ? "todos" : sf.value)}
                    className={cn(
                      "flex-1 flex flex-col items-center py-2 px-1 rounded-lg text-center transition-all",
                      isActive
                        ? "bg-primary text-primary-foreground"
                        : "bg-muted text-muted-foreground hover:bg-muted/80"
                    )}
                  >
                    <span className="text-[11px] font-medium leading-tight">{sf.label}</span>
                    <span className={cn("text-sm font-bold", isActive ? "text-primary-foreground" : "text-foreground")}>
                      {count}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="flex-1 overflow-y-auto">
            {filtered.map((conv) => (
              <button
                key={conv.id}
                onClick={() => setSelected(conv.id)}
                className={cn(
                  "w-full flex items-start gap-3 px-4 py-3 hover:bg-muted/50 transition-colors text-left border-b border-border/40",
                  selected === conv.id && "bg-muted"
                )}
              >
                <div className="relative flex-shrink-0 mt-0.5">
                  <div className="w-10 h-10 rounded-full gradient-green flex items-center justify-center text-xs font-bold text-primary-foreground">
                    {conv.avatar}
                  </div>
                  {conv.status === "online" && (
                    <div className="absolute bottom-0 right-0 w-3 h-3 rounded-full bg-primary border-2 border-card" />
                  )}
                </div>
                <div className="flex-1 min-w-0 flex gap-0">
                  {/* Left: client info + tags */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className="text-sm font-semibold text-foreground truncate">{conv.name}</span>
                    </div>
                    <div className="flex items-center gap-1.5 mt-0.5">
                      {conv.status === "online" && <span className="w-2 h-2 rounded-full bg-primary flex-shrink-0" />}
                      <p className="text-xs text-muted-foreground truncate">{conv.lastMessage}</p>
                    </div>
                    {(convTags[conv.id] || []).length > 0 && (
                      <div className="flex gap-1 mt-1.5 flex-wrap">
                        {(convTags[conv.id] || []).map((tag) => (
                          <span
                            key={tag}
                            className="text-[10px] font-medium px-1.5 py-0.5 rounded text-white"
                            style={{ backgroundColor: getTagColor(tag) }}
                          >
                            {tag}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                  {/* Right: time + attendant + connection */}
                  <div className="flex flex-col items-end flex-shrink-0 pl-3 ml-2 gap-1 min-w-[170px]">
                    <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
                      <Clock className="w-3 h-3" />
                      <span>{conv.time}</span>
                      {conv.unread > 0 && (
                        <span className="w-4 h-4 rounded-full bg-primary text-primary-foreground text-[9px] font-bold flex items-center justify-center ml-1">
                          {conv.unread}
                        </span>
                      )}
                    </div>
                    {conv.attendant && (
                      <div className="flex items-center gap-1 text-[11px] text-muted-foreground">
                        <User className="w-3 h-3 text-accent-foreground" />
                        <span className="truncate max-w-[150px]">{conv.attendant}{conv.department ? ` - ${conv.department}` : ""}</span>
                      </div>
                    )}
                    {conv.connection && (
                      <div className="flex items-center gap-1 text-[11px] text-primary">
                        <MessageCircle className="w-3 h-3" />
                        <span className="truncate max-w-[150px]">{conv.connection}</span>
                      </div>
                    )}
                  </div>
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Chat Area */}
        <div className="flex-1 flex flex-col">
          {/* Chat header */}
          <div className="border-b border-border">
            <div className="flex items-center justify-between px-5 py-3">
              <div className="flex items-center gap-3 min-w-0">
                <button onClick={() => setShowClientPanel(true)} className="flex-shrink-0">
                  <div className="w-10 h-10 rounded-full gradient-green flex items-center justify-center text-xs font-bold text-primary-foreground">
                    {selectedConv?.avatar || "?"}
                  </div>
                </button>
                <button onClick={() => setShowClientPanel(true)} className="text-left hover:opacity-80 transition-opacity min-w-0">
                  <p className="text-sm font-semibold text-foreground truncate">{selectedConv?.name || "Selecione"}</p>
                  <p className="text-xs text-muted-foreground truncate">
                    {selectedConv?.phone}
                    {selectedConv && <span className="text-muted-foreground/60"> • {selectedConv.attendant || "Atendente"}</span>}
                  </p>
                </button>

                {selectedConv && (() => {
                  const s = getConvStatus(selected);
                  const statusConfig = {
                    atendendo: { label: "Em Atendimento", classes: "bg-emerald-500/10 text-emerald-600 border-emerald-500/20" },
                    aguardando: { label: "Aguardando", classes: "bg-amber-500/10 text-amber-600 border-amber-500/20" },
                    finalizado: { label: "Finalizado", classes: "bg-muted text-muted-foreground border-border" },
                  };
                  const cfg = statusConfig[s] || statusConfig.aguardando;
                  return (
                    <span className={cn("ml-2 px-2.5 py-0.5 rounded-full text-[11px] font-semibold border flex-shrink-0", cfg.classes)}>
                      {cfg.label}
                    </span>
                  );
                })()}
              </div>

              <div className="flex items-center gap-2 flex-shrink-0 relative">
                {/* WhatsApp Call */}
                <button
                  onClick={() => {
                    if (selectedConv) {
                      const num = selectedConv.phone.replace(/\D/g, "");
                      window.open(`https://wa.me/55${num}`, "_blank");
                    }
                  }}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border text-sm font-medium text-foreground hover:bg-muted transition-colors"
                >
                  <Phone className="w-4 h-4" />
                </button>

                {/* Transfer */}
                <button
                  onClick={() => {
                    setTransferConnection(connections[0]);
                    setTransferDept(departments[0]);
                    setTransferUser(departmentUsers[departments[0]]?.[0] || "");
                    setShowTransferDialog(true);
                  }}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border text-sm font-medium text-foreground hover:bg-muted transition-colors"
                >
                  <ArrowRightLeft className="w-4 h-4" />
                  Transferir
                </button>

                {/* Status dropdown button */}
                <button
                  onClick={() => { setShowStatusMenu(!showStatusMenu); setShowTagMenu(false); }}
                  className={cn(
                    "flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-sm font-medium transition-colors",
                    showStatusMenu
                      ? "bg-primary text-primary-foreground border-primary"
                      : "border-border text-foreground hover:bg-muted"
                  )}
                >
                  Status
                  <ChevronDown className="w-3.5 h-3.5" />
                </button>

                {/* Finalizar */}
                <button
                  onClick={() => {
                    setConvStatuses({ ...convStatuses, [selected]: "finalizado" });
                    addSystemMessage("Atendimento finalizado");
                    toast.success("Conversa finalizada");
                  }}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-destructive text-destructive-foreground text-sm font-medium hover:bg-destructive/90 transition-colors"
                >
                  <CircleX className="w-4 h-4" />
                  Finalizar
                </button>

                {/* Status dropdown */}
                {showStatusMenu && (
                  <div className="absolute top-full right-0 mt-2 bg-card border border-border rounded-xl shadow-lg z-20 w-52">
                    <div className="px-4 py-3 border-b border-border">
                      <span className="text-sm font-semibold text-foreground">Alterar Status</span>
                    </div>
                    <div className="py-1">
                      {([
                        { value: "atendendo" as ConversationStatus, label: "Em Atendimento", color: "bg-emerald-500" },
                        { value: "aguardando" as ConversationStatus, label: "Aguardando", color: "bg-amber-500" },
                        { value: "finalizado" as ConversationStatus, label: "Finalizado", color: "bg-muted-foreground" },
                      ]).map((status) => {
                        const currentStatus = convStatuses[selected] || selectedConv?.atendimentoStatus;
                        const isActive = currentStatus === status.value;
                        return (
                          <button
                            key={status.value}
                            onClick={() => {
                              const prev = convStatuses[selected] || selectedConv?.atendimentoStatus || "aguardando";
                              setConvStatuses({ ...convStatuses, [selected]: status.value });
                              setShowStatusMenu(false);
                              if (prev !== status.value) {
                                addSystemMessage(`Status alterado para "${status.label}"`);
                              }
                            }}
                            className={cn(
                              "w-full flex items-center gap-3 px-4 py-2.5 text-left text-sm transition-colors",
                              isActive ? "bg-muted font-medium" : "text-foreground hover:bg-muted/50"
                            )}
                          >
                            <div className={cn("w-2.5 h-2.5 rounded-full", status.color)} />
                            {status.label}
                            {isActive && <Check className="w-3.5 h-3.5 ml-auto text-primary" />}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Tags row */}
            {(convTags[selected] || []).length > 0 && (
              <div className="px-5 pb-2.5 flex items-center gap-1.5">
                {(convTags[selected] || []).map((tag) => (
                  <span
                    key={tag}
                    className="text-[11px] font-medium px-2 py-0.5 rounded-full text-white"
                    style={{ backgroundColor: getTagColor(tag) }}
                  >
                    {tag}
                  </span>
                ))}
              </div>
            )}
          </div>

          <div className="flex-1 overflow-y-auto p-5 space-y-3 bg-muted/30">
            {chatMessages.map((msg) => {
              if (msg.isSystem) {
                return (
                  <div key={msg.id} className="flex justify-center">
                    <span className="text-[11px] text-muted-foreground bg-muted/80 px-3 py-1 rounded-full font-medium">
                      {msg.text} • {msg.time}
                    </span>
                  </div>
                );
              }
              return (
                <div key={msg.id} className={cn("flex", msg.sent ? "justify-end" : "justify-start")}>
                  <div className={cn(
                    "max-w-[65%] px-4 py-2.5 rounded-2xl text-sm",
                    msg.sent
                      ? "bg-primary text-primary-foreground rounded-br-md"
                      : "bg-muted text-foreground rounded-bl-md"
                  )}>
                    <p>{msg.text}</p>
                    <div className={cn("flex items-center justify-end gap-1 mt-1", msg.sent ? "text-primary-foreground/70" : "text-muted-foreground")}>
                      <span className="text-[10px]">{msg.time}</span>
                      {msg.sent && (msg.read ? <CheckCheck className="w-3 h-3" /> : <Check className="w-3 h-3" />)}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="px-5 py-3 border-t border-border relative">
            {/* Audio list popup */}
            {showAudioList && (
              <div className="absolute bottom-full left-5 right-5 mb-2 bg-card border border-border rounded-xl shadow-lg max-h-60 overflow-y-auto z-10">
                <div className="flex items-center justify-between px-4 py-3 border-b border-border">
                  <span className="text-sm font-semibold text-foreground">Áudios Programados</span>
                  <button onClick={() => setShowAudioList(false)} className="p-1 rounded hover:bg-muted">
                    <X className="w-4 h-4 text-muted-foreground" />
                  </button>
                </div>
                {getAudioStore().length === 0 ? (
                  <p className="px-4 py-6 text-sm text-muted-foreground text-center">Nenhum áudio salvo</p>
                ) : (
                  getAudioStore().map((audio) => (
                    <button
                      key={audio.id}
                      onClick={() => setShowAudioList(false)}
                      className="w-full flex items-center gap-3 px-4 py-3 hover:bg-muted/50 transition-colors text-left"
                    >
                      <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                        <Mic className="w-4 h-4 text-primary" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-foreground truncate">{audio.title}</p>
                        <p className="text-xs text-muted-foreground">{audio.duration}</p>
                      </div>
                      <SendIcon className="w-4 h-4 text-primary flex-shrink-0" />
                    </button>
                  ))
                )}
              </div>
            )}

            {/* Attach popup */}
            {showAttach && (
              <div className="absolute bottom-full left-5 mb-2 bg-card border border-border rounded-xl shadow-lg z-10 w-56">
                <div className="py-2">
                  {[
                    { icon: Image, label: "Imagem", color: "text-blue-500" },
                    { icon: FileText, label: "Documento", color: "text-orange-500" },
                    { icon: Mic, label: "Áudios Programados", color: "text-primary", action: () => { setShowAttach(false); setShowAudioList(true); } },
                    { icon: Sticker, label: "Figurinha", color: "text-pink-500" },
                  ].map((item) => (
                    <button
                      key={item.label}
                      onClick={() => { if (item.action) { item.action(); } else { setShowAttach(false); toast.info("Funcionalidade em breve"); } }}
                      className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-muted/50 transition-colors text-left"
                    >
                      <item.icon className={cn("w-5 h-5", item.color)} />
                      <span className="text-sm font-medium text-foreground">{item.label}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Emoji picker popup */}
            {showEmoji && (
              <div className="absolute bottom-full right-5 mb-2 bg-card border border-border rounded-xl shadow-lg z-10 p-4 w-72">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-sm font-semibold text-foreground">Emojis</span>
                  <button onClick={() => setShowEmoji(false)} className="p-1 rounded hover:bg-muted">
                    <X className="w-4 h-4 text-muted-foreground" />
                  </button>
                </div>
                <div className="grid grid-cols-8 gap-1">
                  {["😀","😂","😍","🥰","😎","🤩","😢","😡","👍","👎","❤️","🔥","🎉","✅","⭐","💬","📞","📸","🎁","💰","🙏","👋","🤝","💪","🏆","🎯","📌","⏰","📅","💡","🚀","✨"].map((emoji) => (
                    <button
                      key={emoji}
                      onClick={() => insertEmoji(emoji)}
                      className="w-8 h-8 flex items-center justify-center text-lg hover:bg-muted rounded transition-colors"
                    >
                      {emoji}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {isRecording ? (
              <div className="flex gap-2 items-center">
                <span className="text-xs text-muted-foreground mr-1 cursor-pointer hover:text-foreground transition-colors" onClick={stopRecording}>Cancelar</span>
                <button onClick={stopRecording} className="w-10 h-10 rounded-full border border-border flex items-center justify-center text-muted-foreground hover:text-destructive hover:border-destructive transition-colors flex-shrink-0" title="Descartar">
                  <Trash2 className="w-4 h-4" />
                </button>
                <div className="flex items-center gap-2 px-3">
                  <div className={cn("w-2.5 h-2.5 rounded-full bg-destructive", !isPaused && "animate-pulse")} />
                  <span className="text-sm font-mono font-semibold text-foreground min-w-[36px]">{formatRecordTime(recordTime)}</span>
                </div>
                <div className="flex-1 flex items-center justify-center gap-[3px] h-8 overflow-hidden">
                  {Array.from({ length: 30 }).map((_, i) => (
                    <div key={i} className={cn("w-[3px] rounded-full bg-muted-foreground/40 transition-all", !isPaused && "animate-pulse")} style={{ height: `${Math.max(4, Math.random() * 24 + 4)}px`, animationDelay: `${i * 50}ms` }} />
                  ))}
                </div>
                <button onClick={isPaused ? resumeRecording : pauseRecording} className="w-10 h-10 rounded-full border border-border flex items-center justify-center text-muted-foreground hover:text-foreground hover:border-foreground transition-colors flex-shrink-0" title={isPaused ? "Continuar" : "Pausar"}>
                  {isPaused ? <Play className="w-4 h-4" /> : <Pause className="w-4 h-4" />}
                </button>
                <button onClick={stopRecording} className="w-10 h-10 rounded-full border border-border flex items-center justify-center text-muted-foreground hover:text-foreground hover:border-foreground transition-colors flex-shrink-0" title="Parar">
                  <CircleStop className="w-4 h-4" />
                </button>
                <button onClick={stopRecording} className="w-10 h-10 rounded-full bg-primary text-primary-foreground hover:bg-primary/90 transition-colors flex items-center justify-center flex-shrink-0" title="Enviar áudio">
                  <SendIcon className="w-5 h-5" />
                </button>
              </div>
            ) : (
              <div className="flex gap-2 items-center">
                <button
                  onClick={() => { setShowAttach(!showAttach); setShowEmoji(false); setShowAudioList(false); }}
                  className={cn("p-2.5 rounded-lg transition-colors flex-shrink-0", showAttach ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground hover:bg-muted")}
                  title="Anexar"
                >
                  <Plus className="w-5 h-5" />
                </button>
                <button
                  onClick={() => { setShowEmoji(!showEmoji); setShowAttach(false); setShowAudioList(false); }}
                  className={cn("p-2.5 rounded-lg transition-colors flex-shrink-0", showEmoji ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground hover:bg-muted")}
                  title="Emoji"
                >
                  <Smile className="w-5 h-5" />
                </button>
                <input
                  type="text"
                  placeholder="Digite uma mensagem..."
                  value={messageText}
                  onChange={(e) => setMessageText(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage(); } }}
                  className="flex-1 bg-muted rounded-lg px-4 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary/50"
                />
                <button onClick={startRecording} className="p-2.5 rounded-lg transition-colors flex-shrink-0 text-muted-foreground hover:text-foreground hover:bg-muted" title="Gravar áudio">
                  <Mic className="w-5 h-5" />
                </button>
                <button onClick={sendMessage} className="p-2.5 rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 transition-colors flex-shrink-0">
                  <SendIcon className="w-5 h-5" />
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Client Detail Panel */}
        <ClientDetailPanel
          open={showClientPanel}
          onOpenChange={setShowClientPanel}
          contact={selectedConv ? { name: selectedConv.name, phone: selectedConv.phone, avatar: selectedConv.avatar } : null}
          tags={convTags[selected] || []}
          onToggleTag={toggleConvTag}
        />
      </div>

      {/* Transfer Dialog */}
      <Dialog open={showTransferDialog} onOpenChange={setShowTransferDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Transferir Conversa</DialogTitle>
            <DialogDescription>Selecione o destino para transferir esta conversa.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground">Conexão</label>
              <select
                value={transferConnection}
                onChange={(e) => setTransferConnection(e.target.value)}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                {connections.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground">Departamento</label>
              <select
                value={transferDept}
                onChange={(e) => {
                  setTransferDept(e.target.value);
                  setTransferUser(departmentUsers[e.target.value]?.[0] || "");
                }}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                {departments.map(d => <option key={d} value={d}>{d}</option>)}
              </select>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground">Usuário</label>
              <select
                value={transferUser}
                onChange={(e) => setTransferUser(e.target.value)}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <option value="">Selecione um usuário</option>
                {(departmentUsers[transferDept] || []).map(u => <option key={u} value={u}>{u}</option>)}
              </select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowTransferDialog(false)}>Cancelar</Button>
            <Button onClick={handleTransfer} disabled={!transferUser}>Transferir</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}
