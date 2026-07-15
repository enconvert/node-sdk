/**
 * V2 API namespace, reached as `client.v2`.
 *
 * One method per V2 endpoint (20 total across six groups: perceive,
 * discover, lookup, distill, ingest, watch). Options are camelCase and
 * serialized to the API's snake_case wire format; responses are mapped
 * back to camelCase. User-data payloads (schemas, extracted data, tracked
 * fields, diff changes) pass through untouched.
 *
 * All V2 endpoints require a private API key (public keys are rejected)
 * and are plan-gated: a disabled feature or exhausted monthly quota
 * raises QuotaError (HTTP 402).
 */

import { raiseForStatus, serializePdfOptions, toFilePart, type RequestFn } from "./internal.js";
import type { FileInput } from "./types.js";
import type {
  CssField,
  CssSchema,
  DiscoverOptions,
  DiscoverResult,
  DistillItem,
  DistillOptions,
  DistillResult,
  IngestFilesOptions,
  IngestJob,
  IngestJobList,
  IngestJobSummary,
  IngestOptions,
  LookupItem,
  LookupOptions,
  LookupResult,
  PerceiveBatchOptions,
  PerceiveBatchResult,
  PerceiveOptions,
  PerceiveResult,
  SnapshotListOptions,
  V2ListOptions,
  V2OutputArtifact,
  V2Tokens,
  Watcher,
  WatcherList,
  WatcherSnapshot,
  WatcherSnapshotList,
  WatcherSummary,
  WatcherUpdate,
  WatchCreateOptions,
  WebhookRetryResult,
  WebhookSecret,
} from "./v2-types.js";

export class EnconvertV2 {
  private readonly request: RequestFn;

  constructor(request: RequestFn) {
    this.request = request;
  }

  // ------------------------------------------------------------------
  // Perceive — render a URL into agent-ready artifacts
  // ------------------------------------------------------------------

  /**
   * Render one URL into the requested outputs (markdown, screenshots, PDF,
   * links, structured data, ...). Synchronous: returns the completed
   * operation with 15-minute signed artifact URLs.
   */
  async perceive(url: string, opts: PerceiveOptions = {}): Promise<PerceiveResult> {
    const body = serializePerceiveOptions(opts);
    body.url = url;
    return toPerceiveResult(await this.post("/v2/perceive", body));
  }

  /**
   * Re-fetch a perceive operation by id (`per_...`). Artifact URLs are
   * freshly re-signed on every call.
   */
  async getPerceiveOperation(operationId: string): Promise<PerceiveResult> {
    return toPerceiveResult(
      await this.get(`/v2/perceive/${encodeURIComponent(operationId)}`),
    );
  }

  /**
   * Perceive up to 1000 URLs with one shared options block. Small batches
   * run inline (completed result); larger ones return status "queued" —
   * poll getPerceiveBatch with the jobId.
   */
  async perceiveBatch(
    urls: string[],
    opts: PerceiveBatchOptions = {},
  ): Promise<PerceiveBatchResult> {
    const { outputMode, ...renderOpts } = opts;
    const body: Record<string, unknown> = {
      urls,
      options: serializePerceiveOptions(renderOpts),
    };
    if (outputMode !== undefined) body.output_mode = outputMode;
    return toPerceiveBatchResult(await this.post("/v2/perceive/batch", body));
  }

  /** Poll a perceive batch by jobId. Items fill in as URLs complete. */
  async getPerceiveBatch(jobId: string): Promise<PerceiveBatchResult> {
    return toPerceiveBatchResult(
      await this.get(`/v2/perceive/batch/${encodeURIComponent(jobId)}`),
    );
  }

  // ------------------------------------------------------------------
  // Discover — enumerate a site's URLs without rendering
  // ------------------------------------------------------------------

  /**
   * List a site's URLs via sitemap, HTTP crawl, or both. No browser
   * rendering — fast and does not consume perceive quota.
   */
  async discover(url: string, opts: DiscoverOptions = {}): Promise<DiscoverResult> {
    const body: Record<string, unknown> = { url };
    if (opts.mode !== undefined) body.mode = opts.mode;
    if (opts.maxUrls !== undefined) body.max_urls = opts.maxUrls;
    if (opts.maxDepth !== undefined) body.max_depth = opts.maxDepth;
    if (opts.includePatterns !== undefined) body.include_patterns = opts.includePatterns;
    if (opts.excludePatterns !== undefined) body.exclude_patterns = opts.excludePatterns;
    if (opts.sameDomainOnly !== undefined) body.same_domain_only = opts.sameDomainOnly;
    if (opts.respectRobots !== undefined) body.respect_robots = opts.respectRobots;
    return toDiscoverResult(await this.post("/v2/discover", body));
  }

  // ------------------------------------------------------------------
  // Lookup — web search with optional auto-perceive
  // ------------------------------------------------------------------

  /**
   * Run a categorized web search. With perceiveTop > 0, the top-N result
   * URLs are auto-perceived (each consumes one perceive-quota unit) and
   * carry their full PerceiveResult inline.
   */
  async lookup(query: string, opts: LookupOptions = {}): Promise<LookupResult> {
    const body: Record<string, unknown> = { query };
    if (opts.category !== undefined) body.category = opts.category;
    if (opts.country !== undefined) body.country = opts.country;
    if (opts.locale !== undefined) body.locale = opts.locale;
    if (opts.timeFilter !== undefined) body.time_filter = opts.timeFilter;
    if (opts.numResults !== undefined) body.num_results = opts.numResults;
    if (opts.page !== undefined) body.page = opts.page;
    if (opts.location !== undefined) body.location = opts.location;
    if (opts.autocorrect !== undefined) body.autocorrect = opts.autocorrect;
    if (opts.perceiveTop !== undefined) body.perceive_top = opts.perceiveTop;
    return toLookupResult(await this.post("/v2/lookup", body));
  }

  // ------------------------------------------------------------------
  // Distill — schema-driven structured extraction
  // ------------------------------------------------------------------

  /**
   * Extract structured data matching `schema` from explicit URLs or from
   * a discovered site. An optional cssSchema answers fields for free;
   * anything it misses escalates to the LLM tier (plan-gated).
   */
  async distill(opts: DistillOptions): Promise<DistillResult> {
    const hasUrls = Array.isArray(opts.urls) && opts.urls.length > 0;
    const hasDiscover = opts.discoverFrom !== undefined;
    if (hasUrls === hasDiscover) {
      throw new Error("distill: provide exactly one of 'urls' or 'discoverFrom'");
    }
    if (!opts.schema || typeof opts.schema !== "object") {
      throw new Error("distill: 'schema' is required and must be an object");
    }

    const body: Record<string, unknown> = { schema: opts.schema };
    if (hasUrls) body.urls = opts.urls;
    if (opts.discoverFrom) {
      const df: Record<string, unknown> = { url: opts.discoverFrom.url };
      if (opts.discoverFrom.mode !== undefined) df.mode = opts.discoverFrom.mode;
      if (opts.discoverFrom.maxPages !== undefined) df.max_pages = opts.discoverFrom.maxPages;
      body.discover_from = df;
    }
    if (opts.cssSchema !== undefined) body.css_schema = serializeCssSchema(opts.cssSchema);
    if (opts.waitFor !== undefined) body.wait_for = opts.waitFor;
    if (opts.waitTimeoutMs !== undefined) body.wait_timeout_ms = opts.waitTimeoutMs;
    if (opts.headers !== undefined) body.headers = opts.headers;
    if (opts.cookies !== undefined) body.cookies = opts.cookies;
    if (opts.respectRobots !== undefined) body.respect_robots = opts.respectRobots;
    return toDistillResult(await this.post("/v2/distill", body));
  }

  // ------------------------------------------------------------------
  // Ingest — site to RAG-ready JSONL chunks (always async)
  // ------------------------------------------------------------------

  /**
   * Start an ingest job: turn explicit URLs or a discovered site into
   * chunked, RAG-ready JSONL. Always asynchronous — returns the queued
   * job; poll getIngestJob or configure webhookUrl for completion.
   */
  async ingest(opts: IngestOptions): Promise<IngestJob> {
    const mode = opts.mode ?? "urls";
    if (mode === "urls") {
      if (!opts.urls?.length) throw new Error("ingest: mode 'urls' requires a non-empty 'urls' list");
      if (opts.url !== undefined) throw new Error("ingest: mode 'urls' does not accept 'url'");
    } else {
      if (!opts.url) throw new Error(`ingest: mode '${mode}' requires a seed 'url'`);
      if (opts.urls !== undefined) throw new Error(`ingest: mode '${mode}' does not accept 'urls'`);
    }

    const body: Record<string, unknown> = {};
    if (opts.mode !== undefined) body.mode = opts.mode;
    if (opts.url !== undefined) body.url = opts.url;
    if (opts.urls !== undefined) body.urls = opts.urls;
    if (opts.maxPages !== undefined) body.max_pages = opts.maxPages;
    if (opts.maxDepth !== undefined) body.max_depth = opts.maxDepth;
    if (opts.sameDomainOnly !== undefined) body.same_domain_only = opts.sameDomainOnly;
    if (opts.includePatterns !== undefined) body.include_patterns = opts.includePatterns;
    if (opts.excludePatterns !== undefined) body.exclude_patterns = opts.excludePatterns;
    if (opts.respectRobots !== undefined) body.respect_robots = opts.respectRobots;
    if (opts.waitFor !== undefined) body.wait_for = opts.waitFor;
    if (opts.waitTimeoutMs !== undefined) body.wait_timeout_ms = opts.waitTimeoutMs;
    if (opts.chunk !== undefined) {
      const chunk: Record<string, unknown> = {};
      if (opts.chunk.maxWords !== undefined) chunk.max_words = opts.chunk.maxWords;
      if (opts.chunk.sentenceOverlap !== undefined) {
        chunk.sentence_overlap = opts.chunk.sentenceOverlap;
      }
      body.chunk = chunk;
    }
    if (opts.webhookUrl !== undefined) body.webhook_url = opts.webhookUrl;
    return toIngestJob(await this.post("/v2/ingest", body));
  }

  /**
   * Ingest one or more uploaded FILES into RAG-ready JSONL chunks — the file
   * counterpart of ingest(), sharing the same job lifecycle (mode "files").
   * PDF, DOCX, PPTX, XLSX, CSV, HTML, EPUB, TXT/MD and legacy/ODF office are
   * accepted. Always asynchronous; poll getIngestJob or configure a webhook.
   */
  async ingestFiles(files: FileInput[], opts: IngestFilesOptions = {}): Promise<IngestJob> {
    if (!files?.length) throw new Error("ingestFiles: provide at least one file");
    const form = new FormData();
    for (const file of files) {
      const part = await toFilePart(file);
      form.append("files", new Blob([part.bytes], { type: part.contentType }), part.filename);
    }
    if (opts.chunk?.maxWords !== undefined) form.append("max_words", String(opts.chunk.maxWords));
    if (opts.chunk?.sentenceOverlap !== undefined) {
      form.append("sentence_overlap", String(opts.chunk.sentenceOverlap));
    }
    if (opts.webhookUrl !== undefined) form.append("webhook_url", opts.webhookUrl);
    const resp = await this.request("/v2/ingest/files", { method: "POST", body: form });
    await raiseForStatus(resp);
    return toIngestJob((await resp.json()) as Record<string, unknown>);
  }

  /** List ingest jobs, newest first. */
  async listIngestJobs(opts: V2ListOptions = {}): Promise<IngestJobList> {
    const d = await this.get(`/v2/ingest${listQuery(opts)}`);
    const jobs = Array.isArray(d.jobs) ? (d.jobs as Record<string, unknown>[]) : [];
    return {
      jobs: jobs.map(toIngestJobSummary),
      skip: num(d.skip),
      limit: num(d.limit, 20),
      hasMore: d.has_more === true,
    };
  }

  /** Get one ingest job by id (`ing_...`). */
  async getIngestJob(jobId: string): Promise<IngestJob> {
    return toIngestJob(await this.get(`/v2/ingest/${encodeURIComponent(jobId)}`));
  }

  /**
   * Cancel a queued/processing ingest job. Idempotent: canceling an
   * already-terminal job returns it unchanged.
   */
  async cancelIngestJob(jobId: string): Promise<IngestJob> {
    return toIngestJob(
      await this.json(`/v2/ingest/${encodeURIComponent(jobId)}`, { method: "DELETE" }),
    );
  }

  /**
   * Re-deliver the completion webhook of a completed job (409 if the job
   * is not completed, 400 if it has no webhook configured).
   */
  async retryIngestWebhook(jobId: string): Promise<WebhookRetryResult> {
    const d = await this.post(`/v2/ingest/${encodeURIComponent(jobId)}/retry-webhook`, undefined);
    return {
      jobId: str(d.job_id),
      delivered: d.delivered === true,
      attempts: num(d.attempts),
      statusCode: optNum(d.status_code),
      detail: str(d.detail),
    };
  }

  /**
   * Get (creating on first call) the project's webhook signing secret and
   * the header/scheme details needed to verify deliveries.
   */
  async getWebhookSecret(): Promise<WebhookSecret> {
    return toWebhookSecret(await this.get("/v2/ingest/webhook-secret"));
  }

  /**
   * Rotate the webhook signing secret. Signatures made with the previous
   * secret stop verifying immediately.
   */
  async rotateWebhookSecret(): Promise<WebhookSecret> {
    return toWebhookSecret(await this.post("/v2/ingest/webhook-secret/rotate", undefined));
  }

  // ------------------------------------------------------------------
  // Watch — recurring change monitoring
  // ------------------------------------------------------------------

  /**
   * Create a watcher that re-renders `url` on a fixed cadence (hourly
   * floor) and notifies on changes via email and/or webhook.
   */
  async createWatcher(url: string, opts: WatchCreateOptions = {}): Promise<Watcher> {
    const body: Record<string, unknown> = { url };
    if (opts.frequencyMinutes !== undefined) body.frequency_minutes = opts.frequencyMinutes;
    if (opts.diffMode !== undefined) body.diff_mode = opts.diffMode;
    if (opts.trackFields !== undefined) body.track_fields = opts.trackFields;
    if (opts.webhookUrl !== undefined) body.webhook_url = opts.webhookUrl;
    if (opts.notifyEmail !== undefined) body.notify_email = opts.notifyEmail;
    return toWatcher(await this.post("/v2/watch", body));
  }

  /** List watchers, newest first. */
  async listWatchers(opts: V2ListOptions = {}): Promise<WatcherList> {
    const d = await this.get(`/v2/watch${listQuery(opts)}`);
    const watchers = Array.isArray(d.watchers) ? (d.watchers as Record<string, unknown>[]) : [];
    return {
      watchers: watchers.map(toWatcherSummary),
      skip: num(d.skip),
      limit: num(d.limit, 20),
      hasMore: d.has_more === true,
    };
  }

  /** Get one watcher by id (`wat_...`). Deleted watchers read as 404. */
  async getWatcher(watcherId: string): Promise<Watcher> {
    return toWatcher(await this.get(`/v2/watch/${encodeURIComponent(watcherId)}`));
  }

  /** Page through a watcher's check history, newest first. */
  async getWatcherSnapshots(
    watcherId: string,
    opts: SnapshotListOptions = {},
  ): Promise<WatcherSnapshotList> {
    const query = opts.limit !== undefined ? `?limit=${opts.limit}` : "";
    const d = await this.get(
      `/v2/watch/${encodeURIComponent(watcherId)}/snapshots${query}`,
    );
    const snapshots = Array.isArray(d.snapshots) ? (d.snapshots as Record<string, unknown>[]) : [];
    return {
      watcherId: str(d.watcher_id),
      snapshots: snapshots.map(toWatcherSnapshot),
      limit: num(d.limit, 20),
    };
  }

  /**
   * Update a watcher. At least one field is required. Set webhookUrl to
   * "" to clear the webhook; resuming a paused watcher re-checks the
   * plan's watcher cap.
   */
  async updateWatcher(watcherId: string, updates: WatcherUpdate): Promise<Watcher> {
    const body: Record<string, unknown> = {};
    if (updates.frequencyMinutes !== undefined) body.frequency_minutes = updates.frequencyMinutes;
    if (updates.diffMode !== undefined) body.diff_mode = updates.diffMode;
    if (updates.trackFields !== undefined) body.track_fields = updates.trackFields;
    if (updates.webhookUrl !== undefined) body.webhook_url = updates.webhookUrl;
    if (updates.notifyEmail !== undefined) body.notify_email = updates.notifyEmail;
    if (updates.status !== undefined) body.status = updates.status;
    if (Object.keys(body).length === 0) {
      throw new Error("updateWatcher: provide at least one field to update");
    }
    return toWatcher(
      await this.json(`/v2/watch/${encodeURIComponent(watcherId)}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      }),
    );
  }

  /**
   * Soft-delete a watcher (idempotent). Returns the tombstoned watcher
   * with status "deleted".
   */
  async deleteWatcher(watcherId: string): Promise<Watcher> {
    return toWatcher(
      await this.json(`/v2/watch/${encodeURIComponent(watcherId)}`, { method: "DELETE" }),
    );
  }

  // ------------------------------------------------------------------
  // HTTP helpers
  // ------------------------------------------------------------------

  private async json(path: string, init: RequestInit): Promise<Record<string, unknown>> {
    const resp = await this.request(path, init);
    await raiseForStatus(resp);
    return (await resp.json()) as Record<string, unknown>;
  }

  private post(path: string, body: unknown): Promise<Record<string, unknown>> {
    return this.json(path, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  }

  private get(path: string): Promise<Record<string, unknown>> {
    return this.json(path, { method: "GET" });
  }
}

// ----------------------------------------------------------------------
// Request serializers
// ----------------------------------------------------------------------

function serializePerceiveOptions(o: PerceiveOptions): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  if (o.outputs !== undefined) out.outputs = o.outputs;
  if (o.extract !== undefined) out.extract = o.extract;
  if (o.schema !== undefined) out.schema = o.schema;
  if (o.waitFor !== undefined) out.wait_for = o.waitFor;
  if (o.waitTimeoutMs !== undefined) out.wait_timeout_ms = o.waitTimeoutMs;
  if (o.jsCode !== undefined) out.js_code = o.jsCode;
  if (o.viewport !== undefined) out.viewport = o.viewport;
  if (o.headers !== undefined) out.headers = o.headers;
  if (o.cookies !== undefined) out.cookies = o.cookies;
  if (o.auth !== undefined) out.auth = o.auth;
  if (o.proxyUrl !== undefined) out.proxy_url = o.proxyUrl;
  if (o.geolocation !== undefined) out.geolocation = o.geolocation;
  if (o.actionChain !== undefined) out.action_chain = o.actionChain;
  if (o.cacheMode !== undefined) out.cache_mode = o.cacheMode;
  if (o.pdfOptions !== undefined) out.pdf_options = serializePdfOptions(o.pdfOptions);
  if (o.blockResources !== undefined) out.block_resources = o.blockResources;
  if (o.respectRobots !== undefined) out.respect_robots = o.respectRobots;
  if (o.mobile !== undefined) out.mobile = o.mobile;
  return out;
}

function serializeCssField(f: CssField): Record<string, unknown> {
  const out: Record<string, unknown> = { name: f.name, type: f.type };
  if (f.selector !== undefined) out.selector = f.selector;
  if (f.attribute !== undefined) out.attribute = f.attribute;
  if (f.pattern !== undefined) out.pattern = f.pattern;
  if (f.default !== undefined) out.default = f.default;
  if (f.transform !== undefined) out.transform = f.transform;
  if (f.fields !== undefined) out.fields = f.fields.map(serializeCssField);
  return out;
}

function serializeCssSchema(s: CssSchema): Record<string, unknown> {
  const out: Record<string, unknown> = {
    baseSelector: s.baseSelector,
    fields: s.fields.map(serializeCssField),
  };
  if (s.name !== undefined) out.name = s.name;
  if (s.targetField !== undefined) out.target_field = s.targetField;
  return out;
}

// ----------------------------------------------------------------------
// Response mappers. Optional fields may be absent entirely
// (response_model_exclude_none) — every access is guarded.
// ----------------------------------------------------------------------

function str(v: unknown, fallback = ""): string {
  return typeof v === "string" ? v : fallback;
}

function optStr(v: unknown): string | undefined {
  return typeof v === "string" ? v : undefined;
}

function num(v: unknown, fallback = 0): number {
  return typeof v === "number" ? v : fallback;
}

function optNum(v: unknown): number | undefined {
  return typeof v === "number" ? v : undefined;
}

function strArr(v: unknown): string[] {
  return Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : [];
}

function optObj(v: unknown): Record<string, unknown> | undefined {
  return v && typeof v === "object" && !Array.isArray(v)
    ? (v as Record<string, unknown>)
    : undefined;
}

function toTokens(v: unknown): V2Tokens {
  const d = optObj(v);
  return { input: num(d?.input), output: num(d?.output) };
}

function toOutputArtifact(v: unknown): V2OutputArtifact {
  const d = optObj(v) ?? {};
  return {
    url: optStr(d.url),
    objectKey: str(d.object_key),
    sizeBytes: num(d.size_bytes),
    contentType: str(d.content_type, "application/octet-stream"),
    expiresIn: num(d.expires_in, 900),
  };
}

function toPerceiveResult(d: Record<string, unknown>): PerceiveResult {
  const rawOutputs = optObj(d.outputs) ?? {};
  const outputs: Record<string, V2OutputArtifact> = {};
  for (const [name, artifact] of Object.entries(rawOutputs)) {
    outputs[name] = toOutputArtifact(artifact);
  }
  return {
    operationId: str(d.operation_id),
    status: d.status as PerceiveResult["status"],
    url: str(d.url),
    urlFinal: optStr(d.url_final),
    contentHash: optStr(d.content_hash),
    renderQuality: optNum(d.render_quality),
    cacheHit: d.cache_hit === true,
    outputs,
    structured: optObj(d.structured),
    extractionTier: optStr(d.extraction_tier) as PerceiveResult["extractionTier"],
    tokens: toTokens(d.tokens),
    costCents: num(d.cost_cents),
    durationMs: optNum(d.duration_ms),
    error: optStr(d.error),
    warnings: strArr(d.warnings),
  };
}

function toPerceiveBatchResult(d: Record<string, unknown>): PerceiveBatchResult {
  const items = Array.isArray(d.items) ? (d.items as Record<string, unknown>[]) : [];
  return {
    jobId: str(d.job_id),
    status: d.status as PerceiveBatchResult["status"],
    outputMode: (optStr(d.output_mode) ?? "manifest") as PerceiveBatchResult["outputMode"],
    total: num(d.total),
    completed: num(d.completed),
    failed: num(d.failed),
    pending: num(d.pending),
    zip: d.zip !== undefined && d.zip !== null ? toOutputArtifact(d.zip) : undefined,
    items: items.map(toPerceiveResult),
    warnings: strArr(d.warnings),
  };
}

function toDiscoverResult(d: Record<string, unknown>): DiscoverResult {
  return {
    url: str(d.url),
    mode: d.mode as DiscoverResult["mode"],
    total: num(d.total),
    urls: strArr(d.urls),
    pagesCrawled: num(d.pages_crawled),
    truncated: d.truncated === true,
    robotsRespected: d.robots_respected === true,
    sources: (optObj(d.sources) ?? {}) as Record<string, number>,
    warnings: strArr(d.warnings),
  };
}

function toLookupItem(d: Record<string, unknown>): LookupItem {
  const perceive = optObj(d.perceive);
  return {
    title: optStr(d.title),
    url: optStr(d.url),
    snippet: optStr(d.snippet),
    position: optNum(d.position),
    source: optStr(d.source),
    date: optStr(d.date),
    imageUrl: optStr(d.image_url),
    thumbnailUrl: optStr(d.thumbnail_url),
    extra: optObj(d.extra) ?? {},
    perceive: perceive ? toPerceiveResult(perceive) : undefined,
  };
}

function toLookupResult(d: Record<string, unknown>): LookupResult {
  const results = Array.isArray(d.results) ? (d.results as Record<string, unknown>[]) : [];
  return {
    lookupId: optNum(d.lookup_id),
    query: str(d.query),
    category: d.category as LookupResult["category"],
    country: optStr(d.country),
    locale: optStr(d.locale),
    timeFilter: optStr(d.time_filter) as LookupResult["timeFilter"],
    total: num(d.total),
    results: results.map(toLookupItem),
    perceiveTop: num(d.perceive_top),
    perceiveOperationIds: strArr(d.perceive_operation_ids),
    answerBox: optObj(d.answer_box),
    knowledgeGraph: optObj(d.knowledge_graph),
    credits: optNum(d.credits),
    costCents: num(d.cost_cents),
    warnings: strArr(d.warnings),
  };
}

function toDistillItem(d: Record<string, unknown>): DistillItem {
  return {
    url: str(d.url),
    urlFinal: optStr(d.url_final),
    status: (optStr(d.status) ?? "completed") as DistillItem["status"],
    data: optObj(d.data),
    extractionTier: (optStr(d.extraction_tier) ?? "none") as DistillItem["extractionTier"],
    fieldsFromCss: num(d.fields_from_css),
    fieldsFromLlm: num(d.fields_from_llm),
    renderQuality: optNum(d.render_quality),
    tokens: toTokens(d.tokens),
    costCents: num(d.cost_cents),
    error: optStr(d.error),
    warnings: strArr(d.warnings),
  };
}

function toDistillResult(d: Record<string, unknown>): DistillResult {
  const results = Array.isArray(d.results) ? (d.results as Record<string, unknown>[]) : [];
  return {
    operationId: str(d.operation_id),
    total: num(d.total),
    completed: num(d.completed),
    failed: num(d.failed),
    results: results.map(toDistillItem),
    totalCostCents: num(d.total_cost_cents),
    warnings: strArr(d.warnings),
  };
}

function toIngestJob(d: Record<string, unknown>): IngestJob {
  return {
    jobId: str(d.job_id),
    status: d.status as IngestJob["status"],
    mode: d.mode as IngestJob["mode"],
    pagesDiscovered: num(d.pages_discovered),
    pagesProcessed: num(d.pages_processed),
    pagesFailed: num(d.pages_failed),
    totalChunks: num(d.total_chunks),
    outputUrl: optStr(d.output_url),
    errorMessage: optStr(d.error_message),
    webhookUrl: optStr(d.webhook_url),
    webhookDelivered: d.webhook_delivered === true,
    createdAt: optStr(d.created_at),
    completedAt: optStr(d.completed_at),
    warnings: strArr(d.warnings),
  };
}

function toIngestJobSummary(d: Record<string, unknown>): IngestJobSummary {
  return {
    jobId: str(d.job_id),
    status: d.status as IngestJobSummary["status"],
    mode: d.mode as IngestJobSummary["mode"],
    pagesDiscovered: num(d.pages_discovered),
    pagesProcessed: num(d.pages_processed),
    pagesFailed: num(d.pages_failed),
    totalChunks: num(d.total_chunks),
    outputUrl: optStr(d.output_url),
    errorMessage: optStr(d.error_message),
    webhookConfigured: d.webhook_configured === true,
    webhookDelivered: d.webhook_delivered === true,
    createdAt: optStr(d.created_at),
    completedAt: optStr(d.completed_at),
  };
}

function toWebhookSecret(d: Record<string, unknown>): WebhookSecret {
  return {
    secret: str(d.secret),
    signatureHeader: str(d.signature_header),
    timestampHeader: str(d.timestamp_header),
    signatureScheme: str(d.signature_scheme),
    replayToleranceSeconds: num(d.replay_tolerance_seconds),
    rotated: d.rotated === true,
  };
}

function toWatcher(d: Record<string, unknown>): Watcher {
  return {
    watcherId: str(d.watcher_id),
    url: str(d.url),
    status: d.status as Watcher["status"],
    frequencyMinutes: num(d.frequency_minutes),
    diffMode: d.diff_mode as Watcher["diffMode"],
    trackFields: optObj(d.track_fields),
    webhookUrl: optStr(d.webhook_url),
    notifyEmail: d.notify_email !== false,
    consecutiveErrors: num(d.consecutive_errors),
    checksCount: num(d.checks_count),
    lastCheckAt: optStr(d.last_check_at),
    nextCheckAt: optStr(d.next_check_at),
    lastChangeAt: optStr(d.last_change_at),
    createdAt: optStr(d.created_at),
    updatedAt: optStr(d.updated_at),
  };
}

function toWatcherSummary(d: Record<string, unknown>): WatcherSummary {
  return {
    watcherId: str(d.watcher_id),
    url: str(d.url),
    status: d.status as WatcherSummary["status"],
    frequencyMinutes: num(d.frequency_minutes),
    checksCount: num(d.checks_count),
    consecutiveErrors: num(d.consecutive_errors),
    lastCheckAt: optStr(d.last_check_at),
    nextCheckAt: optStr(d.next_check_at),
    lastChangeAt: optStr(d.last_change_at),
    createdAt: optStr(d.created_at),
  };
}

function toWatcherSnapshot(d: Record<string, unknown>): WatcherSnapshot {
  const changes = Array.isArray(d.changes)
    ? d.changes.filter((c): c is Record<string, unknown> => !!optObj(c))
    : [];
  return {
    checkedAt: str(d.checked_at),
    hasChanges: d.has_changes === true,
    similarity: optNum(d.similarity),
    renderQuality: optNum(d.render_quality),
    changeCount: num(d.change_count),
    changes,
  };
}

function listQuery(opts: V2ListOptions): string {
  const params = new URLSearchParams();
  if (opts.skip !== undefined) params.set("skip", String(opts.skip));
  if (opts.limit !== undefined) params.set("limit", String(opts.limit));
  const qs = params.toString();
  return qs ? `?${qs}` : "";
}
