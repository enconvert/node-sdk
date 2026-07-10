/** Enconvert SDK response and option types. */

export interface ConversionResult {
  presignedUrl: string;
  objectKey: string;
  filename: string;
  fileSize?: number;
  conversionTimeSeconds?: number;
  jobId?: string;
}

export type JobStatusValue = "processing" | "success" | "failed";

export interface JobStatus {
  status: JobStatusValue;
  presignedUrl?: string;
  objectKey?: string;
  error?: string;
}

export interface PdfMargins {
  top?: number;
  bottom?: number;
  left?: number;
  right?: number;
}

/** Header or footer block rendered on each PDF page. */
export interface PdfHeaderFooter {
  /** Text content, max 2000 characters. */
  content?: string;
  /** Block height. */
  height?: number;
}

export interface PdfOptions {
  pageSize?: string;
  /** Custom page width; overrides pageSize when set together with pageHeight. */
  pageWidth?: number;
  /** Custom page height; overrides pageSize when set together with pageWidth. */
  pageHeight?: number;
  orientation?: "portrait" | "landscape";
  margins?: PdfMargins;
  scale?: number;
  grayscale?: boolean;
  header?: PdfHeaderFooter;
  footer?: PdfHeaderFooter;
}

/** HTTP Basic Auth credentials for pages behind a login (plan-gated). */
export interface HttpBasicAuth {
  username: string;
  password: string;
}

/**
 * Cookie injected into the browser context before rendering (plan-gated).
 * The API requires `name`, `value`, and either `domain` or `url`.
 * When `domain` is set without `path`, the API defaults `path` to "/".
 */
export interface BrowserCookie {
  name: string;
  value: string;
  domain?: string;
  url?: string;
  path?: string;
  expires?: number;
  httpOnly?: boolean;
  secure?: boolean;
  sameSite?: "Strict" | "Lax" | "None";
}

/**
 * File input accepted by convertImage / convertDocument.
 *
 * - Pass a string path: `"./photo.heic"`.
 * - Pass raw bytes as `Uint8Array` or Node `Buffer`.
 * - For raw bytes with an explicit filename, wrap as `{ data, filename, contentType? }`.
 */
export type FileInput =
  | string
  | Uint8Array
  | { data: Uint8Array; filename: string; contentType?: string };

export interface ClientOptions {
  apiKey: string;
  /** Request timeout in milliseconds. Defaults to 300_000 (5 minutes). */
  timeout?: number;
  /** Override the API base URL. Defaults to https://api.enconvert.com */
  baseUrl?: string;
}

/** Options shared by all URL-based conversions (single page and website). */
export interface UrlRenderOptions {
  viewportWidth?: number;
  viewportHeight?: number;
  loadMedia?: boolean;
  enableScroll?: boolean;
  outputFilename?: string;
  /** HTTP Basic Auth for protected pages (plan-gated). */
  auth?: HttpBasicAuth;
  /** Cookies injected before rendering, max 50 (plan-gated). */
  cookies?: BrowserCookie[];
  /** Extra request headers, max 20; hop-by-hop headers rejected (plan-gated). */
  headers?: Record<string, string>;
}

export interface UrlToPdfOptions extends UrlRenderOptions {
  saveTo?: string;
  singlePage?: boolean;
  pdfOptions?: PdfOptions;
}

export interface UrlToScreenshotOptions extends UrlRenderOptions {
  saveTo?: string;
}

export interface UrlToMarkdownOptions extends UrlRenderOptions {
  saveTo?: string;
}

export interface ConvertImageOptions {
  outputFormat: string;
  saveTo?: string;
  outputFilename?: string;
}

export interface ConvertDocumentOptions {
  outputFormat?: string;
  saveTo?: string;
  outputFilename?: string;
  pdfOptions?: PdfOptions;
}

/**
 * URL discovery strategy for website conversions.
 * - "auto": highest mode the plan allows (default)
 * - "sitemap": sitemap.xml only (Starter and above)
 * - "full": sitemap plus BFS crawl (Pro/Business)
 */
export type CrawlMode = "auto" | "sitemap" | "full";

/** Options shared by convertWebsiteToPdf / convertWebsiteToScreenshot. */
export interface WebsiteConversionOptions extends UrlRenderOptions {
  crawlMode?: CrawlMode;
  /** Only crawl URLs matching these patterns (full crawl mode). */
  includePatterns?: string[];
  /** Skip URLs matching these patterns (full crawl mode). */
  excludePatterns?: string[];
  /** Email notified on completion. Defaults to the project owner's email. */
  notificationEmail?: string;
  /** Webhook POSTed when the batch finishes (plan-gated). */
  callbackUrl?: string;
}

export interface WebsiteToPdfOptions extends WebsiteConversionOptions {
  singlePage?: boolean;
  pdfOptions?: PdfOptions;
}

export type WebsiteToScreenshotOptions = WebsiteConversionOptions;

/** 202 response from an async batch submission (website conversions). */
export interface BatchSubmission {
  batchId: string;
  /** Always "processing" on submission. */
  status: string;
  /** Number of pages queued for conversion. */
  urlCount: number;
  /** Total URLs found during discovery (before plan limits applied). */
  totalDiscovered?: number;
  /** How URLs were discovered: "sitemap" or "full_crawl". */
  discoveryMethod?: string;
  /** Output packaging, "zip" for website conversions. */
  outputFormat?: string;
}

export type BatchStatusValue = "processing" | "completed" | "partial" | "failed";

/** Per-URL entry in a batch status response. */
export interface BatchItem {
  sourceUrl: string;
  /** Raw activity status: "In Progress", "Success", or "Failed". */
  status: string;
  downloadUrl?: string;
  outputFileSize?: number;
  duration?: string;
}

export interface BatchStatus {
  batchId: string;
  status: BatchStatusValue;
  total: number;
  completed: number;
  failed: number;
  inProgress: number;
  outputMode: "zip" | "individual";
  /** Presigned URL of the bundled ZIP when outputMode is "zip". */
  zipDownloadUrl?: string;
  items: BatchItem[];
}

export interface WaitForBatchOptions {
  /** Poll interval in milliseconds. Defaults to 5_000. */
  intervalMs?: number;
  /** Give up after this many milliseconds. Defaults to 1_800_000 (30 minutes). */
  timeoutMs?: number;
  /** Save the batch ZIP to this local path once available. */
  saveTo?: string;
}
