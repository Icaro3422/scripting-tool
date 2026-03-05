"use client";

import { useEffect, useState } from "react";
import { getLocalThumbPath, getLocalFolderName, LOCAL_URL_PREFIX } from "@/lib/client-storage";
import { LocalThumbnailImage } from "@/components/LocalThumbnailImage";

const SUBFOLDER = "scripting-tool";

/** Muestra la miniatura local y la ruta donde se guardó (carpeta base → scripting-tool → proyecto → archivo). */
export function LocalThumbnailWithPath({
  thumbId,
  blobUrl,
  projectId,
  alt,
  className,
}: {
  thumbId: string;
  blobUrl: string;
  projectId: string;
  alt: string;
  className?: string;
}) {
  const [displayPath, setDisplayPath] = useState<string | null>(null);

  useEffect(() => {
    if (!blobUrl.startsWith(LOCAL_URL_PREFIX)) {
      setDisplayPath(null);
      return;
    }
    const folderName = getLocalFolderName();
    getLocalThumbPath(thumbId).then((pathInfo) => {
      if (!pathInfo) {
        setDisplayPath(null);
        return;
      }
      const base = folderName || "Carpeta seleccionada";
      const fullPath = `${base} / ${SUBFOLDER} / ${pathInfo.relativePath}`;
      setDisplayPath(fullPath);
    });
  }, [thumbId, blobUrl, projectId]);

  return (
    <div className="flex flex-col gap-1">
      <LocalThumbnailImage thumbId={thumbId} blobUrl={blobUrl} alt={alt} className={className} />
      {displayPath && (
        <p className="text-xs text-[rgb(var(--text-muted))] truncate max-w-full" title={displayPath}>
          Guardado en: {displayPath}
        </p>
      )}
    </div>
  );
}
