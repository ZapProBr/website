export interface AudioItem {
  id: string;
  title: string;
  fileName: string;
  duration: string;
  createdAt: string;
  /** base64-encoded audio data for sending via API */
  base64?: string;
  /** MIME type of the audio (e.g. "audio/webm;codecs=opus") */
  mimetype?: string;
}

// Shared store so Conversas can access the same list
let audioStore: AudioItem[] = [];

export const getAudioStore = () => audioStore;
export const setAudioStore = (audios: AudioItem[]) => { audioStore = audios; };
