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
    const res = await fetch(`${BASE}/auth/refresh`, {
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
  const res = await fetch(`${BASE}/auth/login`, {
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
}

export function getMe(): Promise<UserMe> {
  return api<UserMe>("/auth/me");
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
}

export async function listUsers(): Promise<User[]> {
  const res = await api<{ users: User[]; total: number }>("/users");
  return res.users;
}

export function createUser(data: { email: string; name: string; password: string; role?: string; plan?: string }): Promise<User> {
  return api<User>("/users", { method: "POST", body: JSON.stringify(data) });
}

export function updateUser(id: string, data: Partial<{ name: string; email: string; password: string; role: string; plan: string; is_active: boolean }>): Promise<User> {
  return api<User>(`/users/${id}`, { method: "PUT", body: JSON.stringify(data) });
}

export function deleteUser(id: string): Promise<void> {
  return api<void>(`/users/${id}`, { method: "DELETE" });
}

// ── Tags ───────────────────────────────────────────────
export interface Tag {
  id: string;
  name: string;
  color: string;
}

export function listTags(): Promise<Tag[]> {
  return api<Tag[]>("/tags");
}

export function createTag(data: { name: string; color: string }): Promise<Tag> {
  return api<Tag>("/tags", { method: "POST", body: JSON.stringify(data) });
}

export function updateTag(id: string, data: Partial<{ name: string; color: string }>): Promise<Tag> {
  return api<Tag>(`/tags/${id}`, { method: "PUT", body: JSON.stringify(data) });
}

export function deleteTag(id: string): Promise<void> {
  return api<void>(`/tags/${id}`, { method: "DELETE" });
}

// ── Contacts ───────────────────────────────────────────
export interface Contact {
  id: string;
  name: string;
  phone: string;
  email: string | null;
  notes: string | null;
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
  const res = await api<{ contacts: Contact[]; total: number }>(`/contacts${q ? `?${q}` : ""}`);
  return res.contacts;
}

export function createContact(data: { name: string; phone: string; email?: string; notes?: string; tag_ids?: string[] }): Promise<Contact> {
  return api<Contact>("/contacts", { method: "POST", body: JSON.stringify(data) });
}

export function updateContact(id: string, data: Partial<{ name: string; phone: string; email: string; notes: string; tag_ids: string[] }>): Promise<Contact> {
  return api<Contact>(`/contacts/${id}`, { method: "PUT", body: JSON.stringify(data) });
}

export function deleteContact(id: string): Promise<void> {
  return api<void>(`/contacts/${id}`, { method: "DELETE" });
}

export function bulkDeleteContacts(ids: string[]): Promise<{ deleted: number }> {
  return api<{ deleted: number }>("/contacts/bulk-delete", { method: "POST", body: JSON.stringify({ ids }) });
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
  last_message: string | null;
  unread_count: number;
  created_at: string;
  updated_at: string;
}

export async function listConversations(params?: { status?: string; skip?: number; limit?: number }): Promise<ConversationItem[]> {
  const qs = new URLSearchParams();
  if (params?.status) qs.set("status", params.status);
  if (params?.skip) qs.set("skip", String(params.skip));
  if (params?.limit) qs.set("limit", String(params.limit));
  const q = qs.toString();
  const res = await api<{ conversations: ConversationItem[]; total: number }>(`/conversations${q ? `?${q}` : ""}`);
  return res.conversations;
}

export function createConversation(data: { contact_id: string; status?: string }): Promise<ConversationItem> {
  return api<ConversationItem>("/conversations", { method: "POST", body: JSON.stringify(data) });
}

export function updateConversation(id: string, data: Partial<{ status: string; attendant_id: string }>): Promise<ConversationItem> {
  return api<ConversationItem>(`/conversations/${id}`, { method: "PUT", body: JSON.stringify(data) });
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
  created_at: string;
}

export async function listMessages(conversationId: string, params?: { skip?: number; limit?: number }): Promise<MessageItem[]> {
  const qs = new URLSearchParams();
  if (params?.skip) qs.set("skip", String(params.skip));
  if (params?.limit) qs.set("limit", String(params.limit));
  const q = qs.toString();
  const res = await api<{ messages: MessageItem[]; total: number }>(`/conversations/${conversationId}/messages${q ? `?${q}` : ""}`);
  return res.messages;
}

export function sendMessage(conversationId: string, data: { text: string; message_type?: string }): Promise<MessageItem> {
  return api<MessageItem>(`/conversations/${conversationId}/messages`, { method: "POST", body: JSON.stringify(data) });
}

export function markMessagesRead(conversationId: string): Promise<{ updated: number }> {
  return api<{ updated: number }>(`/conversations/${conversationId}/messages/read`, { method: "PUT" });
}

export function sendTyping(conversationId: string): Promise<{ ok: boolean }> {
  return api<{ ok: boolean }>(`/conversations/${conversationId}/messages/typing`, { method: "POST" });
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
  return api<EvolutionInstance[]>("/evolution/instances");
}

export function createInstance(data: { instanceName: string; number?: string }): Promise<EvolutionInstance> {
  return api<EvolutionInstance>("/evolution/instances", { method: "POST", body: JSON.stringify(data) });
}

export function getQrCode(name: string): Promise<{ base64: string | null; pairingCode: string | null; count: number | null }> {
  return api<{ base64: string | null; pairingCode: string | null; count: number | null }>(`/evolution/instances/${encodeURIComponent(name)}/qrcode`);
}

export function getInstanceStatus(name: string): Promise<{ instanceName: string; status: string }> {
  return api<{ instanceName: string; status: string }>(`/evolution/instances/${encodeURIComponent(name)}/status`);
}

export function restartInstance(name: string): Promise<unknown> {
  return api<unknown>(`/evolution/instances/${encodeURIComponent(name)}/restart`, { method: "PUT" });
}

export function logoutInstance(name: string): Promise<{ ok: boolean }> {
  return api<{ ok: boolean }>(`/evolution/instances/${encodeURIComponent(name)}/logout`, { method: "DELETE" });
}

export function deleteInstance(name: string): Promise<{ ok: boolean }> {
  return api<{ ok: boolean }>(`/evolution/instances/${encodeURIComponent(name)}`, { method: "DELETE" });
}
