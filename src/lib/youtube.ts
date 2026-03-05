import { google } from "googleapis";

export interface ChannelAnalysis {
  channelId: string;
  title: string | null;
  description: string | null;
  customUrl: string | null;
  thumbnailUrl: string | null;
  bannerUrl: string | null;
  subscriberCount: number;
  videoCount: number;
  viewCount: string;
  country: string | null;
  publishedAt: string | null;
  // Extraídos para presets
  thumbnailsSample: string[];
  dominantColors?: string[];
  suggestedTone?: string;
  suggestedFormat?: string;
  viralSummary?: string;
  brandHints?: string;
  /** Estilo de miniatura de la competencia: "few" = pocas palabras, "many" = muchas palabras */
  thumbnailWordStyle?: "few" | "many";
}

function getYoutubeClient() {
  const key = process.env.YOUTUBE_API_KEY;
  if (!key) throw new Error("YOUTUBE_API_KEY no configurada");
  return google.youtube({ version: "v3", auth: key });
}

/** Resuelve @handle o URL a channel ID */
export async function resolveChannelId(input: string): Promise<string | null> {
  const trimmed = input.trim();
  if (/^UC[\w-]{21}$/.test(trimmed)) return trimmed;
  const channelMatch = trimmed.match(/youtube\.com\/channel\/(UC[\w-]{21})/);
  if (channelMatch) return channelMatch[1];

  const yt = getYoutubeClient();
  const handleMatch = trimmed.match(/youtube\.com\/@([\w.-]+)/) ?? trimmed.match(/^@?([\w.-]+)$/);
  if (handleMatch) {
    const res = await yt.search.list({
      part: ["snippet"],
      type: ["channel"],
      q: handleMatch[1].startsWith("@") ? handleMatch[1].slice(1) : handleMatch[1],
      maxResults: 1,
    });
    const id = res.data.items?.[0]?.snippet?.channelId;
    return id ?? null;
  }
  return null;
}

export async function analyzeChannel(channelIdOrUrl: string): Promise<ChannelAnalysis | null> {
  const channelId = await resolveChannelId(channelIdOrUrl);
  if (!channelId) return null;

  const yt = getYoutubeClient();

  const [channelRes, searchRes] = await Promise.all([
    yt.channels.list({
      part: ["snippet", "statistics", "brandingSettings"],
      id: [channelId],
    }),
    yt.search.list({
      part: ["snippet"],
      channelId,
      type: ["video"],
      order: "viewCount",
      maxResults: 10,
    }),
  ]);

  const ch = channelRes.data.items?.[0];
  if (!ch) return null;

  const snippet = ch.snippet ?? {};
  const stats = ch.statistics ?? {};
  const branding = ch.brandingSettings?.image ?? {};

  const thumbnailsSample: string[] = [];
  (searchRes.data.items ?? []).forEach((item) => {
    const thumb = item.snippet?.thumbnails?.high?.url ?? item.snippet?.thumbnails?.default?.url;
    if (thumb) thumbnailsSample.push(thumb);
  });

  return {
    channelId,
    title: snippet.title ?? null,
    description: snippet.description ?? null,
    customUrl: snippet.customUrl ?? null,
    thumbnailUrl: snippet.thumbnails?.high?.url ?? snippet.thumbnails?.default?.url ?? null,
    bannerUrl:
    (branding as Record<string, string | undefined>).bannerExternalUrl ??
    (branding as Record<string, string | undefined>).bannerImageUrl ??
    (branding as Record<string, string | undefined>).bannerTabletHdImageUrl ??
    (branding as Record<string, string | undefined>).bannerMobileHdImageUrl ??
    null,
    subscriberCount: parseInt(String(stats.subscriberCount ?? 0), 10),
    videoCount: parseInt(String(stats.videoCount ?? 0), 10),
    viewCount: String(stats.viewCount ?? "0"),
    country: snippet.country ?? null,
    publishedAt: snippet.publishedAt ?? null,
    thumbnailsSample,
    suggestedTone: undefined,
    suggestedFormat: undefined,
  };
}
