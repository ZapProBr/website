"use client";

import { AppLayout } from "@/components/AppLayout";
import { useState, useRef, useEffect, useCallback } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import {
  Search,
  Check,
  CheckCheck,
  Mic,
  X,
  Send as SendIcon,
  Smile,
  Image,
  FileText,
  Sticker,
  Plus,
  Trash2,
  Pause,
  Play,
  ArrowRightLeft,
  ChevronDown,
  CircleX,
  Filter,
  Clock,
  User,
  MessageCircle,
  MapPin,
} from "lucide-react";

import { setTagStore } from "@/lib/tagStore";
import {
  getCachedConversations, setCachedConversations,
  getCachedMessages, setCachedMessages,
  getCachedUsers, setCachedUsers,
  getCachedTags, setCachedTags,
  getCachedSavedAudios, setCachedSavedAudios,
  getCachedSelectedId, setCachedSelectedId,
  getCachedStatusFilter, setCachedStatusFilter,
} from "@/lib/conversationCache";
import { ClientDetailPanel } from "@/components/conversas/ClientDetailPanel";
import { AudioPlayer } from "@/components/conversas/AudioPlayer";
import { RecordingVisualizer } from "@/components/conversas/RecordingVisualizer";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import {
  listConversations as apiListConversations,
  listMessages as apiListMessages,
  sendMessage as apiSendMessage,
  markMessagesRead as apiMarkRead,
  updateConversation as apiUpdateConversation,
  updateConversationTags as apiUpdateConversationTags,
  listUsers as apiListUsers,
  listTags as apiListTags,
  sendTyping as apiSendTyping,
  sendMedia as apiSendMedia,
  createContact as apiCreateContact,
  getMediaUrl,
  getWebSocketUrl,
  listSavedAudios,
  getSavedAudio,
  type ConversationItem,
  type MessageItem,
  type User as ApiUser,
  type Tag as ApiTag,
  type SavedAudio,
} from "@/lib/api";

type ConversationStatus = "aguardando" | "atendendo" | "finalizado";

const statusFilters: { value: ConversationStatus | "todos"; label: string }[] =
  [
    { value: "atendendo", label: "Atendendo" },
    { value: "aguardando", label: "Aguardando" },
    { value: "finalizado", label: "Finalizado" },
  ];

export default function ConversasPage() {
  const searchParams = useSearchParams();
  const router = useRouter();

  // API data — initialise from module-level cache so returning to this tab is instant
  const [conversations, setConversationsRaw] = useState<ConversationItem[]>(getCachedConversations);
  const [apiUsers, setApiUsersRaw] = useState<ApiUser[]>(getCachedUsers);
  const [apiTags, setApiTagsRaw] = useState<ApiTag[]>(getCachedTags);

  // Wrap setters to also persist to cache
  const setConversations = useCallback((data: ConversationItem[]) => {
    setCachedConversations(data);
    setConversationsRaw(data);
  }, []);
  const setApiUsers = useCallback((data: ApiUser[]) => {
    setCachedUsers(data);
    setApiUsersRaw(data);
  }, []);
  const setApiTags = useCallback((data: ApiTag[]) => {
    setCachedTags(data);
    setApiTagsRaw(data);
  }, []);

  // Selected conversation from URL (fall back to cached selection)
  const urlConvId = searchParams.get("id") ?? "";
  const urlStatus = searchParams.get("status") as
    | ConversationStatus
    | "todos"
    | null;
  const initialId = urlConvId || getCachedSelectedId();
  const initialStatus = urlStatus ?? (getCachedStatusFilter() as ConversationStatus | "todos") ?? "atendendo";
  const [selected, setSelectedState] = useState<string>(initialId);
  const [chatMessages, setChatMessagesRaw] = useState<MessageItem[]>(() => getCachedMessages(initialId));
  const [messageText, setMessageText] = useState("");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilterState] = useState<
    ConversationStatus | "todos"
  >(initialStatus);

  // Wrap setChatMessages to also persist to cache
  const setChatMessages = useCallback((updater: MessageItem[] | ((prev: MessageItem[]) => MessageItem[])) => {
    setChatMessagesRaw((prev) => {
      const next = typeof updater === "function" ? updater(prev) : updater;
      if (selectedRef.current) setCachedMessages(selectedRef.current, next);
      return next;
    });
  }, []);
  const [showAudioList, setShowAudioList] = useState(false);
  const [savedAudios, setSavedAudiosRaw] = useState<SavedAudio[]>(getCachedSavedAudios);
  const setSavedAudios = useCallback((data: SavedAudio[]) => {
    setCachedSavedAudios(data);
    setSavedAudiosRaw(data);
  }, []);
  const [showAttach, setShowAttach] = useState(false);
  const [showEmoji, setShowEmoji] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [recordTime, setRecordTime] = useState(0);
  const [isDragOverChat, setIsDragOverChat] = useState(false);
  const [pendingImage, setPendingImage] = useState<{
    base64: string;
    mimetype: string;
    previewUrl: string;
    name: string;
  } | null>(null);
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

  // Refs for outside-click close of popups
  const statusMenuRef = useRef<HTMLDivElement | null>(null);
  const attachMenuRef = useRef<HTMLDivElement | null>(null);
  const emojiMenuRef = useRef<HTMLDivElement | null>(null);

  // Close popups when clicking outside
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (
        showStatusMenu &&
        statusMenuRef.current &&
        !statusMenuRef.current.contains(e.target as Node)
      ) {
        setShowStatusMenu(false);
      }
      if (
        showAttach &&
        attachMenuRef.current &&
        !attachMenuRef.current.contains(e.target as Node)
      ) {
        setShowAttach(false);
      }
      if (
        showEmoji &&
        emojiMenuRef.current &&
        !emojiMenuRef.current.contains(e.target as Node)
      ) {
        setShowEmoji(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [showStatusMenu, showAttach, showEmoji]);

  // Track which conversation we already synced the status filter for (prevent repeated auto-switch on poll)
  const syncedFilterForRef = useRef<string | null>(null);

  // Media upload
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const audioStreamRef = useRef<MediaStream | null>(null);

  // Auto-scroll to bottom
  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const messagesContainerRef = useRef<HTMLDivElement | null>(null);
  const prevMsgCount = useRef<number>(0);
  const isUserNearBottom = useRef<boolean>(true);
  const isFirstLoad = useRef<boolean>(true);
  const programmaticScroll = useRef<boolean>(false);

  // WebSocket ref
  const wsRef = useRef<WebSocket | null>(null);
  const wsReconnectTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Refs so the WS closure always has the latest values
  const selectedRef = useRef<string>(initialId);
  const fetchMessagesRef = useRef<() => void>(() => {});
  const fetchConversationsRef = useRef<() => void>(() => {});

  const clearPendingImage = useCallback(() => {
    setPendingImage((prev) => {
      if (prev?.previewUrl) URL.revokeObjectURL(prev.previewUrl);
      return null;
    });
  }, []);

  const fileToBase64 = (file: File) =>
    new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const result = String(reader.result || "");
        if (!result.includes(",")) {
          reject(new Error("Falha ao ler imagem"));
          return;
        }
        resolve(result.split(",", 2)[1]);
      };
      reader.onerror = () => reject(new Error("Falha ao ler imagem"));
      reader.readAsDataURL(file);
    });

  const preparePendingImage = useCallback(
    async (file: File) => {
      if (!file.type.startsWith("image/")) {
        toast.error("Selecione um arquivo de imagem válido.");
        return;
      }
      if (file.size > 15 * 1024 * 1024) {
        toast.error("Imagem muito grande (máximo 15MB).");
        return;
      }

      try {
        const base64 = await fileToBase64(file);
        setPendingImage((prev) => {
          if (prev?.previewUrl) URL.revokeObjectURL(prev.previewUrl);
          return {
            base64,
            mimetype: file.type,
            previewUrl: URL.createObjectURL(file),
            name: file.name || "imagem",
          };
        });
      } catch {
        toast.error("Não foi possível processar a imagem.");
      }
    },
    [],
  );

  useEffect(() => {
    return () => {
      setPendingImage((prev) => {
        if (prev?.previewUrl) URL.revokeObjectURL(prev.previewUrl);
        return null;
      });
    };
  }, []);

  // Scroll helper
  const scrollToBottom = useCallback((behavior: ScrollBehavior = "auto") => {
    const container = messagesContainerRef.current;
    if (!container) return;
    programmaticScroll.current = true;
    container.scrollTop = container.scrollHeight;
  }, []);

  // Helper to build URL with current params
  const updateUrl = useCallback(
    (params: Record<string, string | null>) => {
      const sp = new URLSearchParams(searchParams.toString());
      for (const [k, v] of Object.entries(params)) {
        if (v) sp.set(k, v);
        else sp.delete(k);
      }
      router.replace(`/conversas?${sp.toString()}`, { scroll: false });
    },
    [router, searchParams],
  );

  // Keep selected in sync with URL + cache
  const setSelected = useCallback(
    (id: string) => {
      setSelectedState(id);
      setCachedSelectedId(id);
      // Pre-load cached messages for the newly selected conversation
      setChatMessagesRaw(getCachedMessages(id));
      updateUrl({ id: id || null });
    },
    [updateUrl],
  );

  // Keep status filter in sync with URL + cache
  const setStatusFilter = useCallback(
    (status: ConversationStatus | "todos") => {
      setStatusFilterState(status);
      setCachedStatusFilter(status);
      updateUrl({ status: status });
    },
    [updateUrl],
  );

  // On mount, restore from URL and auto-switch status to match selected conversation
  useEffect(() => {
    const id = searchParams.get("id");
    const status = searchParams.get("status") as
      | ConversationStatus
      | "todos"
      | null;
    if (id && id !== selected) setSelectedState(id);
    if (status) setStatusFilterState(status);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // When conversations load and we have a URL id, switch status filter to show that conversation
  // Only auto-switch ONCE per conversation selection (not on every poll)
  useEffect(() => {
    if (!selected || conversations.length === 0) return;
    if (syncedFilterForRef.current === selected) return; // Already synced for this selection
    const conv = conversations.find((c) => c.id === selected);
    if (conv) {
      syncedFilterForRef.current = selected;
      if (statusFilter !== "todos" && conv.status !== statusFilter) {
        setStatusFilter(conv.status as ConversationStatus);
      }
    }
  }, [conversations, selected]); // eslint-disable-line react-hooks/exhaustive-deps

  // Fetch reference data
  useEffect(() => {
    apiListUsers()
      .then(setApiUsers)
      .catch(() => {});
    apiListTags()
      .then((tags) => {
        setApiTags(tags);
        // Populate shared tagStore so ClientDetailPanel can read ids
        setTagStore(
          tags.map((t) => ({ id: t.id, name: t.name, color: t.color })),
        );
      })
      .catch(() => {});
    listSavedAudios()
      .then(setSavedAudios)
      .catch(() => {});
  }, []);

  // Fetch ALL conversations (no server filter — client filters for display)
  const fetchConversations = useCallback(async () => {
    try {
      const data = await apiListConversations({ limit: 100 });
      setConversations(data);
    } catch {
      /* silently fail */
    }
  }, []);

  useEffect(() => {
    fetchConversations();
  }, [fetchConversations]);

  // Keep refs always pointing at the latest callbacks
  useEffect(() => {
    fetchConversationsRef.current = fetchConversations;
  }, [fetchConversations]);

  // WebSocket for real-time updates (replaces 5s polling)
  useEffect(() => {
    let reconnectDelay = 2000;

    function connect() {
      const url = getWebSocketUrl();
      if (!url.includes("token=")) return; // not authenticated yet

      const ws = new WebSocket(url);
      wsRef.current = ws;

      ws.onopen = () => {
        reconnectDelay = 2000;
        // Keepalive ping every 25s
        const pingInterval = setInterval(() => {
          if (ws.readyState === WebSocket.OPEN) ws.send("ping");
        }, 25000);
        (
          ws as WebSocket & { _pingInterval?: ReturnType<typeof setInterval> }
        )._pingInterval = pingInterval;
      };

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          if (
            data.type === "new_message" ||
            data.type === "conversation_update"
          ) {
            // Use refs so we always call the latest version of these callbacks
            fetchConversationsRef.current();
            if (data.conversation_id === selectedRef.current) {
              fetchMessagesRef.current();
            }
          }
        } catch {
          /* ignore non-JSON (e.g. "pong") */
        }
      };

      ws.onclose = () => {
        const interval = (
          ws as WebSocket & { _pingInterval?: ReturnType<typeof setInterval> }
        )._pingInterval;
        if (interval) clearInterval(interval);
        // Reconnect with backoff
        wsReconnectTimeout.current = setTimeout(() => {
          reconnectDelay = Math.min(reconnectDelay * 2, 30000);
          connect();
        }, reconnectDelay);
      };

      ws.onerror = () => ws.close();
    }

    connect();

    return () => {
      if (wsReconnectTimeout.current) clearTimeout(wsReconnectTimeout.current);
      const ws = wsRef.current;
      if (ws) {
        ws.onclose = null; // prevent reconnect on unmount
        ws.close();
      }
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Fallback polling every 15s (in case WS is not connected)
  useEffect(() => {
    const interval = setInterval(fetchConversations, 15000);
    return () => clearInterval(interval);
  }, [fetchConversations]);

  // Fetch messages when selected conversation changes
  const fetchMessages = useCallback(
    async (force = false) => {
      if (!selected) return;
      // Skip timer-based polling while a send is in-flight to preserve the optimistic message
      // But allow WS-triggered fetches (force=true) to still go through
      if (isSending && !force) return;
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
        // Keep previous messages on network error — don't blank the screen
      }
    },
    [selected, isSending],
  );

  // Keep refs up to date whenever selected or fetchMessages changes
  useEffect(() => {
    selectedRef.current = selected;
  }, [selected]);
  useEffect(() => {
    // WS handler calls fetchMessagesRef.current(true) to bypass isSending guard
    fetchMessagesRef.current = () => fetchMessages(true);
  }, [fetchMessages]);

  useEffect(() => {
    if (!selected) return;
    fetchMessages();
    // Mark as read
    apiMarkRead(selected).catch(() => {});
  }, [selected, fetchMessages]);

  // Fallback poll messages every 10s (WS handles real-time delivery)
  // Use a ref so isSending toggling doesn't recreate the interval
  const fetchMessagesForPollRef = useRef<() => void>(() => {});
  useEffect(() => {
    fetchMessagesForPollRef.current = fetchMessages;
  }, [fetchMessages]);
  useEffect(() => {
    if (!selected) return;
    const interval = setInterval(
      () => fetchMessagesForPollRef.current(),
      10000,
    );
    return () => clearInterval(interval);
  }, [selected]); // only reset timer on conversation switch, not on every isSending change

  // Reset on conversation switch → always scroll to bottom on first load
  useEffect(() => {
    isFirstLoad.current = true;
    isUserNearBottom.current = true;
    prevMsgCount.current = 0;
  }, [selected]);

  // Auto-scroll to bottom
  useEffect(() => {
    if (chatMessages.length === 0) return;
    const container = messagesContainerRef.current;
    if (!container) return;

    const count = chatMessages.length;
    const hasNewMessages = count > prevMsgCount.current;
    prevMsgCount.current = count;

    if (isFirstLoad.current) {
      // First load or conversation switch: snap instantly + retry for images
      isFirstLoad.current = false;
      scrollToBottom();
      // Retry after images may have loaded
      const t1 = setTimeout(scrollToBottom, 100);
      const t2 = setTimeout(scrollToBottom, 300);
      const t3 = setTimeout(scrollToBottom, 600);
      return () => {
        clearTimeout(t1);
        clearTimeout(t2);
        clearTimeout(t3);
      };
    }

    if (hasNewMessages && isUserNearBottom.current) {
      // New messages arrived and user was near bottom: scroll smoothly
      programmaticScroll.current = true;
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }
    // If user scrolled up (isUserNearBottom = false), do nothing
  }, [chatMessages, scrollToBottom]);

  // Status counts from ALL conversations
  const statusCounts = {
    aguardando: conversations.filter((c) => c.status === "aguardando").length,
    atendendo: conversations.filter((c) => c.status === "atendendo").length,
    finalizado: conversations.filter((c) => c.status === "finalizado").length,
  };

  // Filter conversations by status + search + attendant
  const filtered = conversations
    .filter((c) => statusFilter === "todos" || c.status === statusFilter)
    .filter((c) => !filterAttendant || c.attendant_name === filterAttendant)
    .filter((c) => c.contact_name.toLowerCase().includes(search.toLowerCase()));

  // Auto-select first conversation when filtered list changes (only if no URL selection)
  useEffect(() => {
    if (filtered.length > 0 && !filtered.find((c) => c.id === selected)) {
      // Only auto-select if we don't have a valid URL selection already loading
      if (!selected || !conversations.find((c) => c.id === selected)) {
        setSelected(filtered[0].id);
      }
    }
  }, [filtered, selected, conversations, setSelected]);

  const selectedConv = conversations.find((c) => c.id === selected);

  const getInitials = (name: string) =>
    name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .slice(0, 2)
      .toUpperCase();

  const formatTime = (iso: string) => {
    const d = new Date(iso);
    return `${d.getHours().toString().padStart(2, "0")}:${d.getMinutes().toString().padStart(2, "0")}`;
  };

  const parseLocation = (
    raw: string,
  ): { lat: number; lng: number; name: string | null } | null => {
    const text = (raw || "").trim();
    // Matches [Localização:lat|lng] or [Localização:lat|lng|name]
    const match = text.match(
      /^\[Localiza[çc][aã]o:(-?[\d.]+)\|(-?[\d.]+)(?:\|([^\]]+))?\]$/i,
    );
    if (!match) return null;
    const lat = parseFloat(match[1]);
    const lng = parseFloat(match[2]);
    if (isNaN(lat) || isNaN(lng)) return null;
    const name = (match[3] || "").trim() || null;
    return { lat, lng, name };
  };

  const parseSharedContact = (
    raw: string,
  ): { name: string; phone: string | null; picUrl: string | null } | null => {
    const text = (raw || "").trim();
    // Format: [Contato: Name|phone?|picUrl?]
    const match = text.match(
      /^\[Contato(?:\s*:\s*([^\]|]*?)\s*(?:\|\s*([^\]|]*)\s*(?:\|\s*([^\]]+)\s*)?)?)?\]$/i,
    );
    if (!match) return null;
    const name = (match[1] || "").trim() || "Contato";
    const phone = (match[2] || "").trim() || null;
    const picUrl = (match[3] || "").trim() || null;
    return { name, phone, picUrl };
  };

  const saveSharedContact = async (name: string, phone: string) => {
    try {
      await apiCreateContact({ name, phone });
      toast.success("Contato salvo com sucesso");
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : "Erro ao salvar contato";
      if (/já existe|already exists|duplicate/i.test(message)) {
        toast.info("Contato já existe");
        return;
      }
      toast.error(message);
    }
  };

  // ── Media send helper ──────────────────────────────
  const sendMediaMessage = async (
    base64: string,
    mimetype: string,
    messageType: "image" | "audio" | "document",
    caption?: string,
  ) => {
    if (!selected || isSending) return;
    setIsSending(true);

    // Optimistic message
    const tempId = `temp-${Date.now()}`;
    const optimisticMsg: MessageItem = {
      id: tempId,
      conversation_id: selected,
      sender_id: null,
      text: caption || `[${messageType}]`,
      sent: true,
      read: false,
      delivered: false,
      is_system: false,
      message_type: messageType,
      has_media: true,
      media_mimetype: mimetype,
      media_url: null,
      reaction: null,
      created_at: new Date().toISOString(),
    };
    setChatMessages((prev) => [...prev, optimisticMsg]);

    try {
      const msg = await apiSendMedia(selected, {
        media_base64: base64,
        media_mimetype: mimetype,
        caption: caption || "",
        message_type: messageType,
      });
      setChatMessages((prev) =>
        prev.map((m) => (m.id === tempId ? { ...msg } : m)),
      );
      fetchConversations();
    } catch (err: unknown) {
      setChatMessages((prev) => prev.filter((m) => m.id !== tempId));
      toast.error(err instanceof Error ? err.message : "Erro ao enviar mídia");
    } finally {
      setIsSending(false);
    }
  };

  // ── Image upload ──────────────────────────────
  const handleImageSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    await preparePendingImage(file);
    // Reset input so same file can be re-selected
    e.target.value = "";
  };

  const handleComposerPaste = useCallback(
    async (e: React.ClipboardEvent<HTMLElement>) => {
      const items = Array.from(e.clipboardData?.items || []);
      const imageItem = items.find((item) => item.type.startsWith("image/"));
      if (!imageItem) return;

      const file = imageItem.getAsFile();
      if (!file) return;
      e.preventDefault();
      await preparePendingImage(file);
    },
    [preparePendingImage],
  );

  const handleChatDragOver = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    if (!Array.from(e.dataTransfer.types).includes("Files")) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = "copy";
    setIsDragOverChat(true);
  }, []);

  const handleChatDragLeave = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    if (e.currentTarget.contains(e.relatedTarget as Node)) return;
    setIsDragOverChat(false);
  }, []);

  const handleChatDrop = useCallback(
    async (e: React.DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      setIsDragOverChat(false);
      const file = Array.from(e.dataTransfer.files || []).find((f) =>
        f.type.startsWith("image/"),
      );
      if (!file) {
        toast.info("Arraste uma imagem para enviar.");
        return;
      }
      await preparePendingImage(file);
    },
    [preparePendingImage],
  );

  // ── Document upload ──────────────────────────────
  const handleDocumentSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 30 * 1024 * 1024) {
      toast.error("Arquivo muito grande (máximo 30MB).");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      const base64 = result.split(",")[1];
      sendMediaMessage(base64, file.type, "document", file.name);
    };
    reader.readAsDataURL(file);
    e.target.value = "";
  };

  // ── Audio recording (real MediaRecorder) ──────────
  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      audioStreamRef.current = stream;
      audioChunksRef.current = [];

      const recorder = new MediaRecorder(stream, {
        mimeType: "audio/webm;codecs=opus",
      });
      mediaRecorderRef.current = recorder;

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) audioChunksRef.current.push(e.data);
      };

      recorder.start(250); // collect data every 250ms
      setIsRecording(true);
      setIsPaused(false);
      setRecordTime(0);
      recordInterval.current = setInterval(() => {
        setRecordTime((t) => t + 1);
      }, 1000);
    } catch {
      toast.error("Não foi possível acessar o microfone.");
    }
  };

  const pauseRecording = () => {
    if (
      mediaRecorderRef.current &&
      mediaRecorderRef.current.state === "recording"
    ) {
      mediaRecorderRef.current.pause();
    }
    setIsPaused(true);
    if (recordInterval.current) clearInterval(recordInterval.current);
  };

  const resumeRecording = () => {
    if (
      mediaRecorderRef.current &&
      mediaRecorderRef.current.state === "paused"
    ) {
      mediaRecorderRef.current.resume();
    }
    setIsPaused(false);
    recordInterval.current = setInterval(() => {
      setRecordTime((t) => t + 1);
    }, 1000);
  };

  const cancelRecording = () => {
    if (
      mediaRecorderRef.current &&
      mediaRecorderRef.current.state !== "inactive"
    ) {
      mediaRecorderRef.current.onstop = null; // prevent send
      mediaRecorderRef.current.stop();
    }
    audioStreamRef.current?.getTracks().forEach((t) => t.stop());
    audioStreamRef.current = null;
    audioChunksRef.current = [];
    setIsRecording(false);
    setIsPaused(false);
    setRecordTime(0);
    if (recordInterval.current) clearInterval(recordInterval.current);
  };

  const sendRecording = () => {
    const recorder = mediaRecorderRef.current;
    if (!recorder || recorder.state === "inactive") return;

    recorder.onstop = () => {
      const mimeType = recorder.mimeType || "audio/webm;codecs=opus";
      const blob = new Blob(audioChunksRef.current, { type: mimeType });
      audioStreamRef.current?.getTracks().forEach((t) => t.stop());
      audioStreamRef.current = null;

      const reader = new FileReader();
      reader.onload = () => {
        const result = reader.result as string;
        const base64 = result.split(",")[1];
        sendMediaMessage(base64, mimeType, "audio");
      };
      reader.readAsDataURL(blob);
      audioChunksRef.current = [];
    };
    recorder.stop();

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
    if ((!messageText.trim() && !pendingImage) || !selected || isSending) return;

    if (pendingImage) {
      const caption = messageText.trim();
      setMessageText("");
      await sendMediaMessage(
        pendingImage.base64,
        pendingImage.mimetype,
        "image",
        caption,
      );
      clearPendingImage();
      return;
    }

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
      media_url: null,
      reaction: null,
      created_at: new Date().toISOString(),
    };
    setChatMessages((prev) => [...prev, optimisticMsg]);

    try {
      const msg = await apiSendMessage(selected, { text });
      // Replace optimistic msg with real one (sent to server = single check still)
      setChatMessages((prev) =>
        prev.map((m) => (m.id === tempId ? { ...msg } : m)),
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
    if (!selected) return;
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
              <h2 className="text-lg font-semibold text-foreground">
                Conversas
              </h2>
              <button
                onClick={() => setShowAdvFilters(!showAdvFilters)}
                className={cn(
                  "p-1.5 rounded-lg transition-colors",
                  showAdvFilters
                    ? "bg-primary/10 text-primary"
                    : "text-muted-foreground hover:bg-muted",
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
                    {apiUsers.map((u) => (
                      <option key={u.id} value={u.name}>
                        {u.name}
                      </option>
                    ))}
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
                    onClick={() =>
                      setStatusFilter(isActive ? "todos" : sf.value)
                    }
                    className={cn(
                      "flex-1 flex flex-col items-center py-2 px-1 rounded-lg text-center transition-all",
                      isActive
                        ? "bg-primary text-primary-foreground"
                        : "bg-muted text-muted-foreground hover:bg-muted/80",
                    )}
                  >
                    <span className="text-[11px] font-medium leading-tight">
                      {sf.label}
                    </span>
                    <span
                      className={cn(
                        "text-sm font-bold",
                        isActive
                          ? "text-primary-foreground"
                          : "text-foreground",
                      )}
                    >
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
                  selected === conv.id && "bg-muted",
                )}
              >
                <div className="relative flex-shrink-0 mt-0.5">
                  {conv.contact_photo ? (
                    <img
                      src={conv.contact_photo}
                      alt={conv.contact_name}
                      className="w-10 h-10 rounded-full object-cover"
                      onError={(e) => {
                        (e.target as HTMLImageElement).style.display = "none";
                        (
                          e.target as HTMLImageElement
                        ).nextElementSibling?.classList.remove("hidden");
                      }}
                    />
                  ) : null}
                  <div
                    className={cn(
                      "w-10 h-10 rounded-full gradient-green flex items-center justify-center text-xs font-bold text-primary-foreground",
                      conv.contact_photo && "hidden",
                    )}
                  >
                    {getInitials(conv.contact_name)}
                  </div>
                </div>
                <div className="flex-1 min-w-0 flex gap-0">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className="text-sm font-semibold text-foreground truncate">
                        {conv.contact_name}
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground truncate mt-0.5 flex items-center gap-1">
                      {(() => {
                        const msg = conv.last_message || "";
                        const lower = msg.toLowerCase().trim();
                        const canShowStickerThumb =
                          conv.last_message_type === "sticker" &&
                          conv.last_message_has_media &&
                          !!conv.last_message_id &&
                          !!conv.last_message_media_mimetype &&
                          conv.last_message_media_mimetype.startsWith("image/");

                        if (canShowStickerThumb)
                          return (
                            <>
                              <img
                                src={getMediaUrl(conv.id, conv.last_message_id!)}
                                alt="Figurinha"
                                className="w-5 h-5 rounded object-cover flex-shrink-0"
                                loading="lazy"
                              />
                              Figurinha
                            </>
                          );

                        if (lower === "[audio]" || lower === "[áudio]")
                          return (
                            <>
                              <Mic className="w-3 h-3 flex-shrink-0" /> Áudio
                            </>
                          );
                        if (lower === "[imagem]" || lower === "[image]")
                          return (
                            <>
                              <Image className="w-3 h-3 flex-shrink-0" /> Imagem
                            </>
                          );
                        if (lower === "[documento]" || lower === "[document]")
                          return (
                            <>
                              <FileText className="w-3 h-3 flex-shrink-0" />{" "}
                              Documento
                            </>
                          );
                        if (lower === "[sticker]" || lower === "[figurinha]")
                          return (
                            <>
                              <Sticker className="w-3 h-3 flex-shrink-0" />{" "}
                              Figurinha
                            </>
                          );
                        if (conv.last_message_type === "sticker")
                          return (
                            <>
                              <Sticker className="w-3 h-3 flex-shrink-0" />{" "}
                              Figurinha
                            </>
                          );
                        if (lower === "[vídeo]" || lower === "[video]")
                          return (
                            <>
                              <Play className="w-3 h-3 flex-shrink-0" /> Vídeo
                            </>
                          );

                        const sharedContactPreview = parseSharedContact(msg);
                        if (sharedContactPreview)
                          return (
                            <>
                              <MessageCircle className="w-3 h-3 flex-shrink-0" />
                              {`Contato: ${sharedContactPreview.name}`}
                            </>
                          );

                        if (
                          lower === "[localização]" ||
                          lower === "[localizacao]" ||
                          /^\[localiza[çc][aã]o:-?[\d.]+\|-?[\d.]+/i.test(msg)
                        )
                          return (
                            <>
                              <span className="text-xs">📍</span> Localização
                            </>
                          );

                        return msg || "Sem mensagens";
                      })()}
                    </p>
                  </div>
                  <div className="flex flex-col items-end flex-shrink-0 pl-3 ml-2 gap-1 min-w-[100px]">
                    <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
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
                        <span className="truncate max-w-[90px]">
                          {conv.attendant_name}
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              </button>
            ))}
            {filtered.length === 0 && (
              <div className="py-12 text-center text-muted-foreground text-sm">
                Nenhuma conversa encontrada
              </div>
            )}
          </div>
        </div>

        {/* Chat Area */}
        <div className="flex-1 flex flex-col">
          {!selected ? (
            /* ── Empty state placeholder ── */
            <div className="flex-1 flex flex-col items-center justify-center bg-muted/30 select-none">
              <div className="flex flex-col items-center gap-6 max-w-sm text-center animate-fade-in">
                <div className="w-24 h-24 rounded-full bg-primary/10 flex items-center justify-center">
                  <MessageCircle className="w-12 h-12 text-primary/60" />
                </div>
                <div className="space-y-2">
                  <h2 className="text-xl font-semibold text-foreground">
                    Suas conversas
                  </h2>
                  <p className="text-sm text-muted-foreground leading-relaxed">
                    Selecione uma conversa ao lado para visualizar as mensagens e
                    começar a interagir com seus contatos.
                  </p>
                </div>
                <div className="flex items-center gap-6 text-muted-foreground/60 text-xs pt-2">
                  <div className="flex flex-col items-center gap-1.5">
                    <div className="w-10 h-10 rounded-lg bg-muted flex items-center justify-center">
                      <SendIcon className="w-4 h-4" />
                    </div>
                    <span>Enviar</span>
                  </div>
                  <div className="flex flex-col items-center gap-1.5">
                    <div className="w-10 h-10 rounded-lg bg-muted flex items-center justify-center">
                      <Mic className="w-4 h-4" />
                    </div>
                    <span>Áudio</span>
                  </div>
                  <div className="flex flex-col items-center gap-1.5">
                    <div className="w-10 h-10 rounded-lg bg-muted flex items-center justify-center">
                      <Image className="w-4 h-4" />
                    </div>
                    <span>Imagem</span>
                  </div>
                  <div className="flex flex-col items-center gap-1.5">
                    <div className="w-10 h-10 rounded-lg bg-muted flex items-center justify-center">
                      <ArrowRightLeft className="w-4 h-4" />
                    </div>
                    <span>Transferir</span>
                  </div>
                </div>
              </div>
            </div>
          ) : (
          <>
          {/* Chat header */}
          <div className="border-b border-border">
            <div className="flex items-center justify-between px-5 py-3">
              <div className="flex items-center gap-3 min-w-0">
                <button
                  onClick={() => setShowClientPanel(true)}
                  className="flex-shrink-0"
                >
                  {selectedConv?.contact_photo ? (
                    <img
                      src={selectedConv.contact_photo}
                      alt={selectedConv.contact_name}
                      className="w-10 h-10 rounded-full object-cover"
                      onError={(e) => {
                        (e.target as HTMLImageElement).style.display = "none";
                        (
                          e.target as HTMLImageElement
                        ).nextElementSibling?.classList.remove("hidden");
                      }}
                    />
                  ) : null}
                  <div
                    className={cn(
                      "w-10 h-10 rounded-full gradient-green flex items-center justify-center text-xs font-bold text-primary-foreground",
                      selectedConv?.contact_photo && "hidden",
                    )}
                  >
                    {selectedConv
                      ? getInitials(selectedConv.contact_name)
                      : "?"}
                  </div>
                </button>
                <button
                  onClick={() => setShowClientPanel(true)}
                  className="text-left hover:opacity-80 transition-opacity min-w-0"
                >
                  <p className="text-sm font-semibold text-foreground truncate">
                    {selectedConv?.contact_name || "Selecione"}
                  </p>
                  <p className="text-xs text-muted-foreground truncate">
                    {selectedConv?.contact_phone}
                    {selectedConv && (
                      <span className="text-muted-foreground/60">
                        {" "}
                        • {selectedConv.attendant_name || "Atendente"}
                      </span>
                    )}
                  </p>
                </button>

                {selectedConv &&
                  (() => {
                    const s = selectedConv.status;
                    const statusConfig = {
                      atendendo: {
                        label: "Em Atendimento",
                        classes:
                          "bg-emerald-500/10 text-emerald-600 border-emerald-500/20",
                      },
                      aguardando: {
                        label: "Aguardando",
                        classes:
                          "bg-amber-500/10 text-amber-600 border-amber-500/20",
                      },
                      finalizado: {
                        label: "Finalizado",
                        classes: "bg-muted text-muted-foreground border-border",
                      },
                    };
                    const cfg = statusConfig[s] || statusConfig.aguardando;
                    return (
                      <span
                        className={cn(
                          "ml-2 px-2.5 py-0.5 rounded-full text-[11px] font-semibold border flex-shrink-0",
                          cfg.classes,
                        )}
                      >
                        {cfg.label}
                      </span>
                    );
                  })()}
              </div>

              <div
                className="flex items-center gap-2 flex-shrink-0 relative"
                ref={statusMenuRef}
              >
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
                  onClick={() => {
                    setShowStatusMenu(!showStatusMenu);
                  }}
                  className={cn(
                    "flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-sm font-medium transition-colors",
                    showStatusMenu
                      ? "bg-primary text-primary-foreground border-primary"
                      : "border-border text-foreground hover:bg-muted",
                  )}
                >
                  Status
                  <ChevronDown className="w-3.5 h-3.5" />
                </button>

                {/* Finalizar */}
                <button
                  onClick={async () => {
                    if (!selected) return;
                    try {
                      await apiUpdateConversation(selected, {
                        status: "finalizado",
                      });
                      toast.success("Conversa finalizada");
                      fetchConversations();
                    } catch {
                      toast.error("Erro ao finalizar");
                    }
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
                      <span className="text-sm font-semibold text-foreground">
                        Alterar Status
                      </span>
                    </div>
                    <div className="py-1">
                      {[
                        {
                          value: "atendendo" as ConversationStatus,
                          label: "Em Atendimento",
                          color: "bg-emerald-500",
                        },
                        {
                          value: "aguardando" as ConversationStatus,
                          label: "Aguardando",
                          color: "bg-amber-500",
                        },
                        {
                          value: "finalizado" as ConversationStatus,
                          label: "Finalizado",
                          color: "bg-muted-foreground",
                        },
                      ].map((status) => {
                        const isActive = selectedConv?.status === status.value;
                        return (
                          <button
                            key={status.value}
                            onClick={async () => {
                              if (!selected) return;
                              try {
                                await apiUpdateConversation(selected, {
                                  status: status.value,
                                });
                                setShowStatusMenu(false);
                                fetchConversations();
                              } catch {
                                toast.error("Erro ao alterar status");
                              }
                            }}
                            className={cn(
                              "w-full flex items-center gap-3 px-4 py-2.5 text-left text-sm transition-colors",
                              isActive
                                ? "bg-muted font-medium"
                                : "text-foreground hover:bg-muted/50",
                            )}
                          >
                            <div
                              className={cn(
                                "w-2.5 h-2.5 rounded-full",
                                status.color,
                              )}
                            />
                            {status.label}
                            {isActive && (
                              <Check className="w-3.5 h-3.5 ml-auto text-primary" />
                            )}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          <div
            ref={messagesContainerRef}
            onDragOver={handleChatDragOver}
            onDragLeave={handleChatDragLeave}
            onDrop={handleChatDrop}
            onScroll={() => {
              // Ignore scroll events caused by our own programmatic scrolls
              if (programmaticScroll.current) {
                const el = messagesContainerRef.current;
                if (el) {
                  const dist = el.scrollHeight - el.scrollTop - el.clientHeight;
                  if (dist < 5) programmaticScroll.current = false;
                }
                return;
              }
              const el = messagesContainerRef.current;
              if (!el) return;
              const distanceFromBottom =
                el.scrollHeight - el.scrollTop - el.clientHeight;
              isUserNearBottom.current = distanceFromBottom < 150;
            }}
            className="flex-1 overflow-y-auto p-5 space-y-3 bg-muted/30"
          >
            {isDragOverChat && (
              <div className="sticky top-2 z-20 rounded-xl border-2 border-dashed border-primary/60 bg-card/95 py-3 px-4 text-center text-sm font-medium text-foreground">
                Solte a imagem para anexar com legenda
              </div>
            )}
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
              const isSticker =
                msg.message_type === "sticker" ||
                (msg.has_media && msg.media_mimetype === "image/webp");
              const sharedContact = parseSharedContact(msg.text || "");
              const sharedLocation = parseLocation(msg.text || "");
              const displayText = (() => {
                const raw = (msg.text || "").trim();
                if (sharedContact) return null;
                if (sharedLocation) return null;
                if (
                  /^\[Localização\]$/i.test(raw) ||
                  /^\[Localizacao\]$/i.test(raw)
                ) {
                  return "Localização compartilhada";
                }
                if (/^\[Video\]$/i.test(raw)) return "Vídeo";
                if (/^\[Document\]$/i.test(raw)) return "Documento";
                if (/^\[Image\]$/i.test(raw)) return "Imagem";
                if (/^\[Audio\]$/i.test(raw)) return "Áudio";
                if (/^\[Figurinha\]$/i.test(raw) || /^\[Sticker\]$/i.test(raw)) {
                  return "Figurinha";
                }
                return msg.text;
              })();
              return (
                <div
                  key={msg.id}
                  className={cn(
                    "flex",
                    msg.sent ? "justify-end" : "justify-start",
                  )}
                >
                  <div
                    className={cn(
                      "relative",
                      isSticker ? "max-w-[230px]" : "max-w-[65%]",
                      msg.reaction && "mb-3",
                    )}
                  >
                    <div
                      className={cn(
                        "text-sm overflow-hidden",
                        isSticker
                          ? "bg-transparent text-foreground rounded-none"
                          : msg.sent
                            ? "rounded-2xl bg-primary text-primary-foreground rounded-br-md"
                            : "rounded-2xl bg-muted text-foreground rounded-bl-md",
                      )}
                    >
                      {/* Media content */}
                      {msg.has_media && msg.media_mimetype && selected && (
                        <>
                          {msg.media_mimetype.startsWith("image/") && (
                            <img
                              src={getMediaUrl(selected, msg.id)}
                              alt={isSticker ? "Figurinha" : "Imagem"}
                              className={cn(
                                "cursor-pointer",
                                isSticker
                                  ? "w-44 h-44 object-contain"
                                  : "w-full max-h-80 object-cover",
                              )}
                              loading="lazy"
                              onLoad={() => {
                                if (isUserNearBottom.current) scrollToBottom();
                              }}
                              onClick={() =>
                                window.open(
                                  getMediaUrl(selected, msg.id),
                                  "_blank",
                                )
                              }
                            />
                          )}
                          {msg.media_mimetype.startsWith("audio/") && (
                            <AudioPlayer
                              src={getMediaUrl(selected, msg.id)}
                              sent={msg.sent}
                            />
                          )}
                          {msg.media_mimetype.startsWith("video/") && (
                            <video
                              controls
                              className="w-full max-h-80"
                              preload="none"
                            >
                              <source
                                src={getMediaUrl(selected, msg.id)}
                                type={msg.media_mimetype}
                              />
                            </video>
                          )}
                          {!msg.media_mimetype.startsWith("image/") &&
                            !msg.media_mimetype.startsWith("audio/") &&
                            !msg.media_mimetype.startsWith("video/") && (
                              <div className="px-4 pt-2">
                                <a
                                  href={getMediaUrl(selected, msg.id)}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className={cn(
                                    "underline text-xs",
                                    msg.sent
                                      ? "text-primary-foreground"
                                      : "text-foreground",
                                  )}
                                >
                                  📎 Baixar arquivo
                                </a>
                              </div>
                            )}
                        </>
                      )}
                      {/* Location card — opens Google Maps */}
                      {sharedLocation && (
                        <div className="py-2 px-2">
                          <a
                            href={`https://www.google.com/maps?q=${sharedLocation.lat},${sharedLocation.lng}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="block no-underline"
                          >
                            <div
                              className={cn(
                                "w-[230px] rounded-xl overflow-hidden",
                                msg.sent
                                  ? "bg-primary/10 border border-primary/20"
                                  : "bg-background border border-border",
                              )}
                            >
                              {/* Static map thumbnail via OpenStreetMap */}
                              <div className="relative w-full h-32 overflow-hidden bg-muted">
                                <iframe
                                  src={`https://www.openstreetmap.org/export/embed.html?bbox=${sharedLocation.lng - 0.005},${sharedLocation.lat - 0.003},${sharedLocation.lng + 0.005},${sharedLocation.lat + 0.003}&layer=mapnik&marker=${sharedLocation.lat},${sharedLocation.lng}`}
                                  className="w-full h-full border-0 pointer-events-none"
                                  loading="lazy"
                                  title="Localização"
                                />
                              </div>
                              <div className="px-3 pt-2 pb-1">
                                <p
                                  className={cn(
                                    "text-xs font-semibold leading-tight",
                                    msg.sent
                                      ? "text-primary-foreground"
                                      : "text-foreground",
                                  )}
                                >
                                  Localização compartilhada
                                </p>
                                {sharedLocation.name && (
                                  <p
                                    className={cn(
                                      "text-[11px] mt-0.5",
                                      msg.sent
                                        ? "text-primary-foreground/70"
                                        : "text-muted-foreground",
                                    )}
                                  >
                                    {sharedLocation.name}
                                  </p>
                                )}
                              </div>
                              <div
                                className={cn(
                                  "border-t mt-1",
                                  msg.sent
                                    ? "border-primary/20"
                                    : "border-border",
                                )}
                              >
                                <p
                                  className={cn(
                                    "w-full py-2.5 text-xs font-medium text-center",
                                    msg.sent
                                      ? "text-primary-foreground"
                                      : "text-primary",
                                  )}
                                >
                                  Abrir no Google Maps
                                </p>
                              </div>
                            </div>
                          </a>
                        </div>
                      )}
                      {/* Shared contact card — WhatsApp style */}
                      {sharedContact && (
                        <div className="py-2 px-2">
                          <div
                            className={cn(
                              "w-[230px] rounded-xl overflow-hidden",
                              msg.sent
                                ? "bg-primary/10 border border-primary/20"
                                : "bg-background border border-border",
                            )}
                          >
                            <div className="flex flex-col items-center pt-4 pb-3 px-4 gap-2">
                              <div className="w-16 h-16 rounded-full bg-muted-foreground/20 flex items-center justify-center overflow-hidden">
                                {sharedContact.picUrl ? (
                                  <img
                                    src={sharedContact.picUrl}
                                    alt={sharedContact.name}
                                    className="w-full h-full object-cover"
                                    onError={(e) => {
                                      (e.currentTarget as HTMLImageElement).style.display = "none";
                                      (e.currentTarget.nextElementSibling as HTMLElement | null)?.style &&
                                        ((e.currentTarget.nextElementSibling as HTMLElement).style.display = "flex");
                                    }}
                                  />
                                ) : null}
                                <span
                                  className="text-xl font-bold text-muted-foreground select-none"
                                  style={{ display: sharedContact.picUrl ? "none" : "flex" }}
                                >
                                  {sharedContact.name
                                    .split(" ")
                                    .filter(Boolean)
                                    .slice(0, 2)
                                    .map((w) => w[0].toUpperCase())
                                    .join("")}
                                </span>
                              </div>
                              <div className="text-center">
                                <p className="text-sm font-semibold leading-tight text-foreground">
                                  {sharedContact.name}
                                </p>
                                {sharedContact.phone && (
                                  <p className="text-[11px] text-muted-foreground mt-0.5">
                                    {sharedContact.phone}
                                  </p>
                                )}
                              </div>
                            </div>
                            <div
                              className={cn(
                                "border-t",
                                msg.sent
                                  ? "border-primary/20"
                                  : "border-border",
                              )}
                            >
                              <button
                                onClick={() =>
                                  sharedContact.phone
                                    ? void saveSharedContact(
                                        sharedContact.name,
                                        sharedContact.phone,
                                      )
                                    : undefined
                                }
                                disabled={!sharedContact.phone}
                                className={cn(
                                  "w-full py-2.5 text-xs font-medium text-center transition-colors",
                                  sharedContact.phone
                                    ? "text-primary hover:bg-primary/10 cursor-pointer"
                                    : "text-muted-foreground cursor-default",
                                )}
                              >
                                {sharedContact.phone
                                  ? "Adicionar contato"
                                  : "Sem número"}
                              </button>
                            </div>
                          </div>
                        </div>
                      )}
                      {/* Text content — hide placeholder text like [Image], [Audio] when media exists */}
                      {!sharedContact &&
                        !sharedLocation &&
                        displayText &&
                        msg.text !== "[Erro ao descriptografar]" &&
                        !(
                          msg.has_media &&
                          /^\[(image|imagem|audio|áudio|video|vídeo|document|documento|sticker|figurinha)\]$/i.test(
                            msg.text,
                          )
                        ) && <p className="px-4 py-2.5">{displayText}</p>}
                      {/* Decryption failure — shown subtly so it's clear it's a system note */}
                      {msg.text === "[Erro ao descriptografar]" && (
                        <p className="px-4 py-2.5 italic text-xs opacity-50">
                          Mensagem indisponível
                        </p>
                      )}
                      {!msg.text && !msg.has_media && (
                        <p className="px-4 py-2.5">&nbsp;</p>
                      )}
                      <div
                        className={cn(
                          "flex items-center justify-end gap-1",
                          isSticker
                            ? "mt-1 px-1 pb-0 text-muted-foreground"
                            : msg.sent
                              ? "px-4 pb-2 text-primary-foreground/70"
                              : "px-4 pb-2 text-muted-foreground",
                        )}
                      >
                        <span className="text-[10px]">
                          {formatTime(msg.created_at)}
                        </span>
                        {msg.sent &&
                          (msg.delivered || msg.read ? (
                            <CheckCheck className="w-3 h-3" />
                          ) : (
                            <Check className="w-3 h-3" />
                          ))}
                      </div>
                    </div>
                    {/* Reaction emoji displayed on the message bubble */}
                    {msg.reaction && (
                      <div
                        className={cn(
                          "absolute -bottom-3 px-1.5 py-0.5 rounded-full bg-card border border-border shadow-sm text-sm leading-none select-none",
                          msg.sent ? "right-2" : "left-2",
                        )}
                      >
                        {msg.reaction}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
            {chatMessages.length === 0 && (
              <div className="flex justify-center pt-12 text-muted-foreground text-sm">
                Nenhuma mensagem ainda
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          <div className="px-5 py-3 border-t border-border relative">
            {/* Audio list popup */}
            {showAudioList && (
              <div className="absolute bottom-full left-5 right-5 mb-2 bg-card border border-border rounded-xl shadow-lg max-h-60 overflow-y-auto z-10">
                <div className="flex items-center justify-between px-4 py-3 border-b border-border">
                  <span className="text-sm font-semibold text-foreground">
                    Áudios Programados
                  </span>
                  <button
                    onClick={() => setShowAudioList(false)}
                    className="p-1 rounded hover:bg-muted"
                  >
                    <X className="w-4 h-4 text-muted-foreground" />
                  </button>
                </div>
                {savedAudios.length === 0 ? (
                  <p className="px-4 py-6 text-sm text-muted-foreground text-center">
                    Nenhum áudio salvo
                  </p>
                ) : (
                  savedAudios.map((audio) => (
                    <button
                      key={audio.id}
                      onClick={async () => {
                        setShowAudioList(false);
                        try {
                          const full = await getSavedAudio(audio.id);
                          sendMediaMessage(
                            full.audio_base64,
                            full.mimetype,
                            "audio",
                            audio.title,
                          );
                        } catch {
                          toast.error("Erro ao carregar áudio");
                        }
                      }}
                      className="w-full flex items-center gap-3 px-4 py-3 hover:bg-muted/50 transition-colors text-left"
                    >
                      <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                        <Mic className="w-4 h-4 text-primary" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-foreground truncate">
                          {audio.title}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {audio.duration}
                        </p>
                      </div>
                      <SendIcon className="w-4 h-4 text-primary flex-shrink-0" />
                    </button>
                  ))
                )}
              </div>
            )}

            {/* Attach popup */}
            {showAttach && (
              <div
                ref={attachMenuRef}
                className="absolute bottom-full left-5 mb-2 bg-card border border-border rounded-xl shadow-lg z-10 w-56"
              >
                <div className="py-2">
                  {[
                    {
                      icon: Image,
                      label: "Imagem",
                      color: "text-blue-500",
                      action: () => {
                        setShowAttach(false);
                        fileInputRef.current?.click();
                      },
                    },
                    {
                      icon: FileText,
                      label: "Documento",
                      color: "text-orange-500",
                      action: () => {
                        setShowAttach(false);
                        document.getElementById("doc-input")?.click();
                      },
                    },
                    {
                      icon: Mic,
                      label: "Áudios Programados",
                      color: "text-primary",
                      action: () => {
                        setShowAttach(false);
                        setShowAudioList(true);
                      },
                    },
                    {
                      icon: Sticker,
                      label: "Figurinha",
                      color: "text-pink-500",
                    },
                  ].map((item) => (
                    <button
                      key={item.label}
                      onClick={() => {
                        if (item.action) {
                          item.action();
                        } else {
                          setShowAttach(false);
                          toast.info("Funcionalidade em breve");
                        }
                      }}
                      className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-muted/50 transition-colors text-left"
                    >
                      <item.icon className={cn("w-5 h-5", item.color)} />
                      <span className="text-sm font-medium text-foreground">
                        {item.label}
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Hidden file inputs */}
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleImageSelect}
            />
            <input
              id="doc-input"
              type="file"
              accept="*/*"
              className="hidden"
              onChange={handleDocumentSelect}
            />

            {/* Emoji picker popup */}
            {showEmoji && (
              <div
                ref={emojiMenuRef}
                className="absolute bottom-full right-5 mb-2 bg-card border border-border rounded-xl shadow-lg z-10 p-4 w-72"
              >
                <div className="flex items-center justify-between mb-3">
                  <span className="text-sm font-semibold text-foreground">
                    Emojis
                  </span>
                  <button
                    onClick={() => setShowEmoji(false)}
                    className="p-1 rounded hover:bg-muted"
                  >
                    <X className="w-4 h-4 text-muted-foreground" />
                  </button>
                </div>
                <div className="grid grid-cols-8 gap-1">
                  {[
                    "😀",
                    "😂",
                    "😍",
                    "🥰",
                    "😎",
                    "🤩",
                    "😢",
                    "😡",
                    "👍",
                    "👎",
                    "❤️",
                    "🔥",
                    "🎉",
                    "✅",
                    "⭐",
                    "💬",
                    "📞",
                    "📸",
                    "🎁",
                    "💰",
                    "🙏",
                    "👋",
                    "🤝",
                    "💪",
                    "🏆",
                    "🎯",
                    "📌",
                    "⏰",
                    "📅",
                    "💡",
                    "🚀",
                    "✨",
                  ].map((emoji) => (
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
                <span
                  className="text-xs text-muted-foreground mr-1 cursor-pointer hover:text-foreground transition-colors"
                  onClick={cancelRecording}
                >
                  Cancelar
                </span>
                <button
                  onClick={cancelRecording}
                  className="w-10 h-10 rounded-full border border-border flex items-center justify-center text-muted-foreground hover:text-destructive hover:border-destructive transition-colors flex-shrink-0"
                  title="Descartar"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
                <div className="flex items-center gap-2 px-3">
                  <div
                    className={cn(
                      "w-2.5 h-2.5 rounded-full bg-destructive",
                      !isPaused && "animate-pulse",
                    )}
                  />
                  <span className="text-sm font-mono font-semibold text-foreground min-w-[36px]">
                    {formatRecordTime(recordTime)}
                  </span>
                </div>
                <RecordingVisualizer
                  stream={audioStreamRef.current}
                  isPaused={isPaused}
                />
                <button
                  onClick={isPaused ? resumeRecording : pauseRecording}
                  className="w-10 h-10 rounded-full border border-border flex items-center justify-center text-muted-foreground hover:text-foreground hover:border-foreground transition-colors flex-shrink-0"
                  title={isPaused ? "Continuar" : "Pausar"}
                >
                  {isPaused ? (
                    <Play className="w-4 h-4" />
                  ) : (
                    <Pause className="w-4 h-4" />
                  )}
                </button>
                <button
                  onClick={sendRecording}
                  className="w-10 h-10 rounded-full bg-primary text-primary-foreground hover:bg-primary/90 transition-colors flex items-center justify-center flex-shrink-0"
                  title="Enviar áudio"
                >
                  <SendIcon className="w-5 h-5" />
                </button>
              </div>
            ) : (
              <div className="space-y-2" onPaste={handleComposerPaste}>
                {pendingImage && (
                  <div className="inline-flex items-start gap-3 rounded-xl border border-border bg-card p-2.5 max-w-[380px]">
                    <img
                      src={pendingImage.previewUrl}
                      alt="Prévia"
                      className="w-16 h-16 rounded-md object-cover"
                    />
                    <div className="min-w-0">
                      <p className="text-xs font-medium text-foreground truncate">
                        {pendingImage.name}
                      </p>
                    </div>
                    <button
                      onClick={clearPendingImage}
                      className="p-1 rounded hover:bg-muted"
                      title="Remover imagem"
                    >
                      <X className="w-4 h-4 text-muted-foreground" />
                    </button>
                  </div>
                )}

                <div className="flex gap-2 items-center">
                <button
                  onClick={() => {
                    setShowAttach(!showAttach);
                    setShowEmoji(false);
                    setShowAudioList(false);
                  }}
                  className={cn(
                    "p-2.5 rounded-lg transition-colors flex-shrink-0",
                    showAttach
                      ? "bg-primary text-primary-foreground"
                      : "text-muted-foreground hover:text-foreground hover:bg-muted",
                  )}
                  title="Anexar"
                >
                  <Plus className="w-5 h-5" />
                </button>
                <button
                  onClick={() => {
                    setShowEmoji(!showEmoji);
                    setShowAttach(false);
                    setShowAudioList(false);
                  }}
                  className={cn(
                    "p-2.5 rounded-lg transition-colors flex-shrink-0",
                    showEmoji
                      ? "bg-primary text-primary-foreground"
                      : "text-muted-foreground hover:text-foreground hover:bg-muted",
                  )}
                  title="Emoji"
                >
                  <Smile className="w-5 h-5" />
                </button>
                <input
                  type="text"
                  placeholder={
                    pendingImage
                      ? "Adicione uma legenda (opcional)..."
                      : "Digite uma mensagem..."
                  }
                  value={messageText}
                  onChange={(e) => handleMessageInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      sendMessage();
                    }
                  }}
                  className="flex-1 bg-muted rounded-lg px-4 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary/50"
                />
                <button
                  onClick={startRecording}
                  className="p-2.5 rounded-lg transition-colors flex-shrink-0 text-muted-foreground hover:text-foreground hover:bg-muted"
                  title="Gravar áudio"
                >
                  <Mic className="w-5 h-5" />
                </button>
                <button
                  onClick={sendMessage}
                  disabled={isSending || (!messageText.trim() && !pendingImage)}
                  className={cn(
                    "p-2.5 rounded-lg transition-colors flex-shrink-0",
                    isSending || (!messageText.trim() && !pendingImage)
                      ? "bg-muted text-muted-foreground cursor-not-allowed"
                      : "bg-primary text-primary-foreground hover:bg-primary/90",
                  )}
                >
                  <SendIcon className="w-5 h-5" />
                </button>
              </div>
              </div>
            )}
          </div>
          </>
          )}
        </div>

        {/* Client Detail Panel */}
        <ClientDetailPanel
          open={showClientPanel}
          onOpenChange={setShowClientPanel}
          conversationId={selected || null}
          contact={
            selectedConv
              ? {
                  name: selectedConv.contact_name,
                  phone: selectedConv.contact_phone,
                  avatar: getInitials(selectedConv.contact_name),
                  photo: selectedConv.contact_photo,
                }
              : null
          }
          tags={selectedConv?.tags?.map((t) => t.name) ?? []}
          allTagIds={selectedConv?.tags?.map((t) => t.id) ?? []}
          onToggleTag={async (tagId, tagName) => {
            if (!selected || !selectedConv) return;
            const currentIds = selectedConv.tags?.map((t) => t.id) ?? [];
            const newIds = currentIds.includes(tagId)
              ? currentIds.filter((id) => id !== tagId)
              : [...currentIds, tagId];
            try {
              await apiUpdateConversationTags(selected, newIds);
              fetchConversations();
            } catch {
              toast.error("Erro ao atualizar etiquetas");
            }
          }}
        />
      </div>

      {/* Transfer Dialog */}
      <Dialog open={showTransferDialog} onOpenChange={setShowTransferDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Transferir Conversa</DialogTitle>
            <DialogDescription>
              Selecione o destino para transferir esta conversa.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground">
                Transferir para
              </label>
              <select
                value={transferUser}
                onChange={(e) => setTransferUser(e.target.value)}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <option value="">Selecione um usuário</option>
                {apiUsers.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.name} ({u.role === "admin" ? "Admin" : "Atendente"})
                  </option>
                ))}
              </select>
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowTransferDialog(false)}
            >
              Cancelar
            </Button>
            <Button onClick={handleTransfer} disabled={!transferUser}>
              Transferir
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}
