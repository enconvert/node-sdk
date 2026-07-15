/**
 * V2 API option and result types.
 *
 * Field names are camelCase on the SDK surface and mapped to the API's
 * snake_case wire format. User-data payloads (extraction schemas, extracted
 * data, tracked fields, diff changes, search extras) pass through untouched.
 */

import type { HttpBasicAuth, BrowserCookie, PdfOptions } from "./types.js";

// ---------------------------------------------------------------------------
// Perceive
// ---------------------------------------------------------------------------

export type PerceiveOutputName =
  | "markdown"
  | "markdown_fit"
  | "html_cleaned"
  | "html_raw"
  | "screenshot"
  | "screenshot_full_page"
  | "pdf"
  | "links"
  | "images"
  | "structured";

export type PerceiveExtractName =
  | "tables"
  | "prices"
  | "contacts"
  | "metadata"
  | "main_content"
  | "headings"
  | "structured_data"
  | "technologies"
  | "all";

export type PerceiveResourceType =
  | "image"
  | "media"
  | "font"
  | "stylesheet"
  | "script"
  | "xhr"
  | "fetch"
  | "websocket"
  | "manifest"
  | "other";

export type PerceiveCacheMode = "enabled" | "bypass" | "refresh";

export type PerceiveStatus = "queued" | "processing" | "completed" | "failed";

export interface PerceiveViewport {
  /** 320-3840, default 1920. */
  width?: number;
  /** 240-2160, default 1080. */
  height?: number;
}

/** Per-render options shared by perceive and perceiveBatch. */
export interface PerceiveOptions {
  /** Artifacts to produce. Default: ["markdown", "structured"]. */
  outputs?: PerceiveOutputName[];
  /** Heuristic extraction targets. Unsupported members yield warnings. */
  extract?: PerceiveExtractName[];
  /** JSON schema for structured extraction (LLM tier, plan-gated). */
  schema?: Record<string, unknown>;
  /** CSS selector (optionally "css:...") or "js:<expr>" to await. */
  waitFor?: string;
  /** 0-60000, default 30000. */
  waitTimeoutMs?: number;
  /** JavaScript executed after navigation. Max 20000 chars. */
  jsCode?: string;
  viewport?: PerceiveViewport;
  headers?: Record<string, string>;
  cookies?: BrowserCookie[];
  /** HTTP Basic Auth (plan-gated). */
  auth?: HttpBasicAuth;
  /** Not yet available server-side — currently rejected with 422. */
  proxyUrl?: string;
  /** Not yet available server-side — currently rejected with 422. */
  geolocation?: Record<string, unknown>;
  /** Not yet available server-side — currently rejected with 422. */
  actionChain?: Record<string, unknown>[];
  /** Default "enabled" (1h cache). "bypass" skips, "refresh" re-renders. */
  cacheMode?: PerceiveCacheMode;
  /** Only meaningful when outputs includes "pdf". */
  pdfOptions?: PdfOptions;
  /** Resource types the browser should not load. */
  blockResources?: PerceiveResourceType[];
  respectRobots?: boolean;
  mobile?: boolean;
}

export type PerceiveBatchOutputMode = "manifest" | "zip";

/** Options for perceiveBatch: shared render options plus the output mode. */
export interface PerceiveBatchOptions extends PerceiveOptions {
  /** "manifest" (default) or "zip" (bundle all artifacts once complete). */
  outputMode?: PerceiveBatchOutputMode;
}

/** A rendered output stored server-side, addressed by signed URL. */
export interface V2OutputArtifact {
  /** Pre-signed download URL (15 minutes). Re-signed on every status GET. */
  url?: string;
  objectKey: string;
  sizeBytes: number;
  contentType: string;
  expiresIn: number;
}

export interface V2Tokens {
  input: number;
  output: number;
}

export type PerceiveExtractionTier = "heuristic" | "css" | "llm";

export interface PerceiveResult {
  operationId: string;
  status: PerceiveStatus;
  url: string;
  urlFinal?: string;
  contentHash?: string;
  /** 0.0-1.0 render quality score. */
  renderQuality?: number;
  cacheHit: boolean;
  /** Keyed by output name (e.g. "markdown", "screenshot_full_page"). */
  outputs: Record<string, V2OutputArtifact>;
  /** Present when extract/schema was requested. Shape is caller-defined. */
  structured?: Record<string, unknown>;
  extractionTier?: PerceiveExtractionTier;
  tokens: V2Tokens;
  costCents: number;
  durationMs?: number;
  error?: string;
  warnings: string[];
}

export type PerceiveBatchStatus =
  | "queued"
  | "processing"
  | "completed"
  | "failed"
  | "partial";

export interface PerceiveBatchResult {
  jobId: string;
  status: PerceiveBatchStatus;
  outputMode: PerceiveBatchOutputMode;
  total: number;
  completed: number;
  failed: number;
  pending: number;
  /** Bundle of every successful artifact (outputMode "zip", once done). */
  zip?: V2OutputArtifact;
  /** One entry per URL. Empty on the initial 202 — poll getPerceiveBatch. */
  items: PerceiveResult[];
  warnings: string[];
}

// ---------------------------------------------------------------------------
// Discover
// ---------------------------------------------------------------------------

export type DiscoverMode = "sitemap" | "crawl" | "hybrid";

export interface DiscoverOptions {
  /** Default "hybrid" (sitemap + HTTP crawl). */
  mode?: DiscoverMode;
  /** 1-1000, default 100. */
  maxUrls?: number;
  /** 1-5, default 2. */
  maxDepth?: number;
  /** Regex allowlist (re.search semantics), max 50. */
  includePatterns?: string[];
  /** Regex denylist, applied after includePatterns, max 50. */
  excludePatterns?: string[];
  /** Default true. */
  sameDomainOnly?: boolean;
  respectRobots?: boolean;
}

export interface DiscoverResult {
  url: string;
  mode: DiscoverMode;
  total: number;
  urls: string[];
  pagesCrawled: number;
  /** True when more URLs were found than maxUrls allowed. */
  truncated: boolean;
  robotsRespected: boolean;
  /** Raw counts per source before dedup, e.g. {sitemap: 42, crawl: 30}. */
  sources: Record<string, number>;
  warnings: string[];
}

// ---------------------------------------------------------------------------
// Lookup
// ---------------------------------------------------------------------------

export type LookupCategory =
  | "web"
  | "news"
  | "images"
  | "scholar"
  | "patents"
  | "maps";

export type LookupTimeFilter = "hour" | "day" | "week" | "month" | "year";

export interface LookupOptions {
  /** Default "web". */
  category?: LookupCategory;
  /** Google "gl" country code, e.g. "us", "in". */
  country?: string;
  /** Google "hl" interface language, e.g. "en". */
  locale?: string;
  timeFilter?: LookupTimeFilter;
  /** 1-100, default 10. */
  numResults?: number;
  /** 1-10, default 1. */
  page?: number;
  /** Free-text location, e.g. "Austin, Texas". */
  location?: string;
  /** Default true. */
  autocorrect?: boolean;
  /**
   * Auto-perceive the top-N result URLs (0-10, default 0). Each consumes
   * one perceive-quota unit and runs a full browser render.
   */
  perceiveTop?: number;
}

/** One search hit, optionally carrying its full perceive result. */
export interface LookupItem {
  title?: string;
  url?: string;
  snippet?: string;
  position?: number;
  source?: string;
  date?: string;
  imageUrl?: string;
  thumbnailUrl?: string;
  /** Provider-specific passthrough fields. */
  extra: Record<string, unknown>;
  /** Present for the top-N results when perceiveTop > 0 and it succeeded. */
  perceive?: PerceiveResult;
}

export interface LookupResult {
  /** Audit row id; undefined when the audit write failed (results valid). */
  lookupId?: number;
  query: string;
  category: LookupCategory;
  country?: string;
  locale?: string;
  timeFilter?: LookupTimeFilter;
  total: number;
  results: LookupItem[];
  /** How many results were actually perceived (may be below requested). */
  perceiveTop: number;
  perceiveOperationIds: string[];
  answerBox?: Record<string, unknown>;
  knowledgeGraph?: Record<string, unknown>;
  /** Search-provider credits consumed. */
  credits?: number;
  costCents: number;
  warnings: string[];
}

// ---------------------------------------------------------------------------
// Distill
// ---------------------------------------------------------------------------

export type CssFieldType =
  | "text"
  | "attribute"
  | "html"
  | "regex"
  | "nested"
  | "list"
  | "nested_list";

/** One field of a CSS extraction schema (recursive for nested types). */
export interface CssField {
  name: string;
  type: CssFieldType;
  selector?: string;
  /** Required when type is "attribute". */
  attribute?: string;
  /** Required when type is "regex". Compiled server-side; ReDoS-screened. */
  pattern?: string;
  default?: unknown;
  transform?: "lowercase" | "uppercase" | "strip";
  /** Required (non-empty) for "nested" / "list" / "nested_list". Max depth 5. */
  fields?: CssField[];
}

/** Free CSS extraction pass run before any LLM escalation. */
export interface CssSchema {
  /** Matches the repeating container; one extracted record per match. */
  baseSelector: string;
  fields: CssField[];
  name?: string;
  /**
   * Top-level output-schema property the CSS records fill. Array property
   * receives the full list; scalar/object the first record. Inferred when
   * omitted and the schema has exactly one array property.
   */
  targetField?: string;
}

export interface DistillDiscoverFrom {
  url: string;
  /** Default "hybrid". */
  mode?: DiscoverMode;
  /** 1-50, default 10. Cap on URLs discovered AND distilled. */
  maxPages?: number;
}

export interface DistillOptions {
  /** Explicit URLs to distill (max 50). Exactly one of urls/discoverFrom. */
  urls?: string[];
  /** Discover a site's URLs first, then distill each. */
  discoverFrom?: DistillDiscoverFrom;
  /**
   * Required output shape: a JSON-Schema object
   * ({type: "object", properties: {...}}) or a flat {field: description}
   * map. The response data matches this shape.
   */
  schema: Record<string, unknown>;
  /** Optional free CSS pass; missing fields escalate to the LLM tier. */
  cssSchema?: CssSchema;
  waitFor?: string;
  /** 0-60000, default 30000. */
  waitTimeoutMs?: number;
  headers?: Record<string, string>;
  cookies?: BrowserCookie[];
  respectRobots?: boolean;
}

export type DistillExtractionTier = "css" | "llm" | "mixed" | "none";

export interface DistillItem {
  url: string;
  urlFinal?: string;
  status: "completed" | "failed";
  /** Extracted data matching the requested schema. */
  data?: Record<string, unknown>;
  extractionTier: DistillExtractionTier;
  fieldsFromCss: number;
  fieldsFromLlm: number;
  renderQuality?: number;
  tokens: V2Tokens;
  costCents: number;
  error?: string;
  warnings: string[];
}

export interface DistillResult {
  operationId: string;
  total: number;
  completed: number;
  failed: number;
  results: DistillItem[];
  totalCostCents: number;
  warnings: string[];
}

// ---------------------------------------------------------------------------
// Ingest
// ---------------------------------------------------------------------------

export type IngestMode = "urls" | "sitemap" | "crawl" | "files";

export type IngestStatus =
  | "queued"
  | "discovering"
  | "processing"
  | "completed"
  | "failed"
  | "canceled";

export interface IngestChunkOptions {
  /** Words per chunk, 32-4000, default 512. */
  maxWords?: number;
  /** Sentences repeated between consecutive chunks, 0-10, default 1. */
  sentenceOverlap?: number;
}

export interface IngestOptions {
  /** Default "urls". */
  mode?: IngestMode;
  /** Seed URL — required for "sitemap"/"crawl", forbidden for "urls". */
  url?: string;
  /** Explicit URLs (max 1000) — required for "urls", forbidden otherwise. */
  urls?: string[];
  /** Discovery cap for sitemap/crawl, 1-1000, default 50. */
  maxPages?: number;
  /** 1-5, default 2. */
  maxDepth?: number;
  /** Default true. */
  sameDomainOnly?: boolean;
  includePatterns?: string[];
  excludePatterns?: string[];
  respectRobots?: boolean;
  waitFor?: string;
  waitTimeoutMs?: number;
  chunk?: IngestChunkOptions;
  /** Completion webhook, HMAC-signed (see getWebhookSecret). */
  webhookUrl?: string;
}

/**
 * Options for `ingestFiles` (POST /v2/ingest/files). Uploaded documents are
 * converted to Markdown and chunked through the same pipeline as `ingest`.
 */
export interface IngestFilesOptions {
  /** Heading-aware chunker parameters. */
  chunk?: IngestChunkOptions;
  /** Completion webhook, HMAC-signed (see getWebhookSecret). */
  webhookUrl?: string;
}

export interface IngestJob {
  jobId: string;
  status: IngestStatus;
  mode: IngestMode;
  pagesDiscovered: number;
  pagesProcessed: number;
  pagesFailed: number;
  totalChunks: number;
  /** Signed URL to the final JSONL, once completed. */
  outputUrl?: string;
  errorMessage?: string;
  webhookUrl?: string;
  webhookDelivered: boolean;
  createdAt?: string;
  completedAt?: string;
  warnings: string[];
}

/** Compact job row from listIngestJobs (webhookUrl replaced by a flag). */
export interface IngestJobSummary {
  jobId: string;
  status: IngestStatus;
  mode: IngestMode;
  pagesDiscovered: number;
  pagesProcessed: number;
  pagesFailed: number;
  totalChunks: number;
  outputUrl?: string;
  errorMessage?: string;
  webhookConfigured: boolean;
  webhookDelivered: boolean;
  createdAt?: string;
  completedAt?: string;
}

export interface IngestJobList {
  jobs: IngestJobSummary[];
  skip: number;
  limit: number;
  hasMore: boolean;
}

export interface WebhookSecret {
  secret: string;
  /** Header carrying the HMAC signature, e.g. "X-Enconvert-Signature". */
  signatureHeader: string;
  timestampHeader: string;
  signatureScheme: string;
  replayToleranceSeconds: number;
  /** True when this response just replaced the previous secret. */
  rotated: boolean;
}

export interface WebhookRetryResult {
  jobId: string;
  delivered: boolean;
  attempts: number;
  /** HTTP status of the last attempt; undefined on network error. */
  statusCode?: number;
  detail: string;
}

// ---------------------------------------------------------------------------
// Watch
// ---------------------------------------------------------------------------

export type WatchDiffMode = "auto" | "text" | "structured" | "tables" | "metadata";

export type WatcherStatus = "active" | "paused" | "deleted";

export interface WatchCreateOptions {
  /** Minutes between checks, 60-43200 (hourly floor is hard). Default 60. */
  frequencyMinutes?: number;
  /** Default "auto" (diff engine picks by content type). */
  diffMode?: WatchDiffMode;
  /** Optional field/selector subset for the diff engine. */
  trackFields?: Record<string, unknown>;
  /** Change-notification webhook, HMAC-signed. */
  webhookUrl?: string;
  /** Email the project owner on changes. Default true. */
  notifyEmail?: boolean;
}

export interface WatcherUpdate {
  /** 60-43200. */
  frequencyMinutes?: number;
  diffMode?: WatchDiffMode;
  trackFields?: Record<string, unknown>;
  /** An empty string "" explicitly clears the webhook. */
  webhookUrl?: string;
  notifyEmail?: boolean;
  /** "active" or "paused". Deleting goes through deleteWatcher. */
  status?: "active" | "paused";
}

export interface Watcher {
  watcherId: string;
  url: string;
  status: WatcherStatus;
  frequencyMinutes: number;
  diffMode: WatchDiffMode;
  trackFields?: Record<string, unknown>;
  webhookUrl?: string;
  notifyEmail: boolean;
  consecutiveErrors: number;
  checksCount: number;
  lastCheckAt?: string;
  nextCheckAt?: string;
  lastChangeAt?: string;
  createdAt?: string;
  updatedAt?: string;
}

/** Compact watcher row from listWatchers. */
export interface WatcherSummary {
  watcherId: string;
  url: string;
  status: WatcherStatus;
  frequencyMinutes: number;
  checksCount: number;
  consecutiveErrors: number;
  lastCheckAt?: string;
  nextCheckAt?: string;
  lastChangeAt?: string;
  createdAt?: string;
}

export interface WatcherList {
  watchers: WatcherSummary[];
  skip: number;
  limit: number;
  hasMore: boolean;
}

export interface WatcherSnapshot {
  checkedAt: string;
  hasChanges: boolean;
  /** 0.0-1.0 similarity to the previous capture. */
  similarity?: number;
  renderQuality?: number;
  changeCount: number;
  /** Diff entries. Values are untrusted page content — escape before render. */
  changes: Record<string, unknown>[];
}

export interface WatcherSnapshotList {
  watcherId: string;
  snapshots: WatcherSnapshot[];
  limit: number;
}

// ---------------------------------------------------------------------------
// Shared list options
// ---------------------------------------------------------------------------

export interface V2ListOptions {
  /** Rows to skip (default 0). */
  skip?: number;
  /** Page size, 1-100 (default 20). */
  limit?: number;
}

export interface SnapshotListOptions {
  /** Page size, 1-100 (default 20). */
  limit?: number;
}
