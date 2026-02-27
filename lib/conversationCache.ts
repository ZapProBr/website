/**
 * Module-level cache for Conversas page data.
 * Survives Next.js client-side navigations (component unmount/remount)
 * so the page renders instantly with stale data while refreshing in background.
 */

import type { ConversationItem, MessageItem, User as ApiUser, Tag as ApiTag, SavedAudio } from "@/lib/api";

interface ConversationCache {
  conversations: ConversationItem[];
  /** Messages keyed by conversation id */
  messages: Record<string, MessageItem[]>;
  users: ApiUser[];
  tags: ApiTag[];
  savedAudios: SavedAudio[];
  /** Last selected conversation id */
  selectedId: string;
  /** Last status filter */
  statusFilter: string;
}

const cache: ConversationCache = {
  conversations: [],
  messages: {},
  users: [],
  tags: [],
  savedAudios: [],
  selectedId: "",
  statusFilter: "atendendo",
};

// ── Conversations ──────────────────────────────────────
export const getCachedConversations = () => cache.conversations;
export const setCachedConversations = (data: ConversationItem[]) => {
  cache.conversations = data;
};

// ── Messages ───────────────────────────────────────────
export const getCachedMessages = (convId: string) => cache.messages[convId] ?? [];
export const setCachedMessages = (convId: string, msgs: MessageItem[]) => {
  cache.messages[convId] = msgs;
};

// ── Users ──────────────────────────────────────────────
export const getCachedUsers = () => cache.users;
export const setCachedUsers = (data: ApiUser[]) => {
  cache.users = data;
};

// ── Tags ───────────────────────────────────────────────
export const getCachedTags = () => cache.tags;
export const setCachedTags = (data: ApiTag[]) => {
  cache.tags = data;
};

// ── Saved Audios ───────────────────────────────────────
export const getCachedSavedAudios = () => cache.savedAudios;
export const setCachedSavedAudios = (data: SavedAudio[]) => {
  cache.savedAudios = data;
};

// ── Selection / filter state ───────────────────────────
export const getCachedSelectedId = () => cache.selectedId;
export const setCachedSelectedId = (id: string) => {
  cache.selectedId = id;
};

export const getCachedStatusFilter = () => cache.statusFilter;
export const setCachedStatusFilter = (f: string) => {
  cache.statusFilter = f;
};
