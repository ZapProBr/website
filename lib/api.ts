/* ─────────────────────────────────────────────
   ZapProBR – API Client (frontend → FastAPI)
   ───────────────────────────────────────────── */

const BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

// ── Token helpers ──────────────────────────────────────
export function getAccessToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem("zappro_access_token");
}

export function getRefreshToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem("zappro_refresh_token");
}

export function setTokens(access: string, refresh: string) {
  localStorage.setItem("zappro_access_token", access);
  localStorage.setItem("zappro_refresh_token", refresh);
  // Cookie readable by middleware (httpOnly = false so middleware can check existence)
  document.cookie = `zappro_logged_in=1; path=/; max-age=${60 * 60 * 24 * 7}; SameSite=Lax`;
}

export function clearTokens() {
  localStorage.removeItem("zappro_access_token");
  localStorage.removeItem("zappro_refresh_token");
  document.cookie = "zappro_logged_in=; path=/; max-age=0";
}

// ── Refresh logic ──────────────────────────────────────
let refreshPromise: Promise<boolean> | null = null;

async function refreshAccessToken(): Promise<boolean> {
  const rt = getRefreshToken();
  if (!rt) return false;
  try {
    const res = await fetch(`${BASE}/api/auth/refresh`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refresh_token: rt }),
    });
    if (!res.ok) return false;
    const data = await res.json();
    setTokens(data.access_token, data.refresh_token);
    return true;
  } catch {
    return false;
  }
}

// ── Generic fetch wrapper ──────────────────────────────
export async function api<T = unknown>(
  path: string,
  opts: RequestInit = {},
): Promise<T> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(opts.headers as Record<string, string>),
  };

  const token = getAccessToken();
  if (token) headers["Authorization"] = `Bearer ${token}`;

  let res = await fetch(`${BASE}${path}`, { ...opts, headers });

  // If 401, try refresh once
  if (res.status === 401 && token) {
    if (!refreshPromise) refreshPromise = refreshAccessToken();
    const ok = await refreshPromise;
    refreshPromise = null;

    if (ok) {
      headers["Authorization"] = `Bearer ${getAccessToken()}`;
      res = await fetch(`${BASE}${path}`, { ...opts, headers });
    } else {
      clearTokens();
      if (typeof window !== "undefined") window.location.href = "/login";
      throw new Error("Session expired");
    }
  }

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.detail || `API error ${res.status}`);
  }

  // Handle 204 No Content
  if (res.status === 204) return undefined as T;

  return res.json();
}

// ── Auth ───────────────────────────────────────────────
export interface LoginResponse {
  access_token: string;
  refresh_token: string;
  token_type: string;
}

export async function loginApi(email: string, password: string): Promise<LoginResponse> {
  const res = await fetch(`${BASE}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.detail || "Credenciais inválidas");
  }
  const data: LoginResponse = await res.json();
  setTokens(data.access_token, data.refresh_token);
  return data;
}

export interface UserMe {
  id: string;
  email: string;
  name: string;
  role: "admin" | "atendente";
  plan: "basic" | "pro" | "premium";
  is_active: boolean;
  workspace_id?: string;
}

export function getMe(): Promise<UserMe> {
  return api<UserMe>("/api/auth/me");
}

// ── Users ──────────────────────────────────────────────
export interface User {
  id: string;
  email: string;
  name: string;
  role: "admin" | "atendente";
  plan: "basic" | "pro" | "premium";
  is_active: boolean;
  created_at: string;
  workspace_id?: string;
}

export async function listUsers(): Promise<User[]> {
  const res = await api<{ users: User[]; total: number }>("/api/users");
  return res.users;
}

export function createUser(data: { email: string; name: string; password: string; role?: string; plan?: string }): Promise<User> {
  return api<User>("/api/users", { method: "POST", body: JSON.stringify(data) });
}

export function updateUser(id: string, data: Partial<{ name: string; email: string; password: string; role: string; plan: string; is_active: boolean }>): Promise<User> {
  return api<User>(`/api/users/${id}`, { method: "PUT", body: JSON.stringify(data) });
}

export function deleteUser(id: string): Promise<void> {
  return api<void>(`/api/users/${id}`, { method: "DELETE" });
}

// ── Tags ───────────────────────────────────────────────
export interface Tag {
  id: string;
  name: string;
  color: string;
}

export function listTags(): Promise<Tag[]> {
  return api<Tag[]>("/api/tags");
}

export function createTag(data: { name: string; color: string }): Promise<Tag> {
  return api<Tag>("/api/tags", { method: "POST", body: JSON.stringify(data) });
}

export function updateTag(id: string, data: Partial<{ name: string; color: string }>): Promise<Tag> {
  return api<Tag>(`/api/tags/${id}`, { method: "PUT", body: JSON.stringify(data) });
}

export function deleteTag(id: string): Promise<void> {
  return api<void>(`/api/tags/${id}`, { method: "DELETE" });
}

// ── Contacts ───────────────────────────────────────────
export interface Contact {
  id: string;
  name: string;
  phone: string;
  email: string | null;
  notes: string | null;
  profile_picture_url: string | null;
  tags: Tag[];
  created_at: string;
}

export async function listContacts(params?: { search?: string; tag_id?: string; skip?: number; limit?: number }): Promise<Contact[]> {
  const qs = new URLSearchParams();
  if (params?.search) qs.set("search", params.search);
  if (params?.tag_id) qs.set("tag_id", params.tag_id);
  if (params?.skip) qs.set("skip", String(params.skip));
  if (params?.limit) qs.set("limit", String(params.limit));
  const q = qs.toString();
  const res = await api<{ contacts: Contact[]; total: number }>(`/api/contacts${q ? `?${q}` : ""}`);
  return res.contacts;
}

export function createContact(data: { name: string; phone: string; email?: string; notes?: string; tag_ids?: string[] }): Promise<Contact> {
  return api<Contact>("/api/contacts", { method: "POST", body: JSON.stringify(data) });
}

export function updateContact(id: string, data: Partial<{ name: string; phone: string; email: string; notes: string; tag_ids: string[] }>): Promise<Contact> {
  return api<Contact>(`/api/contacts/${id}`, { method: "PUT", body: JSON.stringify(data) });
}

export function deleteContact(id: string): Promise<void> {
  return api<void>(`/api/contacts/${id}`, { method: "DELETE" });
}

export function bulkDeleteContacts(ids: string[]): Promise<{ deleted: number }> {
  return api<{ deleted: number }>("/api/contacts/bulk-delete", { method: "POST", body: JSON.stringify({ ids }) });
}

// ── Conversations ──────────────────────────────────────
export interface ConversationItem {
  id: string;
  contact_id: string;
  contact_name: string;
  contact_phone: string;
  contact_photo: string | null;
  status: "aguardando" | "atendendo" | "finalizado";
  attendant_id: string | null;
  attendant_name: string | null;
  connection_id: string | null;
  department: string | null;
  last_message: string | null;
  last_message_id: string | null;
  last_message_type: string | null;
  last_message_has_media: boolean;
  last_message_media_mimetype: string | null;
  unread_count: number;
  tags: Tag[];
  created_at: string;
  updated_at: string;
  contact: {
    id: string;
    name: string;
    phone: string;
    email: string | null;
    profile_picture_url: string | null;
  } | null;
}

export async function listConversations(params?: { status?: string; skip?: number; limit?: number }): Promise<ConversationItem[]> {
  const qs = new URLSearchParams();
  if (params?.status) qs.set("status", params.status);
  if (params?.skip) qs.set("skip", String(params.skip));
  if (params?.limit) qs.set("limit", String(params.limit));
  const q = qs.toString();
  const res = await api<{ conversations: ConversationItem[]; total: number }>(`/api/conversations${q ? `?${q}` : ""}`);
  return res.conversations;
}

export function createConversation(data: { contact_id: string; status?: string }): Promise<ConversationItem> {
  return api<ConversationItem>("/api/conversations", { method: "POST", body: JSON.stringify(data) });
}

export function updateConversation(id: string, data: Partial<{ status: string; attendant_id: string }>): Promise<ConversationItem> {
  return api<ConversationItem>(`/api/conversations/${id}`, { method: "PUT", body: JSON.stringify(data) });
}

export function updateConversationTags(id: string, tag_ids: string[]): Promise<ConversationItem> {
  return api<ConversationItem>(`/api/conversations/${id}/tags`, { method: "PUT", body: JSON.stringify({ tag_ids }) });
}

// ── Notes ──────────────────────────────────────────────
export interface NoteItem {
  id: string;
  conversation_id: string;
  user_id: string | null;
  user_name: string | null;
  text: string;
  created_at: string;
}

export function listNotes(conversationId: string): Promise<NoteItem[]> {
  return api<NoteItem[]>(`/api/conversations/${conversationId}/notes`);
}

export function createNote(conversationId: string, text: string): Promise<NoteItem> {
  return api<NoteItem>(`/api/conversations/${conversationId}/notes`, { method: "POST", body: JSON.stringify({ text }) });
}

export function deleteNote(conversationId: string, noteId: string): Promise<void> {
  return api<void>(`/api/conversations/${conversationId}/notes/${noteId}`, { method: "DELETE" });
}

// ── Messages ───────────────────────────────────────────
export interface MessageItem {
  id: string;
  conversation_id: string;
  sender_id: string | null;
  text: string;
  sent: boolean;
  read: boolean;
  delivered: boolean;
  is_system: boolean;
  message_type: string;
  has_media: boolean;
  media_mimetype: string | null;
  media_url: string | null;
  reaction: string | null;
  created_at: string;
}

export async function listMessages(conversationId: string, params?: { skip?: number; limit?: number }): Promise<MessageItem[]> {
  const qs = new URLSearchParams();
  if (params?.skip) qs.set("skip", String(params.skip));
  if (params?.limit) qs.set("limit", String(params.limit));
  const q = qs.toString();
  const res = await api<{ messages: MessageItem[]; total: number }>(`/api/conversations/${conversationId}/messages${q ? `?${q}` : ""}`);
  return res.messages;
}

export function getMediaUrl(conversationId: string, messageId: string): string {
  const token = getAccessToken();
  return `${BASE}/api/conversations/${conversationId}/messages/${messageId}/media${token ? `?token=${encodeURIComponent(token)}` : ""}`;  
}

export function sendMessage(conversationId: string, data: { text: string; message_type?: string }): Promise<MessageItem> {
  return api<MessageItem>(`/api/conversations/${conversationId}/messages`, { method: "POST", body: JSON.stringify(data) });
}

export function sendMedia(
  conversationId: string,
  data: { media_base64: string; media_mimetype: string; caption?: string; message_type?: "image" | "audio" | "document" | "sticker" },
): Promise<MessageItem> {
  return api<MessageItem>(`/api/conversations/${conversationId}/messages/media`, {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export function markMessagesRead(conversationId: string): Promise<{ updated: number }> {
  return api<{ updated: number }>(`/api/conversations/${conversationId}/messages/read`, { method: "PUT" });
}

export function sendTyping(conversationId: string): Promise<{ ok: boolean }> {
  return api<{ ok: boolean }>(`/api/conversations/${conversationId}/messages/typing`, { method: "POST" });
}

// ── Evolution (WhatsApp instances) ─────────────────────
export interface EvolutionInstance {
  instanceName: string;
  instanceId: string | null;
  status: string; // "open" | "close" | "connecting"
  number: string | null;
  profileName: string | null;
  profilePicUrl: string | null;
}

export function listInstances(): Promise<EvolutionInstance[]> {
  return api<EvolutionInstance[]>("/api/evolution/instances");
}

export function createInstance(data: { instanceName: string; number?: string }): Promise<EvolutionInstance> {
  return api<EvolutionInstance>("/api/evolution/instances", { method: "POST", body: JSON.stringify(data) });
}

export function getQrCode(name: string): Promise<{ base64: string | null; pairingCode: string | null; count: number | null }> {
  return api<{ base64: string | null; pairingCode: string | null; count: number | null }>(`/api/evolution/instances/${encodeURIComponent(name)}/qrcode`);
}

export function getInstanceStatus(name: string): Promise<{ instanceName: string; status: string }> {
  return api<{ instanceName: string; status: string }>(`/api/evolution/instances/${encodeURIComponent(name)}/status`);
}

export function restartInstance(name: string): Promise<unknown> {
  return api<unknown>(`/api/evolution/instances/${encodeURIComponent(name)}/restart`, { method: "PUT" });
}

export function logoutInstance(name: string): Promise<{ ok: boolean }> {
  return api<{ ok: boolean }>(`/api/evolution/instances/${encodeURIComponent(name)}/logout`, { method: "DELETE" });
}

export function deleteInstance(name: string): Promise<{ ok: boolean }> {
  return api<{ ok: boolean }>(`/api/evolution/instances/${encodeURIComponent(name)}`, { method: "DELETE" });
}

// ── WebSocket ──────────────────────────────────────────
export function getWebSocketUrl(): string {
  const token = getAccessToken();
  const wsBase = BASE.replace(/^http/, "ws");
  return `${wsBase}/ws${token ? `?token=${encodeURIComponent(token)}` : ""}`;
}

// ── Saved Audios (persistent, stored in DB) ────────────
export interface SavedAudio {
  id: string;
  title: string;
  duration: string | null;
  mimetype: string;
  created_at: string;
}

export interface SavedAudioWithData extends SavedAudio {
  audio_base64: string;
}

export function listSavedAudios(): Promise<SavedAudio[]> {
  return api<SavedAudio[]>("/api/saved-audios");
}

export function getSavedAudio(id: string): Promise<SavedAudioWithData> {
  return api<SavedAudioWithData>(`/api/saved-audios/${id}`);
}

export function createSavedAudio(data: {
  title: string;
  duration?: string;
  mimetype: string;
  audio_base64: string;
}): Promise<SavedAudio> {
  return api<SavedAudio>("/api/saved-audios", { method: "POST", body: JSON.stringify(data) });
}

export function deleteSavedAudio(id: string): Promise<void> {
  return api<void>(`/api/saved-audios/${id}`, { method: "DELETE" });
}

export function offerCall(instanceName: string, number: string, isVideo = false): Promise<unknown> {
  return api<unknown>(`/api/evolution/instances/${encodeURIComponent(instanceName)}/call`, {
    method: "POST",
    body: JSON.stringify({ number, callDuration: 30, isVideo }),
  });
}

// ── Broadcasts (Disparos) ──────────────────────────────
export interface BroadcastTag {
  id: string;
  name: string;
  color: string;
}

export interface BroadcastContentItem {
  id?: string;
  position: number;
  message_type: string;
  content: string | null;
  has_media?: boolean;
  media_mimetype: string | null;
  media_filename: string | null;
  // used only when creating
  media_base64?: string;
}

export interface BroadcastItem {
  id: string;
  title: string;
  connection_id: string;
  items: BroadcastContentItem[];
  target_type: string;
  status: string;
  total_recipients: number;
  sent_count: number;
  failed_count: number;
  tags: BroadcastTag[];
  contact_ids: string[];
  scheduled_at: string | null;
  created_at: string;
  updated_at: string;
}

export async function listBroadcasts(params?: { skip?: number; limit?: number }): Promise<{ broadcasts: BroadcastItem[]; total: number }> {
  const qs = new URLSearchParams();
  if (params?.skip) qs.set("skip", String(params.skip));
  if (params?.limit) qs.set("limit", String(params.limit));
  const q = qs.toString();
  return api<{ broadcasts: BroadcastItem[]; total: number }>(`/api/broadcasts${q ? `?${q}` : ""}`);
}

export function createBroadcast(data: {
  title: string;
  connection_id: string;
  items: {
    message_type: string;
    content?: string;
    media_base64?: string;
    media_mimetype?: string;
    media_filename?: string;
  }[];
  target_type?: string;
  tag_ids?: string[];
  contact_ids?: string[];
}): Promise<BroadcastItem> {
  return api<BroadcastItem>("/api/broadcasts", { method: "POST", body: JSON.stringify(data) });
}

export function getBroadcast(id: string): Promise<BroadcastItem> {
  return api<BroadcastItem>(`/api/broadcasts/${id}`);
}

export function sendBroadcast(id: string): Promise<BroadcastItem> {
  return api<BroadcastItem>(`/api/broadcasts/${id}/send`, { method: "POST" });
}

export function deleteBroadcast(id: string): Promise<void> {
  return api<void>(`/api/broadcasts/${id}`, { method: "DELETE" });
}

export function stopBroadcast(id: string): Promise<BroadcastItem> {
  return api<BroadcastItem>(`/api/broadcasts/${id}/stop`, { method: "POST" });
}

export function updateBroadcast(
  id: string,
  data: {
    title?: string;
    connection_id?: string;
    items?: {
      message_type: string;
      content?: string;
      media_base64?: string;
      media_mimetype?: string;
      media_filename?: string;
      existing_item_id?: string;
    }[];
    target_type?: string;
    tag_ids?: string[];
    contact_ids?: string[];
  },
): Promise<BroadcastItem> {
  return api<BroadcastItem>(`/api/broadcasts/${id}`, { method: "PUT", body: JSON.stringify(data) });
}

export function scheduleBroadcast(id: string, scheduledAt: string): Promise<BroadcastItem> {
  return api<BroadcastItem>(`/api/broadcasts/${id}/schedule`, {
    method: "POST",
    body: JSON.stringify({ scheduled_at: scheduledAt }),
  });
}

export function unscheduleBroadcast(id: string): Promise<BroadcastItem> {
  return api<BroadcastItem>(`/api/broadcasts/${id}/unschedule`, { method: "POST" });
}

// ── Auto-Reply (Recepção Automática) ───────────────────
export interface AutoReplyConfig {
  id: string;
  instance_name: string;
  active: boolean;
  response_type: "text" | "audio" | "both";
  welcome_message: string | null;
  audio_base64: string | null;
  audio_mimetype: string | null;
  audio_filename: string | null;
  created_at: string;
  updated_at: string;
}

export function listAutoReplyConfigs(): Promise<AutoReplyConfig[]> {
  return api<AutoReplyConfig[]>("/api/auto-reply");
}

export function getAutoReplyConfig(instanceName: string): Promise<AutoReplyConfig> {
  return api<AutoReplyConfig>(`/api/auto-reply/${encodeURIComponent(instanceName)}`);
}

export function upsertAutoReplyConfig(
  instanceName: string,
  data: {
    active: boolean;
    response_type: "text" | "audio" | "both";
    welcome_message?: string | null;
    audio_base64?: string | null;
    audio_mimetype?: string | null;
    audio_filename?: string | null;
  },
): Promise<AutoReplyConfig> {
  return api<AutoReplyConfig>(`/api/auto-reply/${encodeURIComponent(instanceName)}`, {
    method: "PUT",
    body: JSON.stringify(data),
  });
}

// ── Auto-Reply Rules (Keyword matching) ────────────────
export interface AutoReplyRule {
  id: string;
  instance_name: string;
  workspace_id: string;
  keyword: string;
  match_mode: "exact" | "contains" | "starts_with";
  response_type: "text" | "audio" | "both";
  welcome_message: string | null;
  audio_base64: string | null;
  audio_mimetype: string | null;
  audio_filename: string | null;
  active: boolean;
  order: number;
  created_at: string;
  updated_at: string;
}

export function listAutoReplyRules(instanceName: string): Promise<AutoReplyRule[]> {
  return api<AutoReplyRule[]>(`/api/auto-reply/${encodeURIComponent(instanceName)}/rules`);
}

export function createAutoReplyRule(
  instanceName: string,
  data: {
    keyword: string;
    match_mode?: "exact" | "contains" | "starts_with";
    response_type?: "text" | "audio" | "both";
    welcome_message?: string | null;
    audio_base64?: string | null;
    audio_mimetype?: string | null;
    audio_filename?: string | null;
    active?: boolean;
    order?: number;
  },
): Promise<AutoReplyRule> {
  return api<AutoReplyRule>(`/api/auto-reply/${encodeURIComponent(instanceName)}/rules`, {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export function updateAutoReplyRule(
  instanceName: string,
  ruleId: string,
  data: Partial<{
    keyword: string;
    match_mode: "exact" | "contains" | "starts_with";
    response_type: "text" | "audio" | "both";
    welcome_message: string | null;
    audio_base64: string | null;
    audio_mimetype: string | null;
    audio_filename: string | null;
    active: boolean;
    order: number;
  }>,
): Promise<AutoReplyRule> {
  return api<AutoReplyRule>(
    `/api/auto-reply/${encodeURIComponent(instanceName)}/rules/${ruleId}`,
    { method: "PUT", body: JSON.stringify(data) },
  );
}

export function deleteAutoReplyRule(instanceName: string, ruleId: string): Promise<void> {
  return api<void>(
    `/api/auto-reply/${encodeURIComponent(instanceName)}/rules/${ruleId}`,
    { method: "DELETE" },
  );
}

// ── CRM ────────────────────────────────────────────────
export interface CRMLead {
  id: string;
  pipeline_id: string;
  contact_id: string | null;
  name: string;
  phone: string;
  email: string | null;
  value: number;
  company: string | null;
  probability: number;
  tag: string | null;
  assignee: string | null;
  notes: string | null;
  position: number;
  created_at: string;
  updated_at: string;
}

export interface CRMPipeline {
  id: string;
  title: string;
  color: string | null;
  position: number;
  leads: CRMLead[];
  created_at: string;
  updated_at: string;
}

export async function listPipelines(): Promise<CRMPipeline[]> {
  const res = await api<{ pipelines: CRMPipeline[] }>("/api/crm/pipelines");
  return res.pipelines;
}

export function createPipeline(data: { title: string; color?: string }): Promise<CRMPipeline> {
  return api<CRMPipeline>("/api/crm/pipelines", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export function updatePipeline(
  id: string,
  data: { title?: string; color?: string },
): Promise<CRMPipeline> {
  return api<CRMPipeline>(`/api/crm/pipelines/${id}`, {
    method: "PATCH",
    body: JSON.stringify(data),
  });
}

export function deletePipeline(id: string): Promise<void> {
  return api<void>(`/api/crm/pipelines/${id}`, { method: "DELETE" });
}

export function reorderPipelines(
  items: { id: string; position: number }[],
): Promise<{ pipelines: CRMPipeline[] }> {
  return api<{ pipelines: CRMPipeline[] }>("/api/crm/pipelines/reorder", {
    method: "POST",
    body: JSON.stringify({ items }),
  });
}

export function clearPipeline(id: string): Promise<void> {
  return api<void>(`/api/crm/pipelines/${id}/clear`, { method: "POST" });
}

export function createLead(data: {
  pipeline_id: string;
  name: string;
  phone?: string;
  email?: string;
  value?: number;
  company?: string;
  probability?: number;
  tag?: string;
  assignee?: string;
  contact_id?: string;
}): Promise<CRMLead> {
  return api<CRMLead>("/api/crm/leads", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export function updateLead(
  id: string,
  data: Partial<{
    pipeline_id: string;
    name: string;
    phone: string;
    email: string;
    value: number;
    company: string;
    probability: number;
    tag: string;
    assignee: string;
    notes: string;
    position: number;
  }>,
): Promise<CRMLead> {
  return api<CRMLead>(`/api/crm/leads/${id}`, {
    method: "PATCH",
    body: JSON.stringify(data),
  });
}

export function deleteLead(id: string): Promise<void> {
  return api<void>(`/api/crm/leads/${id}`, { method: "DELETE" });
}

export function moveLead(
  id: string,
  data: { pipeline_id: string; position: number },
): Promise<CRMLead> {
  return api<CRMLead>(`/api/crm/leads/${id}/move`, {
    method: "POST",
    body: JSON.stringify(data),
  });
}
