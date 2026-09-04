import { api } from "@/lib/api";
import { rememberUploadBase } from "@/lib/utils";

/**
 * Upload APIs — multipart/form-data.
 * POST upload/image?folder=X  (field: file)
 * POST upload/images?folder=X (field: files)
 * POST upload/video?folder=X  (field: file)
 * DELETE upload/:filename?folder=X
 */

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Json = Record<string, any>;

/**
 * The API returns both `url` (path only) and `absolute_url` (public link).
 * The path is what gets stored — the CDN origin is remembered separately so a
 * domain change doesn't need a data migration.
 */
function pickUrl(data: Json): string {
  const p: Json = data?.payload ?? data?.data ?? data ?? {};
  rememberUploadBase(
    (p.absolute_url ?? p.absoluteUrl ?? p.file?.absolute_url) as string | undefined
  );
  const candidate =
    p.url ??
    p.path ??
    p.file_url ??
    p.fileUrl ??
    p.image_url ??
    p.imageUrl ??
    p.filename ??
    p.location ??
    p.link ??
    p.src ??
    p.file?.url ??
    p.file?.path ??
    p.file?.image_url ??
    p.data?.url ??
    p.data?.path ??
    p.data?.file_url ??
    (Array.isArray(p.files) ? p.files[0]?.url ?? p.files[0]?.path ?? p.files[0]?.file_url : undefined) ??
    (Array.isArray(p) ? p[0]?.url ?? p[0]?.path ?? p[0]?.file_url : undefined) ??
    (typeof (p as unknown) === "string" && (p as unknown as string).startsWith("http") ? (p as unknown as string) : undefined);
  if (!candidate) {
    console.error("[upload] pickUrl: no URL found in response", data);
    throw new Error("Upload succeeded but no file URL in response");
  }
  return candidate as string;
}

async function uploadSingle(
  endpoint: "upload/image" | "upload/video",
  file: File,
  folder: string
): Promise<string> {
  const form = new FormData();
  form.append("file", file);
  const { data } = await api.post(`${endpoint}?folder=${encodeURIComponent(folder)}`, form, {
    headers: { "Content-Type": "multipart/form-data" },
    timeout: 120000,
  });
  return pickUrl(data);
}

export const uploadImage = (file: File, folder = "general") =>
  uploadSingle("upload/image", file, folder);

export const uploadVideo = (file: File, folder = "general") =>
  uploadSingle("upload/video", file, folder);

export async function uploadImages(files: File[], folder = "general"): Promise<string[]> {
  const form = new FormData();
  files.forEach((f) => form.append("files", f));
  const { data } = await api.post(
    `upload/images?folder=${encodeURIComponent(folder)}`,
    form,
    { headers: { "Content-Type": "multipart/form-data" }, timeout: 300000 }
  );
  const p: Json = data?.payload ?? data?.data ?? data ?? {};
  const list = (Array.isArray(p) ? p : p.files ?? p.urls ?? []) as Json[];
  rememberUploadBase(
    (list.find((f) => typeof f !== "string" && f?.absolute_url)?.absolute_url ??
      p.absolute_url) as string | undefined
  );
  return list
    .map((f) => (typeof f === "string" ? f : f?.url ?? f?.path))
    .filter(Boolean) as string[];
}

/** Delete a file by its server path, e.g. /uploads/products/filename.webp */
export async function deleteFile(path: string): Promise<string> {
  const { data } = await api.delete(`upload?path=${encodeURIComponent(path)}`);
  return (data?.message as string) ?? "File deleted.";
}

/**
 * The stored value for a file, ready to hand to `deleteFile`, which accepts
 * either a path or a full CDN URL.
 */
export function imageUrlToPath(url: string): string | null {
  if (!url) return null;
  if (/^https?:\/\//.test(url)) return url;
  return url.startsWith("/") ? url : `/${url}`;
}

/** Multiple videos in one request (field: files). */
export async function uploadVideos(files: File[], folder = "general"): Promise<string[]> {
  const form = new FormData();
  files.forEach((f) => form.append("files", f));
  const { data } = await api.post(
    `upload/videos?folder=${encodeURIComponent(folder)}`,
    form,
    { headers: { "Content-Type": "multipart/form-data" }, timeout: 600000 }
  );
  const p: Json = data?.payload ?? data?.data ?? data ?? {};
  const list = (Array.isArray(p) ? p : p.files ?? p.urls ?? []) as Json[];
  rememberUploadBase(
    (list.find((f) => typeof f !== "string" && f?.absolute_url)?.absolute_url ??
      p.absolute_url) as string | undefined
  );
  return list
    .map((f) => (typeof f === "string" ? f : f?.url ?? f?.path))
    .filter(Boolean) as string[];
}
