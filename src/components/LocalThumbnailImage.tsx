"use client";

import { useEffect, useState } from "react";
import { getLocalThumbData, LOCAL_URL_PREFIX } from "@/lib/client-storage";

export function LocalThumbnailImage({ thumbId, blobUrl, alt, className }: { thumbId: string; blobUrl: string; alt: string; className?: string }) {
  const [src, setSrc] = useState<string | null>(blobUrl.startsWith(LOCAL_URL_PREFIX) ? null : blobUrl);

  useEffect(() => {
    if (!blobUrl.startsWith(LOCAL_URL_PREFIX)) {
      setSrc(blobUrl);
      return;
    }
    getLocalThumbData(thumbId).then(setSrc);
  }, [thumbId, blobUrl]);

  if (src) return <img src={src} alt={alt} className={className} />;
  return (
    <div className={className} style={{ minHeight: 128, background: "var(--bg-muted)", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--text-muted)", fontSize: "0.75rem" }}>
      Miniatura local
    </div>
  );
}
