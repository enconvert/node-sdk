# @enconvert/node-sdk

Honest eyes for your AI agent — the JavaScript / TypeScript SDK for [Enconvert](https://enconvert.com). Node 18+.

Read any web page or file into clean Markdown, JSON, or screenshots, and get a `render_quality` score (0.0–1.0) on **every** read — so a blocked, challenge, or empty-SPA page comes back flagged with a low score and warnings, never mistaken for real content. Perceive, discover, look up, distill, ingest, and watch the web; convert 40+ file and document formats through the same key.

> Wiring an agent (Claude, Cursor, Windsurf, n8n, …)? The [MCP server](https://enconvert.com/mcp) is the native path — `npx @enconvert/mcp setup`. This SDK is the programmatic REST path for everything else.

## Install

```bash
npm install @enconvert/node-sdk
```

## Quick Start

```ts
import { Enconvert } from "@enconvert/node-sdk";

const client = new Enconvert({ apiKey: "sk_..." });

// Read a page the way your agent should — with a quality score attached.
const op = await client.v2.perceive("https://example.com", {
  outputs: ["markdown", "structured"],
});
console.log(op.outputs.markdown.url, op.renderQuality); // e.g. 0.93
```

---

# V2 — agent-ready data (`client.v2`)

The V2 namespace turns web pages into agent-ready data: render, search, extract, ingest, and monitor. All V2 endpoints require a **private API key** and are plan-gated — a disabled feature or exhausted monthly quota throws `QuotaError` (HTTP 402).

Every render carries `renderQuality` (0.0–1.0). A low score means the page didn't render cleanly (challenge page, cookie wall, empty shell); the content is still returned, flagged, so a bad read never quietly enters your agent's context.

### Perceive — render a URL into artifacts

```ts
const op = await client.v2.perceive("https://example.com", {
  outputs: ["markdown", "screenshot", "structured"],
  extract: ["tables", "metadata"],
});
console.log(op.renderQuality);          // honesty score, 0.0–1.0
console.log(op.outputs.markdown.url);   // 15-min signed URL
console.log(op.structured);

// Re-sign artifact URLs later:
const again = await client.v2.getPerceiveOperation(op.operationId);

// Batch (<=1000 URLs; small batches run inline, larger return "queued" — poll):
const batch = await client.v2.perceiveBatch(["https://a.com", "https://b.com"], {
  outputs: ["markdown"],
  outputMode: "zip",
});
const done = await client.v2.getPerceiveBatch(batch.jobId);
```

### Discover — enumerate a site's URLs (no rendering)

```ts
const found = await client.v2.discover("https://example.com", {
  mode: "hybrid",              // "sitemap" | "crawl" | "hybrid"
  maxUrls: 200,
  excludePatterns: ["/tag/"],
});
console.log(found.total, found.urls);
```

### Lookup — web search with optional auto-perceive

```ts
const search = await client.v2.lookup("best static site generators", {
  category: "web",             // web | news | images | scholar | patents | maps
  numResults: 10,
  perceiveTop: 3,              // auto-render top 3 results (uses perceive quota)
});
for (const hit of search.results) console.log(hit.title, hit.url, hit.perceive?.renderQuality);
```

### Distill — schema-driven structured extraction

```ts
const extraction = await client.v2.distill({
  urls: ["https://example.com/pricing"],
  schema: { plans: "list of plan names with monthly prices" },
  cssSchema: {                 // optional free CSS pass before the LLM tier
    baseSelector: ".plan-card",
    fields: [
      { name: "name", type: "text", selector: "h3" },
      { name: "price", type: "text", selector: ".price" },
    ],
  },
});
console.log(extraction.results[0].data, extraction.results[0].extractionTier);

// Or discover-then-distill:
await client.v2.distill({
  discoverFrom: { url: "https://example.com", mode: "sitemap", maxPages: 10 },
  schema: { title: "page title", summary: "one-line summary" },
});
```

### Ingest — site or files to RAG-ready JSONL (always async)

Turn a whole site — or a set of uploaded documents — into chunked, RAG-ready JSONL through one pipeline.

```ts
// From a site:
const job = await client.v2.ingest({
  mode: "sitemap",
  url: "https://docs.example.com",
  maxPages: 100,
  chunk: { maxWords: 512, sentenceOverlap: 1 },
  webhookUrl: "https://my.app/hooks/enconvert",
});

// Or from uploaded files (PDF, DOCX, PPTX, XLSX, CSV, HTML, EPUB, TXT/MD, legacy/ODF office):
const fileJob = await client.v2.ingestFiles(["handbook.pdf", "notes.docx"], {
  chunk: { maxWords: 512, sentenceOverlap: 1 },
});

const status = await client.v2.getIngestJob(job.jobId);          // poll
if (status.status === "completed") console.log(status.outputUrl); // JSONL

await client.v2.listIngestJobs({ limit: 20 });
await client.v2.cancelIngestJob(job.jobId);                       // idempotent

// Webhook signing (HMAC):
const { secret, signatureHeader } = await client.v2.getWebhookSecret();
await client.v2.rotateWebhookSecret();                            // invalidates old secret
await client.v2.retryIngestWebhook(job.jobId);                    // re-deliver
```

### Watch — recurring change monitoring

```ts
const watcher = await client.v2.createWatcher("https://example.com/pricing", {
  frequencyMinutes: 60,        // hourly floor
  diffMode: "auto",            // auto | text | structured | tables | metadata
  webhookUrl: "https://my.app/hooks/changes",
  notifyEmail: true,
});

await client.v2.listWatchers();
await client.v2.getWatcher(watcher.watcherId);
await client.v2.getWatcherSnapshots(watcher.watcherId, { limit: 10 });
await client.v2.updateWatcher(watcher.watcherId, { status: "paused" });
await client.v2.updateWatcher(watcher.watcherId, { webhookUrl: "" }); // clears webhook
await client.v2.deleteWatcher(watcher.watcherId);                     // soft-delete, idempotent
```

### V2 error handling

```ts
import { QuotaError } from "@enconvert/node-sdk";

try {
  await client.v2.ingest({ mode: "sitemap", url: "https://example.com" });
} catch (e) {
  if (e instanceof QuotaError) console.error("Upgrade plan or wait for quota reset");
  else throw e;
}
```

---

# File conversion

The same key also converts 40+ formats. Two "anything → X" endpoints auto-detect the input; the format-specific endpoints below give you a validated, typed path.

### Anything to Markdown / PDF

```ts
// Any document → clean Markdown (a RAG-ingestion building block):
await client.convertToMarkdown("report.docx", { saveTo: "report.md" });
// PDF, DOCX, PPTX, XLSX, CSV, HTML, EPUB, TXT/MD, and legacy/ODF office. (Images not supported.)

// Almost anything → PDF:
await client.convertToPdf("slides.pptx", { saveTo: "slides.pdf" });
// office/ODF/Pages/Numbers/RTF/CSV, HTML, Markdown, text, images, SVG, EPUB, or a PDF passthrough.
// Only pdfOptions.grayscale is honored on this endpoint:
await client.convertToPdf("scan.pdf", { pdfOptions: { grayscale: true }, saveTo: "gray.pdf" });
```

### Image conversion

```ts
const result = await client.convertImage("photo.heic", {
  outputFormat: "webp",
  saveTo: "photo.webp",
});
```

Any pair among `jpeg`, `png`, `svg`, `heic`, `webp` — plus PDF rasterization (`pdf` → `jpeg`). Unsupported pairs throw before any request is made:

```ts
import { IMPLEMENTED_CONVERSIONS, validOutputsFor } from "@enconvert/node-sdk";
validOutputsFor("json");  // ["csv", "toml", "xml", "yaml"]
validOutputsFor("pdf");   // ["jpeg"]
```

### Document & data conversion

```ts
await client.convertDocument("report.docx", { saveTo: "report.pdf" });
await client.convertDocument("data.json", { outputFormat: "yaml", saveTo: "data.yaml" });
await client.convertDocument("notes.md", { outputFormat: "html", saveTo: "notes.html" });
```

Supported inputs: `doc`/`docx`, `xls`/`xlsx`, `ppt`/`pptx`, `odt`, `ods`, `odp`, `ots`, `pages`, `numbers`, `html`, `markdown`, `csv`, `json`, `xml`, `yaml`, `toml`. (EPUB → use `convertToPdf` / `convertToMarkdown`.)

| Input | Outputs |
|-------|---------|
| json | csv, toml, xml, yaml |
| xml | csv, json |
| yaml | json |
| csv | json, xml |
| toml | json |
| markdown | html, pdf |
| html | pdf |
| doc, excel, ppt, odt, ods, odp, ots, pages, numbers | pdf |
| jpeg, png, svg, heic, webp | each other (all 20 pairs) |
| pdf | jpeg |

### URL to PDF / Screenshot / Markdown

```ts
await client.convertUrlToPdf("https://example.com", { saveTo: "page.pdf" });
await client.convertUrlToScreenshot("https://example.com", { viewportWidth: 1440, saveTo: "shot.png" });
await client.convertUrlToMarkdown("https://example.com/article", { saveTo: "article.md" });
```

### Website to PDF / Screenshot (whole-site batch)

Discover every page of a website (sitemap, or full crawl on higher plans), convert each in the background, and receive a single ZIP. Requires a private API key with crawl access.

```ts
const batch = await client.convertWebsiteToPdf("https://example.com", { crawlMode: "sitemap" });
const status = await client.waitForBatch(batch.batchId, { saveTo: "site.zip" });
console.log(status.completed, "of", status.total, "pages converted");
```

### PDF options & authenticated pages

```ts
await client.convertUrlToPdf("https://internal.example.com/report", {
  pdfOptions: { pageSize: "A4", orientation: "landscape", margins: { top: 10, bottom: 10 } },
  auth: { username: "user", password: "pass" },     // or cookies / headers, plan-gated
  saveTo: "report.pdf",
});
```

Do not combine `auth` with an `Authorization` header — the API rejects the conflict.

### Job status (async polling)

```ts
const status = await client.getJobStatus("job_abc123");
if (status.status === "success") console.log(status.presignedUrl);
```

---

## Error Handling

```ts
import { Enconvert, AuthenticationError, RateLimitError, QuotaError, APIError } from "@enconvert/node-sdk";

try {
  await client.v2.perceive("https://example.com");
} catch (e) {
  if (e instanceof AuthenticationError) console.error("Invalid API key");
  else if (e instanceof QuotaError) console.error("Plan feature off or quota exhausted");
  else if (e instanceof RateLimitError) console.error("Too many requests — slow down");
  else if (e instanceof APIError) console.error(`API error [${e.statusCode}]: ${e.message}`);
  else throw e;
}
```

## Configuration

```ts
const client = new Enconvert({
  apiKey: "sk_...",
  timeout: 300_000, // ms, default
});
```

## Get an API Key

Sign up at [enconvert.com](https://enconvert.com). Free tier: 100 ops/month, no credit card.

## License

MIT
