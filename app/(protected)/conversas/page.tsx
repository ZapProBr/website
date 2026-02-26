"use client";

import { AppLayout } from "@/components/AppLayout";
import { useState, useRef, useEffect, useCallback } from "react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import {
  Search, Check, CheckCheck, Mic, X, Send as SendIcon,
  Smile, Image, FileText, Sticker, Plus,
  Trash2, Pause, Play, CircleStop, ArrowRightLeft, ChevronDown, CircleX,
  Phone, Filter, Clock, User, MessageCircle,
} from "lucide-react";
import { getAudioStore } from "@/lib/audioStore";
import { ClientDetailPanel } from "@/components/conversas/ClientDetailPanel";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import {
  listConversations as apiListConversations,
  listMessages as apiListMessages,
  sendMessage as apiSendMessage,
  markMessagesRead as apiMarkRead,
  updateConversation as apiUpdateConversation,
  listUsers as apiListUsers,
  listTags as apiListTags,
  sendTyping as apiSendTyping,
  getMediaUrl,
  type ConversationItem,
  type MessageItem,
  type User as ApiUser,
  type Tag as ApiTag,
} from "@/lib/api";

type ConversationStatus = "aguardando" | "atendendo" | "finalizado";

const statusFilters: { value: ConversationStatus | "todos"; label: string }[] = [
  { value: "atendendo", label: "Atendendo" },
  { value: "aguardando", label: "Aguardando" },
  { value: "finalizado", label: "Finalizado" },
];

export default function ConversasPage() {
  // API data
  const [conversations, setConversations] = useState<ConversationItem[]>([]);
  const [apiUsers, setApiUsers] = useState<ApiUser[]>([]);
  const [apiTags, setApiTags] = useState<ApiTag[]>([]);

  const [selected, setSelected] = useState<string>("");
  const [chatMessages, setChatMessages] = useState<MessageItem[]>([]);
  const [messageText, setMessageText] = useState("");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<ConversationStatus | "todos">("atendendo");
  const [showAudioList, setShowAudioList] = useState(false);
  const [showAttach, setShowAttach] = useState(false);
  const [showEmoji, setShowEmoji] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [recordTime, setRecordTime] = useState(0);
  const recordInterval = useRef<ReturnType<typeof setInterval> | null>(null);
  const [showTransferDialog, setShowTransferDialog] = useState(false);
  const [showStatusMenu, setShowStatusMenu] = useState(false);
  const [showClientPanel, setShowClientPanel] = useState(false);

  // Advanced filters
  const [showAdvFilters, setShowAdvFilters] = useState(false);
  const [filterAttendant, setFilterAttendant] = useState<string | null>(null);

  // Transfer dialog state
  const [transferUser, setTransferUser] = useState("");

  // Typing indicator debounce
  const typingTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastTypingSent = useRef<number>(0);

  // Auto-scroll to bottom
  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const messagesContainerRef = useRef<HTMLDivElement | null>(null);

  // Fetch reference data
  useEffect(() => {
    apiListUsers().then(setApiUsers).catch(() => {});
    apiListTags().then(setApiTags).catch(() => {});
  }, []);

  // Fetch ALL conversations (no server filter — client filters for display)
  const fetchConversations = useCallback(async () => {
    try {
      const data = await apiListConversations();
      setConversations(data);
    } catch { /* silently fail */ }
  }, []);

  useEffect(() => { fetchConversations(); }, [fetchConversations]);

  // Poll conversations every 5 seconds for webhook updates
  useEffect(() => {
    const interval = setInterval(fetchConversations, 5000);
    return () => clearInterval(interval);
  }, [fetchConversations]);

  // Fetch messages when selected conversation changes
  const fetchMessages = useCallback(async () => {
    if (!selected) return;
    // Skip polling while a send is in-flight to preserve optimistic message
    if (isSending) return;
    try {
      const msgs = await apiListMessages(selected, { limit: 100 });
      setChatMessages((prev) => {
        // If we have optimistic (temp) messages, keep them and merge
        const tempMsgs = prev.filter((m) => String(m.id).startsWith("temp-"));
        if (tempMsgs.length === 0) return msgs;
        // Merge: use API messages + keep temp msgs that aren't yet in API results
        const apiIds = new Set(msgs.map((m) => m.id));
        const survivingTemps = tempMsgs.filter((t) => !apiIds.has(t.id));
        return [...msgs, ...survivingTemps];
      });
    } catch {
      setChatMessages([]);
    }
  }, [selected, isSending]);

  useEffect(() => {
    if (!selected) return;
    fetchMessages();
    // Mark as read
    apiMarkRead(selected).catch(() => {});
  }, [selected, fetchMessages]);

  // Poll messages every 3 seconds for the active conversation
  useEffect(() => {
    if (!selected) return;
    const interval = setInterval(fetchMessages, 3000);
    return () => clearInterval(interval);
  }, [selected, fetchMessages]);

  // Auto-scroll to bottom when messages change
  useEffect(() => {
    if (chatMessages.length === 0) return;
    const container = messagesContainerRef.current;
    if (container) {
      // Always scroll to bottom: on load, new messages, or conversation switch
      // Use a small timeout to let the DOM render first
      setTimeout(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: "auto" });
      }, 50);
    }
  }, [chatMessages, selected]);

  // Status counts from ALL conversations
  const statusCounts = {
    aguardando: conversations.filter((c) => c.status === "aguardando").length,
    atendendo: conversations.filter((c) => c.status === "atendendo").length,
    finalizado: conversations.filter((c) => c.status === "finalizado").length,
  };

  // Filter conversations by status + search
  const filtered = conversations
    .filter((c) => statusFilter === "todos" || c.status === statusFilter)
    .filter((c) => c.contact_name.toLowerCase().includes(search.toLowerCase()));

  // Auto-select first conversation when filtered list changes
  useEffect(() => {
    if (filtered.length > 0 && !filtered.find((c) => c.id === selected)) {
      setSelected(filtered[0].id);
    }
  }, [filtered, selected]);

  const selectedConv = conversations.find((c) => c.id === selected);

  const getInitials = (name: string) =>
    name.split(" ").map((n) => n[0]).join("").slice(0, 2).toUpperCase();

  const formatTime = (iso: string) => {
    const d = new Date(iso);
    return `${d.getHours().toString().padStart(2, "0")}:${d.getMinutes().toString().padStart(2, "0")}`;
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

  const sendMessage = async () => {
    if (!messageText.trim() || !selected || isSending) return;
    const text = messageText.trim();
    setIsSending(true);
    setMessageText("");

    // Optimistic: show message immediately with single check
    const tempId = `temp-${Date.now()}`;
    const optimisticMsg: MessageItem = {
      id: tempId,
      conversation_id: selected,
      sender_id: null,
      text,
      sent: true,
      read: false,
      delivered: false,
      is_system: false,
      message_type: "text",
      has_media: false,
      media_mimetype: null,
      created_at: new Date().toISOString(),
    };
    setChatMessages((prev) => [...prev, optimisticMsg]);

    try {
      const msg = await apiSendMessage(selected, { text });
      // Replace optimistic msg with real one (sent to server = single check still)
      setChatMessages((prev) =>
        prev.map((m) => (m.id === tempId ? { ...msg } : m))
      );
      fetchConversations();
    } catch (err: unknown) {
      setChatMessages((prev) => prev.filter((m) => m.id !== tempId));
      toast.error(err instanceof Error ? err.message : "Erro ao enviar");
    } finally {
      setIsSending(false);
    }
  };

  const insertEmoji = (emoji: string) => {
    setMessageText((prev) => prev + emoji);
    setShowEmoji(false);
  };

  const handleMessageInput = (value: string) => {
    setMessageText(value);
    // Send typing presence (debounced — at most once every 3s)
    if (selected && value.trim()) {
      const now = Date.now();
      if (now - lastTypingSent.current > 3000) {
        lastTypingSent.current = now;
        apiSendTyping(selected).catch(() => {});
      }
      // Reset the paused-typing timer
      if (typingTimeout.current) clearTimeout(typingTimeout.current);
      typingTimeout.current = setTimeout(() => {
        lastTypingSent.current = 0; // allow immediate re-send next time
      }, 4000);
    }
  };

  const handleTransfer = async () => {
    if (!transferUser) {
      toast.error("Selecione um usuário");
      return;
    }
    try {
      await apiUpdateConversation(selected, { attendant_id: transferUser });
      toast.success("Conversa transferida");
      setShowTransferDialog(false);
      fetchConversations();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Erro ao transferir");
    }
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
                    {apiUsers.map(u => <option key={u.id} value={u.name}>{u.name}</option>)}
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
                  {conv.contact_photo ? (
                    <img
                      src={conv.contact_photo}
                      alt={conv.contact_name}
                      className="w-10 h-10 rounded-full object-cover"
                      onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; (e.target as HTMLImageElement).nextElementSibling?.classList.remove('hidden'); }}
                    />
                  ) : null}
                  <div className={cn(
                    "w-10 h-10 rounded-full gradient-green flex items-center justify-center text-xs font-bold text-primary-foreground",
                    conv.contact_photo && "hidden"
                  )}>
                    {getInitials(conv.contact_name)}
                  </div>
                </div>
                <div className="flex-1 min-w-0 flex gap-0">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className="text-sm font-semibold text-foreground truncate">{conv.contact_name}</span>
                    </div>
                    <p className="text-xs text-muted-foreground truncate mt-0.5">{conv.last_message || "Sem mensagens"}</p>
                  </div>
                  <div className="flex flex-col items-end flex-shrink-0 pl-3 ml-2 gap-1 min-w-[100px]">
                    <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
                      <Clock className="w-3 h-3" />
                      <span>{formatTime(conv.updated_at)}</span>
                      {conv.unread_count > 0 && (
                        <span className="w-4 h-4 rounded-full bg-primary text-primary-foreground text-[9px] font-bold flex items-center justify-center ml-1">
                          {conv.unread_count}
                        </span>
                      )}
                    </div>
                    {conv.attendant_name && (
                      <div className="flex items-center gap-1 text-[11px] text-muted-foreground">
                        <User className="w-3 h-3 text-accent-foreground" />
                        <span className="truncate max-w-[90px]">{conv.attendant_name}</span>
                      </div>
                    )}
                  </div>
                </div>
              </button>
            ))}
            {filtered.length === 0 && (
              <div className="py-12 text-center text-muted-foreground text-sm">Nenhuma conversa encontrada</div>
            )}
          </div>
        </div>

        {/* Chat Area */}
        <div className="flex-1 flex flex-col">
          {/* Chat header */}
          <div className="border-b border-border">
            <div className="flex items-center justify-between px-5 py-3">
              <div className="flex items-center gap-3 min-w-0">
                <button onClick={() => setShowClientPanel(true)} className="flex-shrink-0">
                  {selectedConv?.contact_photo ? (
                    <img
                      src={selectedConv.contact_photo}
                      alt={selectedConv.contact_name}
                      className="w-10 h-10 rounded-full object-cover"
                      onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; (e.target as HTMLImageElement).nextElementSibling?.classList.remove('hidden'); }}
                    />
                  ) : null}
                  <div className={cn(
                    "w-10 h-10 rounded-full gradient-green flex items-center justify-center text-xs font-bold text-primary-foreground",
                    selectedConv?.contact_photo && "hidden"
                  )}>
                    {selectedConv ? getInitials(selectedConv.contact_name) : "?"}
                  </div>
                </button>
                <button onClick={() => setShowClientPanel(true)} className="text-left hover:opacity-80 transition-opacity min-w-0">
                  <p className="text-sm font-semibold text-foreground truncate">{selectedConv?.contact_name || "Selecione"}</p>
                  <p className="text-xs text-muted-foreground truncate">
                    {selectedConv?.contact_phone}
                    {selectedConv && <span className="text-muted-foreground/60"> • {selectedConv.attendant_name || "Atendente"}</span>}
                  </p>
                </button>

                {selectedConv && (() => {
                  const s = selectedConv.status;
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
                      const num = selectedConv.contact_phone.replace(/\D/g, "");
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
                    setTransferUser("");
                    setShowTransferDialog(true);
                  }}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border text-sm font-medium text-foreground hover:bg-muted transition-colors"
                >
                  <ArrowRightLeft className="w-4 h-4" />
                  Transferir
                </button>

                {/* Status dropdown button */}
                <button
                  onClick={() => { setShowStatusMenu(!showStatusMenu); }}
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
                  onClick={async () => {
                    try {
                      await apiUpdateConversation(selected, { status: "finalizado" });
                      toast.success("Conversa finalizada");
                      fetchConversations();
                    } catch { toast.error("Erro ao finalizar"); }
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
                        const isActive = selectedConv?.status === status.value;
                        return (
                          <button
                            key={status.value}
                            onClick={async () => {
                              try {
                                await apiUpdateConversation(selected, { status: status.value });
                                setShowStatusMenu(false);
                                fetchConversations();
                              } catch { toast.error("Erro ao alterar status"); }
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
          </div>

          <div ref={messagesContainerRef} className="flex-1 overflow-y-auto p-5 space-y-3 bg-muted/30">
            {chatMessages.map((msg) => {
              if (msg.is_system) {
                return (
                  <div key={msg.id} className="flex justify-center">
                    <span className="text-[11px] text-muted-foreground bg-muted/80 px-3 py-1 rounded-full font-medium">
                      {msg.text} • {formatTime(msg.created_at)}
                    </span>
                  </div>
                );
              }
              return (
                <div key={msg.id} className={cn("flex", msg.sent ? "justify-end" : "justify-start")}>
                  <div className={cn(
                    "max-w-[65%] rounded-2xl text-sm overflow-hidden",
                    msg.sent
                      ? "bg-primary text-primary-foreground rounded-br-md"
                      : "bg-muted text-foreground rounded-bl-md"
                  )}>
                    {/* Media content */}
                    {msg.has_media && msg.media_mimetype && selected && (
                      <>
                        {msg.media_mimetype.startsWith("image/") && (
                          <img
                            src={getMediaUrl(selected, msg.id)}
                            alt="Imagem"
                            className="w-full max-h-80 object-cover cursor-pointer"
                            loading="lazy"
                            onClick={() => window.open(getMediaUrl(selected, msg.id), "_blank")}
                          />
                        )}
                        {msg.media_mimetype.startsWith("audio/") && (
                          <div className="px-3 pt-2">
                            <audio controls className="w-full max-w-[280px]" preload="none">
                              <source src={getMediaUrl(selected, msg.id)} type={msg.media_mimetype} />
                            </audio>
                          </div>
                        )}
                        {msg.media_mimetype.startsWith("video/") && (
                          <video controls className="w-full max-h-80" preload="none">
                            <source src={getMediaUrl(selected, msg.id)} type={msg.media_mimetype} />
                          </video>
                        )}
                        {!msg.media_mimetype.startsWith("image/") && !msg.media_mimetype.startsWith("audio/") && !msg.media_mimetype.startsWith("video/") && (
                          <div className="px-4 pt-2">
                            <a
                              href={getMediaUrl(selected, msg.id)}
                              target="_blank"
                              rel="noopener noreferrer"
                              className={cn("underline text-xs", msg.sent ? "text-primary-foreground" : "text-foreground")}
                            >
                              📎 Baixar arquivo
                            </a>
                          </div>
                        )}
                      </>
                    )}
                    {/* Text content — hide placeholder text like [Image], [Audio] when media exists */}
                    {msg.text && !(msg.has_media && /^\[(image|audio|video|document|sticker)\]$/i.test(msg.text)) && (
                      <p className="px-4 py-2.5">{msg.text}</p>
                    )}
                    {!msg.text && !msg.has_media && <p className="px-4 py-2.5">&nbsp;</p>}
                    <div className={cn("flex items-center justify-end gap-1 px-4 pb-2", msg.sent ? "text-primary-foreground/70" : "text-muted-foreground")}>
                      <span className="text-[10px]">{formatTime(msg.created_at)}</span>
                      {msg.sent && (
                        msg.read
                          ? <CheckCheck className="w-3 h-3 text-blue-400" />
                          : msg.delivered
                            ? <CheckCheck className="w-3 h-3" />
                            : <Check className="w-3 h-3" />
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
            {chatMessages.length === 0 && (
              <div className="flex justify-center pt-12 text-muted-foreground text-sm">Nenhuma mensagem ainda</div>
            )}
            <div ref={messagesEndRef} />
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
                  onChange={(e) => handleMessageInput(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage(); } }}
                  className="flex-1 bg-muted rounded-lg px-4 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary/50"
                />
                <button onClick={startRecording} className="p-2.5 rounded-lg transition-colors flex-shrink-0 text-muted-foreground hover:text-foreground hover:bg-muted" title="Gravar áudio">
                  <Mic className="w-5 h-5" />
                </button>
                <button
                  onClick={sendMessage}
                  disabled={isSending || !messageText.trim()}
                  className={cn(
                    "p-2.5 rounded-lg transition-colors flex-shrink-0",
                    isSending || !messageText.trim()
                      ? "bg-muted text-muted-foreground cursor-not-allowed"
                      : "bg-primary text-primary-foreground hover:bg-primary/90"
                  )}
                >
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
          contact={selectedConv ? { name: selectedConv.contact_name, phone: selectedConv.contact_phone, avatar: getInitials(selectedConv.contact_name), photo: selectedConv.contact_photo } : null}
          tags={[]}
          onToggleTag={() => {}}
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
              <label className="text-sm font-medium text-foreground">Transferir para</label>
              <select
                value={transferUser}
                onChange={(e) => setTransferUser(e.target.value)}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <option value="">Selecione um usuário</option>
                {apiUsers.map(u => <option key={u.id} value={u.id}>{u.name} ({u.role === "admin" ? "Admin" : "Atendente"})</option>)}
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
