export type AIProviderId = "openai" | "anthropic" | "deepseek" | "google" | "openrouter";

export interface AIModelOption {
  id: string;
  name: string;
  provider: AIProviderId;
  costTier?: "low" | "medium" | "high" | "free";
  /** Solo para OpenRouter: id completo (ej. deepseek/deepseek-chat) */
  openRouterId?: string;
}

export const AI_MODELS: AIModelOption[] = [
  { id: "deepseek-chat", name: "DeepSeek Chat", provider: "deepseek", costTier: "low" },
  { id: "gpt-4o-mini", name: "GPT-4o Mini", provider: "openai", costTier: "low" },
  { id: "gpt-4o", name: "GPT-4o", provider: "openai", costTier: "medium" },
  { id: "claude-3-5-haiku", name: "Claude 3.5 Haiku", provider: "anthropic", costTier: "low" },
  { id: "claude-3-5-sonnet", name: "Claude 3.5 Sonnet", provider: "anthropic", costTier: "medium" },
  { id: "gemini-1.5-flash", name: "Gemini 1.5 Flash", provider: "google", costTier: "low" },
  { id: "gemini-1.5-pro", name: "Gemini 1.5 Pro", provider: "google", costTier: "medium" },
];

/** Modelos de imagen recomendados para miniaturas de YouTube (OpenRouter). Nano Banana y Grok son óptimos para imágenes estáticas. */
export const THUMBNAIL_IMAGE_MODELS: { id: string; name: string; note?: string }[] = [
  { id: "google/gemini-2.5-flash-image", name: "Nano Banana (Gemini 2.5 Flash Image)", note: "Recomendado" },
  { id: "google/gemini-2.5-flash-image-preview:free", name: "Nano Banana (gratis)", note: "Preview free" },
  { id: "x-ai/grok-2-vision-1212", name: "Grok 2 Vision", note: "xAI" },
  { id: "black-forest-labs/flux.2-pro", name: "FLUX 2 Pro", note: "Alternativa" },
];

/** IDs recomendados para generación de guiones. Incluye modelos de calidad y muchos gratuitos (OpenRouter :free) para tener alternativas. */
export const SCRIPT_RECOMMENDED_IDS = new Set([
  // Calidad (económico o de pago)
  "claude-3-5-sonnet",
  "claude-3-5-haiku",
  "anthropic/claude-3.5-sonnet",
  "anthropic/claude-3.5-haiku",
  "anthropic/claude-3-opus",
  "gpt-4o",
  "openai/gpt-4o",
  "openai/gpt-4o-mini",
  "gpt-4o-mini",
  "deepseek-chat",
  "deepseek/deepseek-chat",
  "deepseek/deepseek-r1",
  "google/gemini-2.0-flash-001",
  "gemini-1.5-pro",
  "google/gemini-1.5-pro",
  "gemini-1.5-flash",
  "google/gemini-1.5-flash",
  // Modelos gratuitos (OpenRouter) — más opciones para cuando uno falle o tenga límites
  "google/gemini-2.0-flash-exp:free",
  "google/gemini-flash-1.5:free",
  "google/gemini-2.0-flash-001:free",
  "meta-llama/llama-3.3-70b-instruct:free",
  "meta-llama/llama-3.2-3b-instruct:free",
  "meta-llama/llama-3.1-8b-instruct:free",
  "meta-llama/llama-3.1-70b-instruct:free",
  "qwen/qwen-2.5-7b-instruct:free",
  "qwen/qwen-2.5-14b-instruct:free",
  "qwen/qwen-2.5-32b-instruct:free",
  "qwen/qwen-2-7b-instruct:free",
  "mistralai/mistral-7b-instruct:free",
  "mistralai/mistral-small-24b-instruct:free",
  "microsoft/phi-3-mini-128k-instruct:free",
  "microsoft/phi-3-medium-128k-instruct:free",
  "nousresearch/hermes-3-llama-3.1-8b:free",
  "nousresearch/hermes-3-llama-3.1-405b:free",
  "huggingfaceh4/zephyr-7b-beta:free",
  "nvidia/nemotron-3-nano-30b-a3b:free",
  "nvidia/nemotron-3-mini-12b-instruct:free",
  "deepseek/deepseek-r1:free",
  "deepseek/deepseek-chat:free",
  "google/gemma-2-9b-it:free",
  "google/gemma-2-27b-it:free",
  "anthropic/claude-3-haiku:free",
  "openai/gpt-3.5-turbo:free",
]);
