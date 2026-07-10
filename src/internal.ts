/** Shared internal helpers used by both the V1 client and the V2 namespace. */

import { randomUUID } from "node:crypto";

import { APIError, AuthenticationError, QuotaError, RateLimitError } from "./errors.js";
import type { PdfOptions } from "./types.js";

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
  if (resp.status === 429) throw new RateLimitError(message);
  throw new APIError(resp.status, message);
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
