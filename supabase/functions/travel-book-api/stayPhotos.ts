export const MAX_STAY_PHOTO_BYTES = 2 * 1024 * 1024;
export const stayPhotoIdPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

// Bound the stream itself; Content-Length is optional and cannot be trusted.
export async function readStayPhoto(request: Request): Promise<Uint8Array | null> {
  if (request.headers.get("content-type") !== "image/jpeg" || !request.body) return null;
  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.length;
    if (size > MAX_STAY_PHOTO_BYTES) { await reader.cancel(); return null; }
    chunks.push(value);
  }
  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.length; }
  return size >= 4 && bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255
    && bytes[size - 2] === 255 && bytes[size - 1] === 217 ? bytes : null;
}

export interface StayPhotosStore {
  upload(tripId: string, id: string, bytes: Uint8Array): Promise<void>;
  download(tripId: string, id: string): Promise<Response>;
}

export class SupabaseStayPhotosStore implements StayPhotosStore {
  constructor(private readonly baseUrl: string, private readonly secretKey: string,
    private readonly fetcher: typeof fetch = fetch) {}

  private url(tripId: string, id: string, download = false) {
    return `${this.baseUrl.replace(/\/$/, "")}/storage/v1/object/${download ? "authenticated/" : ""}stay-photos/${tripId}/${id}.jpg`;
  }

  async upload(tripId: string, id: string, bytes: Uint8Array) {
    const response = await this.fetcher(this.url(tripId, id), {
      method: "POST", headers: { apikey: this.secretKey, authorization: `Bearer ${this.secretKey}`,
        "content-type": "image/jpeg", "x-upsert": "false", "cache-control": "no-store" },
      body: new Blob([new Uint8Array(bytes).buffer], { type: "image/jpeg" }),
    });
    if (!response.ok) throw new Error("STAY_PHOTO_UNAVAILABLE");
  }

  async download(tripId: string, id: string) {
    return this.fetcher(this.url(tripId, id, true), {
      headers: { apikey: this.secretKey, authorization: `Bearer ${this.secretKey}` },
    });
  }
}
