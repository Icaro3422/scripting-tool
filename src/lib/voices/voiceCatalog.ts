/**
 * Catálogo de voces TTS: idioma, región, género.
 * Fuentes: Kokoro-TTS (Hugging Face), Piper (SMSEagle), XTTS/Hugging Face.
 * Ref: https://huggingface.co/spaces/hexgrad/Kokoro-TTS
 * Ref: https://www.smseagle.eu/voice-models/
 */

export type VoiceGender = "female" | "male";
export type VoiceSource = "kokoro" | "piper" | "xtts" | "huggingface";

export interface VoiceEntry {
  id: string;
  name: string;
  languageCode: string;
  languageName: string;
  region: string;
  regionName: string;
  gender: VoiceGender;
  source: VoiceSource;
  /** Modelo o referencia (ej. Kokoro-82M, Piper, XTTS-v2) */
  modelHint?: string;
}

/** Kokoro: American English, British English, Spanish, French, Italian, Brazilian Portuguese, Hindi, Mandarin, Japanese */
const KOKORO_VOICES: VoiceEntry[] = [
  // American English (en-US) - 11F 9M
  { id: "af_heart", name: "Heart", languageCode: "en", languageName: "Inglés", region: "US", regionName: "Estados Unidos", gender: "female", source: "kokoro", modelHint: "Kokoro-82M" },
  { id: "af_alloy", name: "Alloy", languageCode: "en", languageName: "Inglés", region: "US", regionName: "Estados Unidos", gender: "female", source: "kokoro", modelHint: "Kokoro-82M" },
  { id: "af_aoede", name: "Aoede", languageCode: "en", languageName: "Inglés", region: "US", regionName: "Estados Unidos", gender: "female", source: "kokoro", modelHint: "Kokoro-82M" },
  { id: "af_bella", name: "Bella", languageCode: "en", languageName: "Inglés", region: "US", regionName: "Estados Unidos", gender: "female", source: "kokoro", modelHint: "Kokoro-82M" },
  { id: "af_jessica", name: "Jessica", languageCode: "en", languageName: "Inglés", region: "US", regionName: "Estados Unidos", gender: "female", source: "kokoro", modelHint: "Kokoro-82M" },
  { id: "af_kore", name: "Kore", languageCode: "en", languageName: "Inglés", region: "US", regionName: "Estados Unidos", gender: "female", source: "kokoro", modelHint: "Kokoro-82M" },
  { id: "af_nicole", name: "Nicole", languageCode: "en", languageName: "Inglés", region: "US", regionName: "Estados Unidos", gender: "female", source: "kokoro", modelHint: "Kokoro-82M" },
  { id: "af_nova", name: "Nova", languageCode: "en", languageName: "Inglés", region: "US", regionName: "Estados Unidos", gender: "female", source: "kokoro", modelHint: "Kokoro-82M" },
  { id: "af_river", name: "River", languageCode: "en", languageName: "Inglés", region: "US", regionName: "Estados Unidos", gender: "female", source: "kokoro", modelHint: "Kokoro-82M" },
  { id: "af_sarah", name: "Sarah", languageCode: "en", languageName: "Inglés", region: "US", regionName: "Estados Unidos", gender: "female", source: "kokoro", modelHint: "Kokoro-82M" },
  { id: "af_sky", name: "Sky", languageCode: "en", languageName: "Inglés", region: "US", regionName: "Estados Unidos", gender: "female", source: "kokoro", modelHint: "Kokoro-82M" },
  { id: "am_adam", name: "Adam", languageCode: "en", languageName: "Inglés", region: "US", regionName: "Estados Unidos", gender: "male", source: "kokoro", modelHint: "Kokoro-82M" },
  { id: "am_echo", name: "Echo", languageCode: "en", languageName: "Inglés", region: "US", regionName: "Estados Unidos", gender: "male", source: "kokoro", modelHint: "Kokoro-82M" },
  { id: "am_eric", name: "Eric", languageCode: "en", languageName: "Inglés", region: "US", regionName: "Estados Unidos", gender: "male", source: "kokoro", modelHint: "Kokoro-82M" },
  { id: "am_fenrir", name: "Fenrir", languageCode: "en", languageName: "Inglés", region: "US", regionName: "Estados Unidos", gender: "male", source: "kokoro", modelHint: "Kokoro-82M" },
  { id: "am_liam", name: "Liam", languageCode: "en", languageName: "Inglés", region: "US", regionName: "Estados Unidos", gender: "male", source: "kokoro", modelHint: "Kokoro-82M" },
  { id: "am_michael", name: "Michael", languageCode: "en", languageName: "Inglés", region: "US", regionName: "Estados Unidos", gender: "male", source: "kokoro", modelHint: "Kokoro-82M" },
  { id: "am_onyx", name: "Onyx", languageCode: "en", languageName: "Inglés", region: "US", regionName: "Estados Unidos", gender: "male", source: "kokoro", modelHint: "Kokoro-82M" },
  { id: "am_puck", name: "Puck", languageCode: "en", languageName: "Inglés", region: "US", regionName: "Estados Unidos", gender: "male", source: "kokoro", modelHint: "Kokoro-82M" },
  { id: "am_santa", name: "Santa", languageCode: "en", languageName: "Inglés", region: "US", regionName: "Estados Unidos", gender: "male", source: "kokoro", modelHint: "Kokoro-82M" },
  // British English
  { id: "bf_alice", name: "Alice", languageCode: "en", languageName: "Inglés", region: "GB", regionName: "Reino Unido", gender: "female", source: "kokoro", modelHint: "Kokoro-82M" },
  { id: "bf_emma", name: "Emma", languageCode: "en", languageName: "Inglés", region: "GB", regionName: "Reino Unido", gender: "female", source: "kokoro", modelHint: "Kokoro-82M" },
  { id: "bf_isabella", name: "Isabella", languageCode: "en", languageName: "Inglés", region: "GB", regionName: "Reino Unido", gender: "female", source: "kokoro", modelHint: "Kokoro-82M" },
  { id: "bf_lily", name: "Lily", languageCode: "en", languageName: "Inglés", region: "GB", regionName: "Reino Unido", gender: "female", source: "kokoro", modelHint: "Kokoro-82M" },
  { id: "bm_daniel", name: "Daniel", languageCode: "en", languageName: "Inglés", region: "GB", regionName: "Reino Unido", gender: "male", source: "kokoro", modelHint: "Kokoro-82M" },
  { id: "bm_fable", name: "Fable", languageCode: "en", languageName: "Inglés", region: "GB", regionName: "Reino Unido", gender: "male", source: "kokoro", modelHint: "Kokoro-82M" },
  { id: "bm_george", name: "George", languageCode: "en", languageName: "Inglés", region: "GB", regionName: "Reino Unido", gender: "male", source: "kokoro", modelHint: "Kokoro-82M" },
  { id: "bm_lewis", name: "Lewis", languageCode: "en", languageName: "Inglés", region: "GB", regionName: "Reino Unido", gender: "male", source: "kokoro", modelHint: "Kokoro-82M" },
  // Spanish
  { id: "ef_dora", name: "Dora", languageCode: "es", languageName: "Español", region: "ES", regionName: "España", gender: "female", source: "kokoro", modelHint: "Kokoro-82M" },
  { id: "em_alex", name: "Alex", languageCode: "es", languageName: "Español", region: "ES", regionName: "España", gender: "male", source: "kokoro", modelHint: "Kokoro-82M" },
  { id: "em_santa", name: "Santa", languageCode: "es", languageName: "Español", region: "ES", regionName: "España", gender: "male", source: "kokoro", modelHint: "Kokoro-82M" },
  // French
  { id: "ff_siwis", name: "Siwis", languageCode: "fr", languageName: "Francés", region: "FR", regionName: "Francia", gender: "female", source: "kokoro", modelHint: "Kokoro-82M" },
  // Italian
  { id: "if_sara", name: "Sara", languageCode: "it", languageName: "Italiano", region: "IT", regionName: "Italia", gender: "female", source: "kokoro", modelHint: "Kokoro-82M" },
  { id: "im_nicola", name: "Nicola", languageCode: "it", languageName: "Italiano", region: "IT", regionName: "Italia", gender: "male", source: "kokoro", modelHint: "Kokoro-82M" },
  // Brazilian Portuguese
  { id: "pf_dora", name: "Dora", languageCode: "pt", languageName: "Portugués", region: "BR", regionName: "Brasil", gender: "female", source: "kokoro", modelHint: "Kokoro-82M" },
  { id: "pm_alex", name: "Alex", languageCode: "pt", languageName: "Portugués", region: "BR", regionName: "Brasil", gender: "male", source: "kokoro", modelHint: "Kokoro-82M" },
  { id: "pm_santa", name: "Santa", languageCode: "pt", languageName: "Portugués", region: "BR", regionName: "Brasil", gender: "male", source: "kokoro", modelHint: "Kokoro-82M" },
  // Hindi
  { id: "hf_alpha", name: "Alpha", languageCode: "hi", languageName: "Hindi", region: "IN", regionName: "India", gender: "female", source: "kokoro", modelHint: "Kokoro-82M" },
  { id: "hf_beta", name: "Beta", languageCode: "hi", languageName: "Hindi", region: "IN", regionName: "India", gender: "female", source: "kokoro", modelHint: "Kokoro-82M" },
  { id: "hm_omega", name: "Omega", languageCode: "hi", languageName: "Hindi", region: "IN", regionName: "India", gender: "male", source: "kokoro", modelHint: "Kokoro-82M" },
  { id: "hm_psi", name: "Psi", languageCode: "hi", languageName: "Hindi", region: "IN", regionName: "India", gender: "male", source: "kokoro", modelHint: "Kokoro-82M" },
  // Mandarin Chinese
  { id: "zf_xiaobei", name: "Xiaobei", languageCode: "zh", languageName: "Chino mandarín", region: "CN", regionName: "China", gender: "female", source: "kokoro", modelHint: "Kokoro-82M" },
  { id: "zf_xiaoni", name: "Xiaoni", languageCode: "zh", languageName: "Chino mandarín", region: "CN", regionName: "China", gender: "female", source: "kokoro", modelHint: "Kokoro-82M" },
  { id: "zf_xiaoxiao", name: "Xiaoxiao", languageCode: "zh", languageName: "Chino mandarín", region: "CN", regionName: "China", gender: "female", source: "kokoro", modelHint: "Kokoro-82M" },
  { id: "zf_xiaoyi", name: "Xiaoyi", languageCode: "zh", languageName: "Chino mandarín", region: "CN", regionName: "China", gender: "female", source: "kokoro", modelHint: "Kokoro-82M" },
  { id: "zm_yunjian", name: "Yunjian", languageCode: "zh", languageName: "Chino mandarín", region: "CN", regionName: "China", gender: "male", source: "kokoro", modelHint: "Kokoro-82M" },
  { id: "zm_yunxi", name: "Yunxi", languageCode: "zh", languageName: "Chino mandarín", region: "CN", regionName: "China", gender: "male", source: "kokoro", modelHint: "Kokoro-82M" },
  { id: "zm_yunxia", name: "Yunxia", languageCode: "zh", languageName: "Chino mandarín", region: "CN", regionName: "China", gender: "male", source: "kokoro", modelHint: "Kokoro-82M" },
  { id: "zm_yunyang", name: "Yunyang", languageCode: "zh", languageName: "Chino mandarín", region: "CN", regionName: "China", gender: "male", source: "kokoro", modelHint: "Kokoro-82M" },
  // Japanese
  { id: "jf_alpha", name: "Alpha", languageCode: "ja", languageName: "Japonés", region: "JP", regionName: "Japón", gender: "female", source: "kokoro", modelHint: "Kokoro-82M" },
  { id: "jf_gongitsune", name: "Gongitsune", languageCode: "ja", languageName: "Japonés", region: "JP", regionName: "Japón", gender: "female", source: "kokoro", modelHint: "Kokoro-82M" },
  { id: "jf_nezumi", name: "Nezumi", languageCode: "ja", languageName: "Japonés", region: "JP", regionName: "Japón", gender: "female", source: "kokoro", modelHint: "Kokoro-82M" },
  { id: "jf_tebukuro", name: "Tebukuro", languageCode: "ja", languageName: "Japonés", region: "JP", regionName: "Japón", gender: "female", source: "kokoro", modelHint: "Kokoro-82M" },
  { id: "jm_kumo", name: "Kumo", languageCode: "ja", languageName: "Japonés", region: "JP", regionName: "Japón", gender: "male", source: "kokoro", modelHint: "Kokoro-82M" },
];

/** Piper (SMSEagle): voces por idioma/genéro - ejemplos representativos */
const PIPER_VOICES: VoiceEntry[] = [
  { id: "piper_es_es_female", name: "Español (España) F", languageCode: "es", languageName: "Español", region: "ES", regionName: "España", gender: "female", source: "piper", modelHint: "Piper" },
  { id: "piper_es_es_male", name: "Español (España) M", languageCode: "es", languageName: "Español", region: "ES", regionName: "España", gender: "male", source: "piper", modelHint: "Piper" },
  { id: "piper_en_us_female", name: "English (US) F", languageCode: "en", languageName: "Inglés", region: "US", regionName: "Estados Unidos", gender: "female", source: "piper", modelHint: "Piper" },
  { id: "piper_en_us_male", name: "English (US) M", languageCode: "en", languageName: "Inglés", region: "US", regionName: "Estados Unidos", gender: "male", source: "piper", modelHint: "Piper" },
  { id: "piper_en_gb_female", name: "English (UK) F", languageCode: "en", languageName: "Inglés", region: "GB", regionName: "Reino Unido", gender: "female", source: "piper", modelHint: "Piper" },
  { id: "piper_en_gb_male", name: "English (UK) M", languageCode: "en", languageName: "Inglés", region: "GB", regionName: "Reino Unido", gender: "male", source: "piper", modelHint: "Piper" },
  { id: "piper_fr_fr_female", name: "Français F", languageCode: "fr", languageName: "Francés", region: "FR", regionName: "Francia", gender: "female", source: "piper", modelHint: "Piper" },
  { id: "piper_de_de_female", name: "Deutsch F", languageCode: "de", languageName: "Alemán", region: "DE", regionName: "Alemania", gender: "female", source: "piper", modelHint: "Piper" },
  { id: "piper_it_it_female", name: "Italiano F", languageCode: "it", languageName: "Italiano", region: "IT", regionName: "Italia", gender: "female", source: "piper", modelHint: "Piper" },
  { id: "piper_pt_br_female", name: "Português (BR) F", languageCode: "pt", languageName: "Portugués", region: "BR", regionName: "Brasil", gender: "female", source: "piper", modelHint: "Piper" },
];

export const VOICE_CATALOG: VoiceEntry[] = [...KOKORO_VOICES, ...PIPER_VOICES];

const LANGUAGE_OPTIONS = Array.from(
  new Map(VOICE_CATALOG.map((v) => [v.languageCode, { code: v.languageCode, name: v.languageName }])).entries()
)
  .map(([, v]) => v)
  .sort((a, b) => a.name.localeCompare(b.name));

const REGION_OPTIONS = Array.from(
  new Map(VOICE_CATALOG.map((v) => [v.region, { code: v.region, name: v.regionName }])).entries()
)
  .map(([, v]) => v)
  .sort((a, b) => a.name.localeCompare(b.name));

export interface VoiceFilters {
  languageCode?: string;
  region?: string;
  gender?: VoiceGender;
}

export function getVoiceFilters() {
  return {
    languages: LANGUAGE_OPTIONS,
    regions: REGION_OPTIONS,
    genders: [
      { value: "female" as const, label: "Femenino" },
      { value: "male" as const, label: "Masculino" },
    ],
  };
}

export function filterVoices(filters: VoiceFilters): VoiceEntry[] {
  let list = VOICE_CATALOG;
  if (filters.languageCode) {
    list = list.filter((v) => v.languageCode === filters.languageCode || v.languageCode.startsWith(filters.languageCode!));
  }
  if (filters.region) {
    list = list.filter((v) => v.region === filters.region);
  }
  if (filters.gender) {
    list = list.filter((v) => v.gender === filters.gender);
  }
  return list;
}

export function getVoiceById(voiceId: string): VoiceEntry | undefined {
  return VOICE_CATALOG.find((v) => v.id === voiceId);
}
