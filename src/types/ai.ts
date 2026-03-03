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
