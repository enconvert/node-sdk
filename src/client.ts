/** Enconvert API client. Node 18+ only. */

import { createWriteStream } from "node:fs";
import { mkdir, readFile } from "node:fs/promises";
import { basename, dirname } from "node:path";
import { Buffer } from "node:buffer";
import { randomUUID } from "node:crypto";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";
import type { ReadableStream as NodeWebReadableStream } from "node:stream/web";

import { APIError, AuthenticationError, RateLimitError } from "./errors.js";
import type {
  ClientOptions,
  ConversionResult,
  ConvertDocumentOptions,
  ConvertImageOptions,
  FileInput,
  JobStatus,
  PdfOptions,
  UrlToMarkdownOptions,
  UrlToPdfOptions,
  UrlToScreenshotOptions,
} from "./types.js";

const DEFAULT_BASE_URL = "https://api.enconvert.com";
const DEFAULT_TIMEOUT_MS = 300_000;

// Extension -> API format name (mirror of Python SDK)
const IMAGE_FORMATS: Record<string, string> = {
  ".jpg": "jpeg",
  ".jpeg": "jpeg",
  ".png": "png",
  ".svg": "svg",
  ".heic": "heic",
  ".webp": "webp",
};

const DOCUMENT_FORMATS: Record<string, string> = {
  ".doc": "doc",
  ".docx": "doc",
  ".xls": "excel",
  ".xlsx": "excel",
  ".ppt": "ppt",
  ".pptx": "ppt",
  ".html": "html",
  ".htm": "html",
  ".odt": "odt",
  ".ods": "ods",
  ".odp": "odp",
  ".ots": "ots",
  ".pages": "pages",
  ".numbers": "numbers",
  ".epub": "epub",
  ".md": "markdown",
  ".markdown": "markdown",
  ".csv": "csv",
  ".json": "json",
  ".xml": "xml",
  ".yaml": "yaml",
  ".yml": "yaml",
  ".toml": "toml",
};

const MIME_BY_EXT: Record<string, string> = {
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".heic": "image/heic",
  ".webp": "image/webp",
  ".pdf": "application/pdf",
  ".doc": "application/msword",
  ".docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  ".xls": "application/vnd.ms-excel",
  ".xlsx": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  ".ppt": "application/vnd.ms-powerpoint",
  ".pptx": "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  ".html": "text/html",
  ".htm": "text/html",
  ".odt": "application/vnd.oasis.opendocument.text",
  ".ods": "application/vnd.oasis.opendocument.spreadsheet",
  ".odp": "application/vnd.oasis.opendocument.presentation",
  ".epub": "application/epub+zip",
  ".md": "text/markdown",
  ".markdown": "text/markdown",
  ".csv": "text/csv",
  ".json": "application/json",
  ".xml": "application/xml",
  ".yaml": "application/x-yaml",
  ".yml": "application/x-yaml",
  ".toml": "application/toml",
};

/**
 * Enconvert file conversion client (Node 18+).
 *
 * @example
 *   import { Enconvert } from "enconvert";
 *   const client = new Enconvert({ apiKey: "sk_..." });
 *   const result = await client.convertUrlToPdf("https://example.com");
 *   console.log(result.presignedUrl);
 */
export class Enconvert {
  private readonly apiKey: string;
  private readonly baseUrl: string;
  private readonly timeout: number;

  constructor(opts: ClientOptions) {
    if (!opts?.apiKey) throw new Error("Enconvert: 'apiKey' is required");
    this.apiKey = opts.apiKey;
    this.baseUrl = (opts.baseUrl ?? DEFAULT_BASE_URL).replace(/\/+$/, "");
    this.timeout = opts.timeout ?? DEFAULT_TIMEOUT_MS;
  }

  // ------------------------------------------------------------------
  // URL conversions
  // ------------------------------------------------------------------

  /** Convert a URL to PDF. */
  async convertUrlToPdf(url: string, opts: UrlToPdfOptions = {}): Promise<ConversionResult> {
    const body: Record<string, unknown> = {
      url,
      direct_download: false,
      single_page: opts.singlePage ?? true,
      viewport_width: opts.viewportWidth ?? 1920,
      viewport_height: opts.viewportHeight ?? 1080,
      load_media: opts.loadMedia ?? true,
      enable_scroll: opts.enableScroll ?? true,
    };
    if (opts.pdfOptions) body.pdf_options = serializePdfOptions(opts.pdfOptions);
    if (opts.outputFilename) body.output_filename = opts.outputFilename;

    const data = await this.postJson("/v1/convert/url-to-pdf", body);
    const result = toConversionResult(data);
    if (opts.saveTo) await this.download(result.presignedUrl, opts.saveTo);
    return result;
  }

  /** Convert a URL to a PNG screenshot. */
  async convertUrlToScreenshot(
    url: string,
    opts: UrlToScreenshotOptions = {},
  ): Promise<ConversionResult> {
    const body: Record<string, unknown> = {
      url,
      direct_download: false,
      viewport_width: opts.viewportWidth ?? 1920,
      viewport_height: opts.viewportHeight ?? 1080,
      load_media: opts.loadMedia ?? true,
      enable_scroll: opts.enableScroll ?? true,
    };
    if (opts.outputFilename) body.output_filename = opts.outputFilename;

    const data = await this.postJson("/v1/convert/url-to-screenshot", body);
    const result = toConversionResult(data);
    if (opts.saveTo) await this.download(result.presignedUrl, opts.saveTo);
    return result;
  }

  /**
   * Convert a URL to clean GitHub-Flavored Markdown with YAML frontmatter
   * (title, description, url, links, images). Strips nav/footer/ads/scripts
   * and extracts the main article content.
   */
  async convertUrlToMarkdown(
    url: string,
    opts: UrlToMarkdownOptions = {},
  ): Promise<ConversionResult> {
    const body: Record<string, unknown> = {
      url,
      direct_download: false,
      viewport_width: opts.viewportWidth ?? 1920,
      viewport_height: opts.viewportHeight ?? 1080,
      load_media: opts.loadMedia ?? true,
      enable_scroll: opts.enableScroll ?? true,
    };
    if (opts.outputFilename) body.output_filename = opts.outputFilename;

    const data = await this.postJson("/v1/convert/url-to-markdown", body);
    const result = toConversionResult(data);
    if (opts.saveTo) await this.download(result.presignedUrl, opts.saveTo);
    return result;
  }

  // ------------------------------------------------------------------
  // File conversions
  // ------------------------------------------------------------------

  /** Convert an image between formats (jpeg, png, svg, heic, webp). */
  async convertImage(file: FileInput, opts: ConvertImageOptions): Promise<ConversionResult> {
    const part = await this.toFilePart(file);
    const inputFormat = resolveFormat(part.filename, IMAGE_FORMATS);
    const outputFmt = opts.outputFormat.toLowerCase().replace(/^\./, "");
    const supported = Array.from(new Set(Object.values(IMAGE_FORMATS))).sort();
    if (!supported.includes(outputFmt)) {
      throw new Error(
        `Unsupported output format '${opts.outputFormat}'. Supported: ${supported.join(", ")}`,
      );
    }
    const endpoint = `/v1/convert/${inputFormat}-to-${outputFmt}`;
    const data = await this.postFile(endpoint, part, { outputFilename: opts.outputFilename });
    const result = toConversionResult(data);
    if (opts.saveTo) await this.download(result.presignedUrl, opts.saveTo);
    return result;
  }

  /**
   * Convert a document (doc, excel, ppt, html, epub, markdown, csv, json,
   * xml, yaml, toml).
   */
  async convertDocument(
    file: FileInput,
    opts: ConvertDocumentOptions = {},
  ): Promise<ConversionResult> {
    const part = await this.toFilePart(file);
    const inputFormat = resolveFormat(part.filename, DOCUMENT_FORMATS);
    const outputFmt = (opts.outputFormat ?? "pdf").toLowerCase().replace(/^\./, "");
    const endpoint = `/v1/convert/${inputFormat}-to-${outputFmt}`;
    const data = await this.postFile(endpoint, part, {
      outputFilename: opts.outputFilename,
      pdfOptions: opts.pdfOptions,
    });
    const result = toConversionResult(data);
    if (opts.saveTo) await this.download(result.presignedUrl, opts.saveTo);
    return result;
  }

  // ------------------------------------------------------------------
  // Job status
  // ------------------------------------------------------------------

  /** Poll the status of an async conversion job. */
  async getJobStatus(jobId: string): Promise<JobStatus> {
    const resp = await this.fetch(`/v1/convert/status/${jobId}`, { method: "GET" });
    await raiseForStatus(resp);
    const data = (await resp.json()) as Record<string, unknown>;
    return toJobStatus(data);
  }

  // ------------------------------------------------------------------
  // Internal helpers (mirror of Python _post_json / _post_file / _poll_job /
  // _download / _resolve_format / _raise_for_status)
  // ------------------------------------------------------------------

  private async postJson(endpoint: string, body: Record<string, unknown>): Promise<unknown> {
    const jobId = newJobId();
    body.job_id = jobId;
    try {
      const resp = await this.fetch(endpoint, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      });
      await raiseForStatus(resp);
      return await resp.json();
    } catch (e) {
      if (e instanceof APIError && e.statusCode >= 500) return this.pollJob(jobId);
      throw e;
    }
  }

  private async postFile(
    endpoint: string,
    part: FilePart,
    opts: { outputFilename?: string; pdfOptions?: PdfOptions } = {},
  ): Promise<unknown> {
    const jobId = newJobId();
    const form = new FormData();
    form.append("file", new Blob([part.bytes], { type: part.contentType }), part.filename);
    form.append("direct_download", "false");
    form.append("job_id", jobId);
    if (opts.outputFilename) form.append("output_filename", opts.outputFilename);
    if (opts.pdfOptions) {
      form.append("pdf_options", JSON.stringify(serializePdfOptions(opts.pdfOptions)));
    }
    try {
      const resp = await this.fetch(endpoint, { method: "POST", body: form });
      await raiseForStatus(resp);
      return await resp.json();
    } catch (e) {
      if (e instanceof APIError && e.statusCode >= 500) return this.pollJob(jobId);
      throw e;
    }
  }

  /** Poll job status until success/failure. Used as fallback when the HTTP request fails. */
  private async pollJob(jobId: string, maxWaitMs = 300_000, intervalMs = 3_000): Promise<unknown> {
    const deadline = Date.now() + maxWaitMs;
    while (Date.now() < deadline) {
      await sleep(intervalMs);
      const resp = await this.fetch(`/v1/convert/status/${jobId}`, { method: "GET" });
      if (resp.status === 404) continue;
      await raiseForStatus(resp);
      const data = (await resp.json()) as { status: string; error?: string };
      if (data.status === "success") return data;
      if (data.status === "failed") throw new APIError(500, data.error ?? "Conversion failed");
    }
    throw new APIError(504, "Conversion timed out");
  }

  /** Save a presigned URL to a local file. Streams the response to disk. */
  private async download(url: string, dest: string): Promise<void> {
    const resp = await fetch(url);
    if (!resp.ok) throw new APIError(resp.status, `Failed to download: ${resp.statusText}`);
    if (!resp.body) throw new APIError(resp.status, "Empty response body");
    await mkdir(dirname(dest), { recursive: true });
    const webStream = resp.body as unknown as NodeWebReadableStream<Uint8Array>;
    await pipeline(Readable.fromWeb(webStream), createWriteStream(dest));
  }

  /** Convert a `FileInput` into a normalized `{ bytes, filename, contentType }`. */
  private async toFilePart(file: FileInput): Promise<FilePart> {
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

  /** Centralized fetch with API key + timeout. */
  private async fetch(path: string, init: RequestInit): Promise<Response> {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), this.timeout);
    try {
      return await fetch(`${this.baseUrl}${path}`, {
        ...init,
        signal: ctrl.signal,
        headers: { "X-API-Key": this.apiKey, ...(init.headers ?? {}) },
      });
    } finally {
      clearTimeout(t);
    }
  }
}

// ----------------------------------------------------------------------
// Module-level helpers (same role as Python's @staticmethod private helpers)
// ----------------------------------------------------------------------

interface FilePart {
  bytes: Uint8Array;
  filename: string;
  contentType: string;
}

function extOf(name: string): string {
  const i = name.lastIndexOf(".");
  return i === -1 ? "" : name.slice(i).toLowerCase();
}

function mimeFor(name: string): string {
  return MIME_BY_EXT[extOf(name)] ?? "application/octet-stream";
}

function resolveFormat(name: string, map: Record<string, string>): string {
  const ext = extOf(name);
  const fmt = map[ext];
  if (!fmt) {
    const supported = Array.from(new Set(Object.keys(map))).sort().join(", ");
    throw new Error(`Unsupported file extension '${ext}'. Supported: ${supported}`);
  }
  return fmt;
}

function serializePdfOptions(o: PdfOptions): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  if (o.pageSize !== undefined) out.page_size = o.pageSize;
  if (o.orientation !== undefined) out.orientation = o.orientation;
  if (o.margins !== undefined) out.margins = o.margins;
  if (o.scale !== undefined) out.scale = o.scale;
  if (o.grayscale !== undefined) out.grayscale = o.grayscale;
  if (o.header !== undefined) out.header = o.header;
  if (o.footer !== undefined) out.footer = o.footer;
  return out;
}

function toConversionResult(data: unknown): ConversionResult {
  const d = data as Record<string, unknown>;
  return {
    presignedUrl: String(d.presigned_url),
    objectKey: String(d.object_key),
    filename: String(d.filename),
    fileSize: typeof d.file_size === "number" ? d.file_size : undefined,
    conversionTimeSeconds:
      typeof d.conversion_time_seconds === "number" ? d.conversion_time_seconds : undefined,
    jobId: typeof d.job_id === "string" ? d.job_id : undefined,
  };
}

function toJobStatus(data: Record<string, unknown>): JobStatus {
  return {
    status: data.status as JobStatus["status"],
    presignedUrl: typeof data.presigned_url === "string" ? data.presigned_url : undefined,
    objectKey: typeof data.object_key === "string" ? data.object_key : undefined,
    error: typeof data.error === "string" ? data.error : undefined,
  };
}

async function raiseForStatus(resp: Response): Promise<void> {
  if (resp.status < 400) return;
  let message: string;
  try {
    const body = (await resp.clone().json()) as Record<string, unknown>;
    message = (body.detail as string) || (body.error as string) || JSON.stringify(body);
  } catch {
    message = (await resp.text().catch(() => "")) || `HTTP ${resp.status}`;
  }
  if (resp.status === 401 || resp.status === 403) throw new AuthenticationError(message);
  if (resp.status === 429) throw new RateLimitError(message);
  throw new APIError(resp.status, message);
}

function newJobId(): string {
  return randomUUID().replace(/-/g, "");
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}
