/**
 * Librería de voces para TTS (Hugging Face).
 * Idiomas soportados por XTTS-v2 (17), SpeechT5 y MMS-TTS.
 * La herramienta está en español pero el contenido puede generarse en cualquier idioma listado.
 */

export interface Voice {
  id: string;
  name: string;
  languageCode: string;
  languageName: string;
  /** Modelo sugerido en Hugging Face (XTTS-v2, MMS, SpeechT5) */
  modelHint?: string;
  provider: "huggingface";
}

/** Lista de voces por idioma. languageCode sigue ISO 639-1/639-3 según el modelo. */
export const VOICES: Voice[] = [
  // XTTS-v2: 17 idiomas principales
  { id: "en", name: "English", languageCode: "en", languageName: "Inglés", modelHint: "tts-hub/XTTS-v2", provider: "huggingface" },
  { id: "es", name: "Español", languageCode: "es", languageName: "Español", modelHint: "tts-hub/XTTS-v2", provider: "huggingface" },
  { id: "fr", name: "Français", languageCode: "fr", languageName: "Francés", modelHint: "tts-hub/XTTS-v2", provider: "huggingface" },
  { id: "de", name: "Deutsch", languageCode: "de", languageName: "Alemán", modelHint: "tts-hub/XTTS-v2", provider: "huggingface" },
  { id: "it", name: "Italiano", languageCode: "it", languageName: "Italiano", modelHint: "tts-hub/XTTS-v2", provider: "huggingface" },
  { id: "pt", name: "Português", languageCode: "pt", languageName: "Portugués", modelHint: "tts-hub/XTTS-v2", provider: "huggingface" },
  { id: "pl", name: "Polski", languageCode: "pl", languageName: "Polaco", modelHint: "tts-hub/XTTS-v2", provider: "huggingface" },
  { id: "tr", name: "Türkçe", languageCode: "tr", languageName: "Turco", modelHint: "tts-hub/XTTS-v2", provider: "huggingface" },
  { id: "ru", name: "Русский", languageCode: "ru", languageName: "Ruso", modelHint: "tts-hub/XTTS-v2", provider: "huggingface" },
  { id: "nl", name: "Nederlands", languageCode: "nl", languageName: "Neerlandés", modelHint: "tts-hub/XTTS-v2", provider: "huggingface" },
  { id: "cs", name: "Čeština", languageCode: "cs", languageName: "Checo", modelHint: "tts-hub/XTTS-v2", provider: "huggingface" },
  { id: "ar", name: "العربية", languageCode: "ar", languageName: "Árabe", modelHint: "tts-hub/XTTS-v2", provider: "huggingface" },
  { id: "zh-cn", name: "中文 (简体)", languageCode: "zh-cn", languageName: "Chino simplificado", modelHint: "tts-hub/XTTS-v2", provider: "huggingface" },
  { id: "ja", name: "日本語", languageCode: "ja", languageName: "Japonés", modelHint: "tts-hub/XTTS-v2", provider: "huggingface" },
  { id: "hu", name: "Magyar", languageCode: "hu", languageName: "Húngaro", modelHint: "tts-hub/XTTS-v2", provider: "huggingface" },
  { id: "ko", name: "한국어", languageCode: "ko", languageName: "Coreano", modelHint: "tts-hub/XTTS-v2", provider: "huggingface" },
  { id: "hi", name: "हिन्दी", languageCode: "hi", languageName: "Hindi", modelHint: "tts-hub/XTTS-v2", provider: "huggingface" },
  // Idiomas adicionales (MMS-TTS / SpeechT5)
  { id: "zh-tw", name: "中文 (繁體)", languageCode: "zh-tw", languageName: "Chino tradicional", modelHint: "facebook/mms-tts", provider: "huggingface" },
  { id: "th", name: "ไทย", languageCode: "th", languageName: "Tailandés", modelHint: "facebook/mms-tts", provider: "huggingface" },
  { id: "vi", name: "Tiếng Việt", languageCode: "vi", languageName: "Vietnamita", modelHint: "facebook/mms-tts", provider: "huggingface" },
  { id: "id", name: "Bahasa Indonesia", languageCode: "id", languageName: "Indonesio", modelHint: "facebook/mms-tts", provider: "huggingface" },
  { id: "ms", name: "Bahasa Melayu", languageCode: "ms", languageName: "Malayo", modelHint: "facebook/mms-tts", provider: "huggingface" },
  { id: "uk", name: "Українська", languageCode: "uk", languageName: "Ucraniano", modelHint: "facebook/mms-tts", provider: "huggingface" },
  { id: "el", name: "Ελληνικά", languageCode: "el", languageName: "Griego", modelHint: "facebook/mms-tts", provider: "huggingface" },
  { id: "ro", name: "Română", languageCode: "ro", languageName: "Rumano", modelHint: "facebook/mms-tts", provider: "huggingface" },
  { id: "sv", name: "Svenska", languageCode: "sv", languageName: "Sueco", modelHint: "facebook/mms-tts", provider: "huggingface" },
  { id: "da", name: "Dansk", languageCode: "da", languageName: "Danés", modelHint: "facebook/mms-tts", provider: "huggingface" },
  { id: "no", name: "Norsk", languageCode: "no", languageName: "Noruego", modelHint: "facebook/mms-tts", provider: "huggingface" },
  { id: "fi", name: "Suomi", languageCode: "fi", languageName: "Finlandés", modelHint: "facebook/mms-tts", provider: "huggingface" },
  { id: "he", name: "עברית", languageCode: "he", languageName: "Hebreo", modelHint: "facebook/mms-tts", provider: "huggingface" },
  { id: "bn", name: "বাংলা", languageCode: "bn", languageName: "Bengalí", modelHint: "facebook/mms-tts", provider: "huggingface" },
  { id: "ta", name: "தமிழ்", languageCode: "ta", languageName: "Tamil", modelHint: "facebook/mms-tts", provider: "huggingface" },
  { id: "te", name: "తెలుగు", languageCode: "te", languageName: "Telugu", modelHint: "facebook/mms-tts", provider: "huggingface" },
  { id: "mr", name: "मराठी", languageCode: "mr", languageName: "Marathi", modelHint: "facebook/mms-tts", provider: "huggingface" },
  { id: "fa", name: "فارسی", languageCode: "fa", languageName: "Persa", modelHint: "facebook/mms-tts", provider: "huggingface" },
  { id: "ur", name: "اردو", languageCode: "ur", languageName: "Urdu", modelHint: "facebook/mms-tts", provider: "huggingface" },
  { id: "sw", name: "Kiswahili", languageCode: "sw", languageName: "Suajili", modelHint: "facebook/mms-tts", provider: "huggingface" },
  { id: "ca", name: "Català", languageCode: "ca", languageName: "Catalán", modelHint: "facebook/mms-tts", provider: "huggingface" },
  { id: "sk", name: "Slovenčina", languageCode: "sk", languageName: "Eslovaco", modelHint: "facebook/mms-tts", provider: "huggingface" },
  { id: "hr", name: "Hrvatski", languageCode: "hr", languageName: "Croata", modelHint: "facebook/mms-tts", provider: "huggingface" },
  { id: "bg", name: "Български", languageCode: "bg", languageName: "Búlgaro", modelHint: "facebook/mms-tts", provider: "huggingface" },
];

/** Agrupa voces por languageName para la UI. */
export function getVoicesByLanguage(): Map<string, Voice[]> {
  const map = new Map<string, Voice[]>();
  for (const v of VOICES) {
    const list = map.get(v.languageName) ?? [];
    list.push(v);
    map.set(v.languageName, list);
  }
  return map;
}

/** Devuelve todas las voces, opcionalmente filtradas por código de idioma. */
export function getVoices(lang?: string): Voice[] {
  if (!lang) return VOICES;
  return VOICES.filter((v) => v.languageCode === lang || v.languageCode.startsWith(lang));
}
