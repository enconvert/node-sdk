/** Enconvert API client. Node 18+ only. */

import { createWriteStream } from "node:fs";
import { mkdir } from "node:fs/promises";
import { dirname } from "node:path";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";
import type { ReadableStream as NodeWebReadableStream } from "node:stream/web";

import { APIError } from "./errors.js";
import {
  DOCUMENT_FORMATS,
  IMAGE_FORMATS,
  assertConversionImplemented,
  normalizeOutputFormat,
  resolveInputFormat,
} from "./formats.js";
import {
  newJobId,
  raiseForStatus,
  serializePdfOptions,
  sleep,
  toFilePart,
  type FilePart,
} from "./internal.js";
import { EnconvertV2 } from "./v2.js";
import type {
  BatchStatus,
  BatchSubmission,
  ClientOptions,
  ConversionResult,
  ConvertDocumentOptions,
  ConvertImageOptions,
  ConvertToMarkdownOptions,
  ConvertToPdfOptions,
  FileInput,
  JobStatus,
  PdfOptions,
  UrlRenderOptions,
  UrlToMarkdownOptions,
  UrlToPdfOptions,
  UrlToScreenshotOptions,
  WaitForBatchOptions,
  WebsiteConversionOptions,
  WebsiteToPdfOptions,
  WebsiteToScreenshotOptions,
} from "./types.js";

const DEFAULT_BASE_URL = "https://api.enconvert.com";
const DEFAULT_TIMEOUT_MS = 300_000;
const DEFAULT_BATCH_POLL_INTERVAL_MS = 5_000;
const DEFAULT_BATCH_TIMEOUT_MS = 1_800_000;

/**
 * Enconvert file conversion client (Node 18+).
 *
 * @example
 *   import { Enconvert } from "@enconvert/node-sdk";
 *   const client = new Enconvert({ apiKey: "sk_..." });
 *   const result = await client.convertUrlToPdf("https://example.com");
 *   console.log(result.presignedUrl);
 */
export class Enconvert {
  private readonly apiKey: string;
  private readonly baseUrl: string;
  private readonly timeout: number;

  /**
   * V2 API namespace: perceive, discover, lookup, distill, ingest, watch.
   * Requires a private API key; endpoints are plan-gated (QuotaError on 402).
   */
  readonly v2: EnconvertV2;

  constructor(opts: ClientOptions) {
    if (!opts?.apiKey) throw new Error("Enconvert: 'apiKey' is required");
    this.apiKey = opts.apiKey;
    this.baseUrl = (opts.baseUrl ?? DEFAULT_BASE_URL).replace(/\/+$/, "");
    this.timeout = opts.timeout ?? DEFAULT_TIMEOUT_MS;
    this.v2 = new EnconvertV2((path, init) => this.fetch(path, init));
  }

  // ------------------------------------------------------------------
  // URL conversions (single page)
  // ------------------------------------------------------------------

  /** Convert a URL to PDF. */
  async convertUrlToPdf(url: string, opts: UrlToPdfOptions = {}): Promise<ConversionResult> {
    const body = buildUrlBody(url, opts);
    body.single_page = opts.singlePage ?? true;
    if (opts.pdfOptions) body.pdf_options = serializePdfOptions(opts.pdfOptions);

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
    const body = buildUrlBody(url, opts);

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
    const body = buildUrlBody(url, opts);

    const data = await this.postJson("/v1/convert/url-to-markdown", body);
    const result = toConversionResult(data);
    if (opts.saveTo) await this.download(result.presignedUrl, opts.saveTo);
    return result;
  }

  // ------------------------------------------------------------------
  // Website conversions (async batch, whole-site crawl)
  // ------------------------------------------------------------------

  /**
   * Convert every discovered page of a website to PDF. Async-only: pages are
   * discovered via sitemap or full crawl (plan-dependent), converted in the
   * background, and bundled into a single ZIP. Poll with getBatchStatus or
   * block with waitForBatch. Requires a private API key with crawl access.
   */
  async convertWebsiteToPdf(
    url: string,
    opts: WebsiteToPdfOptions = {},
  ): Promise<BatchSubmission> {
    const body = buildWebsiteBody(url, opts);
    if (opts.singlePage !== undefined) body.single_page = opts.singlePage;
    if (opts.pdfOptions) body.pdf_options = serializePdfOptions(opts.pdfOptions);

    // No job-polling fallback: website submissions have no per-job row, so a
    // 5xx here means the submission itself failed and must surface directly.
    const data = await this.postJson("/v1/convert/website-to-pdf", body, { jobFallback: false });
    return toBatchSubmission(data);
  }

  /**
   * Screenshot every discovered page of a website (PNG). Async-only, bundled
   * into a single ZIP. Poll with getBatchStatus or block with waitForBatch.
   * Requires a private API key with crawl access.
   */
  async convertWebsiteToScreenshot(
    url: string,
    opts: WebsiteToScreenshotOptions = {},
  ): Promise<BatchSubmission> {
    const body = buildWebsiteBody(url, opts);

    const data = await this.postJson("/v1/convert/website-to-screenshot", body, {
      jobFallback: false,
    });
    return toBatchSubmission(data);
  }

  // ------------------------------------------------------------------
  // File conversions
  // ------------------------------------------------------------------

  /**
   * Convert an image between formats (jpeg, png, svg, heic, webp), or
   * rasterize a PDF to JPEG. Only pairs implemented by the API are accepted;
   * unsupported pairs throw before any request is made.
   */
  async convertImage(file: FileInput, opts: ConvertImageOptions): Promise<ConversionResult> {
    const part = await toFilePart(file);
    const inputFormat = resolveInputFormat(part.filename, IMAGE_FORMATS);
    const outputFmt = normalizeOutputFormat(opts.outputFormat);
    const endpoint = `/v1/convert/${assertConversionImplemented(inputFormat, outputFmt)}`;
    const data = await this.postFile(endpoint, part, { outputFilename: opts.outputFilename });
    const result = toConversionResult(data);
    if (opts.saveTo) await this.download(result.presignedUrl, opts.saveTo);
    return result;
  }

  /**
   * Convert a document (doc, excel, ppt, odt, ods, odp, ots, pages, numbers,
   * html, markdown, csv, json, xml, yaml, toml). Output defaults to pdf. Only
   * pairs implemented by the API are accepted; unsupported pairs throw before
   * any request is made. (EPUB → use convertToPdf / convertToMarkdown.)
   */
  async convertDocument(
    file: FileInput,
    opts: ConvertDocumentOptions = {},
  ): Promise<ConversionResult> {
    const part = await toFilePart(file);
    const inputFormat = resolveInputFormat(part.filename, DOCUMENT_FORMATS);
    const outputFmt = normalizeOutputFormat(opts.outputFormat ?? "pdf");
    const endpoint = `/v1/convert/${assertConversionImplemented(inputFormat, outputFmt)}`;
    const data = await this.postFile(endpoint, part, {
      outputFilename: opts.outputFilename,
      pdfOptions: opts.pdfOptions,
    });
    const result = toConversionResult(data);
    if (opts.saveTo) await this.download(result.presignedUrl, opts.saveTo);
    return result;
  }

  /**
   * Convert an uploaded file of (almost) any document format to clean Markdown
   * — PDF, DOCX, PPTX, XLSX, CSV, HTML, EPUB, TXT/MD, and legacy/ODF office.
   * The format is auto-detected server-side; a RAG-ingestion building block.
   * Images are not supported.
   */
  async convertToMarkdown(
    file: FileInput,
    opts: ConvertToMarkdownOptions = {},
  ): Promise<ConversionResult> {
    const part = await toFilePart(file);
    const data = await this.postFile("/v1/convert/anything-to-markdown", part, {
      outputFilename: opts.outputFilename,
    });
    const result = toConversionResult(data);
    if (opts.saveTo) await this.download(result.presignedUrl, opts.saveTo);
    return result;
  }

  /**
   * Convert an uploaded file of (almost) any format to PDF — office/ODF/Pages/
   * Numbers/RTF/CSV, HTML, Markdown, text, raster images, SVG, EPUB, or an
   * existing PDF (passthrough/normalise). The format is auto-detected
   * server-side. Only `pdfOptions.grayscale` is honored on this endpoint.
   */
  async convertToPdf(
    file: FileInput,
    opts: ConvertToPdfOptions = {},
  ): Promise<ConversionResult> {
    const part = await toFilePart(file);
    const data = await this.postFile("/v1/convert/anything-to-pdf", part, {
      outputFilename: opts.outputFilename,
      pdfOptions: opts.pdfOptions,
    });
    const result = toConversionResult(data);
    if (opts.saveTo) await this.download(result.presignedUrl, opts.saveTo);
    return result;
  }

  // ------------------------------------------------------------------
  // Job + batch status
  // ------------------------------------------------------------------

  /** Poll the status of an async conversion job. */
  async getJobStatus(jobId: string): Promise<JobStatus> {
    const resp = await this.fetch(`/v1/convert/status/${jobId}`, { method: "GET" });
    await raiseForStatus(resp);
    const data = (await resp.json()) as Record<string, unknown>;
    return toJobStatus(data);
  }

  /**
   * Get the status of an async batch (website conversion). Returns aggregate
   * counts, per-URL statuses, and download URLs. Private API keys only.
   */
  async getBatchStatus(batchId: string): Promise<BatchStatus> {
    const resp = await this.fetch(`/v1/convert/batch/${batchId}`, { method: "GET" });
    await raiseForStatus(resp);
    const data = (await resp.json()) as Record<string, unknown>;
    return toBatchStatus(data);
  }

  /**
   * Poll a batch until it leaves "processing", then return its final status.
   * With `saveTo`, downloads the batch ZIP once available. Throws APIError
   * 504 on timeout.
   */
  async waitForBatch(batchId: string, opts: WaitForBatchOptions = {}): Promise<BatchStatus> {
    const intervalMs = opts.intervalMs ?? DEFAULT_BATCH_POLL_INTERVAL_MS;
    const timeoutMs = opts.timeoutMs ?? DEFAULT_BATCH_TIMEOUT_MS;
    const deadline = Date.now() + timeoutMs;

    for (;;) {
      const status = await this.getBatchStatus(batchId);
      if (status.status !== "processing") {
        if (opts.saveTo) {
          if (!status.zipDownloadUrl) {
            throw new APIError(
              500,
              `Batch ${batchId} finished with status '${status.status}' but no ZIP is available to save`,
            );
          }
          await this.download(status.zipDownloadUrl, opts.saveTo);
        }
        return status;
      }
      if (Date.now() >= deadline) {
        throw new APIError(504, `Batch ${batchId} did not complete within ${timeoutMs}ms`);
      }
      await sleep(intervalMs);
    }
  }

  // ------------------------------------------------------------------
  // Internal helpers (mirror of Python _post_json / _post_file / _poll_job /
  // _download / _resolve_format / _raise_for_status)
  // ------------------------------------------------------------------

  private async postJson(
    endpoint: string,
    body: Record<string, unknown>,
    opts: { jobFallback?: boolean } = {},
  ): Promise<unknown> {
    const jobFallback = opts.jobFallback ?? true;
    const jobId = jobFallback ? newJobId() : undefined;
    if (jobId) body.job_id = jobId;
    try {
      const resp = await this.fetch(endpoint, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      });
      await raiseForStatus(resp);
      const data = (await resp.json()) as Record<string, unknown>;
      // Some success responses omit job_id (URL sync path); backfill the
      // client-generated id so callers can still poll getJobStatus with it.
      return jobId ? { job_id: jobId, ...data } : data;
    } catch (e) {
      if (jobId && e instanceof APIError && e.statusCode >= 500) return this.pollJob(jobId);
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
      const data = (await resp.json()) as Record<string, unknown>;
      return { job_id: jobId, ...data };
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

/** Request body shared by all single-URL conversions. */
function buildUrlBody(url: string, opts: UrlRenderOptions): Record<string, unknown> {
  const body: Record<string, unknown> = {
    url,
    direct_download: false,
    viewport_width: opts.viewportWidth ?? 1920,
    viewport_height: opts.viewportHeight ?? 1080,
    load_media: opts.loadMedia ?? true,
    enable_scroll: opts.enableScroll ?? true,
  };
  if (opts.outputFilename) body.output_filename = opts.outputFilename;
  appendBrowserAccess(body, opts);
  return body;
}

/**
 * Request body for website (whole-site) conversions. Render options are only
 * sent when set — the gateway applies the same defaults per page.
 */
function buildWebsiteBody(url: string, opts: WebsiteConversionOptions): Record<string, unknown> {
  const body: Record<string, unknown> = { url };
  if (opts.crawlMode) body.crawl_mode = opts.crawlMode;
  if (opts.includePatterns) body.include_patterns = opts.includePatterns;
  if (opts.excludePatterns) body.exclude_patterns = opts.excludePatterns;
  if (opts.notificationEmail) body.notification_email = opts.notificationEmail;
  if (opts.callbackUrl) body.callback_url = opts.callbackUrl;
  if (opts.outputFilename) body.output_filename = opts.outputFilename;
  if (opts.viewportWidth !== undefined) body.viewport_width = opts.viewportWidth;
  if (opts.viewportHeight !== undefined) body.viewport_height = opts.viewportHeight;
  if (opts.loadMedia !== undefined) body.load_media = opts.loadMedia;
  if (opts.enableScroll !== undefined) body.enable_scroll = opts.enableScroll;
  appendBrowserAccess(body, opts);
  return body;
}

/** Attach the plan-gated auth/cookies/headers fields when provided. */
function appendBrowserAccess(body: Record<string, unknown>, opts: UrlRenderOptions): void {
  if (opts.auth) body.auth = opts.auth;
  if (opts.cookies) body.cookies = opts.cookies;
  if (opts.headers) body.headers = opts.headers;
}

function toConversionResult(data: unknown): ConversionResult {
  const d = data as Record<string, unknown>;
  // Job-status fallback responses omit `filename`; recover it from the
  // object key so callers never see the string "undefined".
  const objectKey = typeof d.object_key === "string" ? d.object_key : "";
  const filename =
    typeof d.filename === "string" ? d.filename : objectKey.split("/").pop() ?? "";
  return {
    presignedUrl: String(d.presigned_url),
    objectKey,
    filename,
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

function toBatchSubmission(data: unknown): BatchSubmission {
  const d = data as Record<string, unknown>;
  return {
    batchId: String(d.batch_id),
    status: typeof d.status === "string" ? d.status : "processing",
    urlCount: typeof d.url_count === "number" ? d.url_count : 0,
    totalDiscovered: typeof d.total_discovered === "number" ? d.total_discovered : undefined,
    discoveryMethod: typeof d.discovery_method === "string" ? d.discovery_method : undefined,
    outputFormat: typeof d.output_format === "string" ? d.output_format : undefined,
  };
}

function toBatchStatus(d: Record<string, unknown>): BatchStatus {
  const rawItems = Array.isArray(d.items) ? (d.items as Record<string, unknown>[]) : [];
  return {
    batchId: String(d.batch_id),
    status: d.status as BatchStatus["status"],
    total: typeof d.total === "number" ? d.total : 0,
    completed: typeof d.completed === "number" ? d.completed : 0,
    failed: typeof d.failed === "number" ? d.failed : 0,
    inProgress: typeof d.in_progress === "number" ? d.in_progress : 0,
    outputMode: d.output_mode as BatchStatus["outputMode"],
    zipDownloadUrl: typeof d.zip_download_url === "string" ? d.zip_download_url : undefined,
    items: rawItems.map((item) => ({
      sourceUrl: typeof item.source_url === "string" ? item.source_url : "",
      status: typeof item.status === "string" ? item.status : "",
      downloadUrl: typeof item.download_url === "string" ? item.download_url : undefined,
      outputFileSize: typeof item.output_file_size === "number" ? item.output_file_size : undefined,
      duration: typeof item.duration === "string" ? item.duration : undefined,
    })),
  };
}

