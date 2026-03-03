import { put, del, list } from "@vercel/blob";

const TOKEN = process.env.BLOB_READ_WRITE_TOKEN;

export async function uploadBlob(
  pathname: string,
  body: string | Buffer,
  options?: { contentType?: string }
): Promise<{ url: string }> {
  if (!TOKEN) throw new Error("BLOB_READ_WRITE_TOKEN no configurada");
  const blob = await put(pathname, body, {
    access: "public",
    ...options,
  });
  return { url: blob.url };
}

export async function deleteBlob(url: string): Promise<void> {
  if (!TOKEN) return;
  await del(url);
}

export async function listBlobs(prefix: string): Promise<{ blobs: { url: string }[] }> {
  if (!TOKEN) return { blobs: [] };
  const result = await list({ prefix });
  return { blobs: result.blobs.map((b) => ({ url: b.url })) };
}
