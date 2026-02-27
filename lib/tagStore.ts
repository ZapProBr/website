export interface TagItem {
  id: string;
  name: string;
  color: string;
}

export const tagColors = [
  { name: "Vermelho", value: "#ef4444" },
  { name: "Laranja", value: "#f97316" },
  { name: "Amarelo", value: "#eab308" },
  { name: "Verde", value: "#22c55e" },
  { name: "Azul", value: "#3b82f6" },
  { name: "Roxo", value: "#8b5cf6" },
  { name: "Rosa", value: "#ec4899" },
  { name: "Ciano", value: "#06b6d4" },
];

let tagStore: TagItem[] = [];

export const getTagStore = () => tagStore;
export const setTagStore = (tags: TagItem[]) => { tagStore = tags; };

export const getTagColor = (tagName: string): string => {
  const found = tagStore.find((t) => t.name === tagName);
  return found?.color || "#22c55e";
};
