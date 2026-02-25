export interface AudioItem {
  id: string;
  title: string;
  fileName: string;
  duration: string;
  createdAt: string;
}

// Shared store so Conversas can access the same list
let audioStore: AudioItem[] = [
  { id: "1", title: "Boas-vindas", fileName: "boas-vindas.mp3", duration: "0:15", createdAt: "22/02/2026" },
  { id: "2", title: "Promoção do mês", fileName: "promo-mes.mp3", duration: "0:32", createdAt: "21/02/2026" },
  { id: "3", title: "Confirmação de pedido", fileName: "confirmacao.mp3", duration: "0:20", createdAt: "20/02/2026" },
];

export const getAudioStore = () => audioStore;
export const setAudioStore = (audios: AudioItem[]) => { audioStore = audios; };
