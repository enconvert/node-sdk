/** Shared internal helpers used by both the V1 client and the V2 namespace. */

import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import { basename } from "node:path";
import { Buffer } from "node:buffer";

import { APIError, AuthenticationError, QuotaError, RateLimitError } from "./errors.js";
import { mimeFor } from "./formats.js";
import type { FileInput, PdfOptions } from "./types.js";

/** Authenticated, timeout-wrapped fetch bound to the client's base URL. */
export type RequestFn = (path: string, init: RequestInit) => Promise<Response>;

export async function raiseForStatus(resp: Response): Promise<void> {
  if (resp.status < 400) return;
  let message: string;
  try {
    const body = (await resp.clone().json()) as Record<string, unknown>;
    message =
      (body.detail as string) || (body.error as string) || JSON.stringify(body);
  } catch {
    message = (await resp.text().catch(() => "")) || `HTTP ${resp.status}`;
  }
  if (resp.status === 401 || resp.status === 403) throw new AuthenticationError(message);
  if (resp.status === 402) throw new QuotaError(message);
  if (resp.status === 429) throw new RateLimitError(message, retryAfterSeconds(resp));
  throw new APIError(resp.status, message);
}

// ponytail: delay-seconds form only; the gateway never sends the HTTP-date form.
function retryAfterSeconds(resp: Response): number | undefined {
  const raw = resp.headers.get("retry-after");
  if (raw === null) return undefined;
  const seconds = Number.parseInt(raw, 10);
  return Number.isNaN(seconds) ? undefined : seconds;
}

export function serializePdfOptions(o: PdfOptions): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  if (o.pageSize !== undefined) out.page_size = o.pageSize;
  if (o.pageWidth !== undefined) out.page_width = o.pageWidth;
  if (o.pageHeight !== undefined) out.page_height = o.pageHeight;
  if (o.orientation !== undefined) out.orientation = o.orientation;
  if (o.margins !== undefined) out.margins = o.margins;
  if (o.scale !== undefined) out.scale = o.scale;
  if (o.grayscale !== undefined) out.grayscale = o.grayscale;
  if (o.header !== undefined) out.header = o.header;
  if (o.footer !== undefined) out.footer = o.footer;
  return out;
}

export function newJobId(): string {
  return randomUUID().replace(/-/g, "");
}

export function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

/** Normalized file upload: raw bytes plus a filename and content type. */
export interface FilePart {
  bytes: Uint8Array;
  filename: string;
  contentType: string;
}

/**
 * Convert a `FileInput` (path string, Uint8Array/Buffer, or { data, filename })
 * into a normalized `{ bytes, filename, contentType }`. Shared by the V1 file
 * conversions and the V2 file-ingest path.
 */
export async function toFilePart(file: FileInput): Promise<FilePart> {
  if (typeof file === "string") {
    const bytes = new Uint8Array(await readFile(file));
    const filename = basename(file);
    return { bytes, filename, contentType: mimeFor(filename) };
  }
  if (file instanceof Uint8Array || Buffer.isBuffer(file)) {
    return {
      bytes: file instanceof Uint8Array ? file : new Uint8Array(file),
      filename: "upload.bin",
      contentType: "application/octet-stream",
    };
  }
  if (typeof file === "object" && file && "data" in file && "filename" in file) {
    const wrapped = file;
    const bytes =
      wrapped.data instanceof Uint8Array ? wrapped.data : new Uint8Array(wrapped.data);
    return {
      bytes,
      filename: wrapped.filename,
      contentType: wrapped.contentType ?? mimeFor(wrapped.filename),
    };
  }
  throw new Error(
    "Unsupported file input. Pass a path string, Uint8Array/Buffer, or { data, filename }.",
  );
}
