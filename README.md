# enconvert

JavaScript / TypeScript SDK for the [Enconvert](https://enconvert.com) file conversion API.

Convert URLs to PDFs, capture screenshots, extract Markdown, crawl whole websites, transform images, and convert documents — all with a single API call. Node 18+.

## Install

```bash
npm install @enconvert/node-sdk
```

## Quick Start

```ts
import { Enconvert } from "@enconvert/node-sdk";

const client = new Enconvert({ apiKey: "sk_..." });
```

### URL to PDF

```ts
const result = await client.convertUrlToPdf("https://example.com", {
  saveTo: "page.pdf",
});
console.log(result.presignedUrl);
```

### URL to Screenshot

```ts
const result = await client.convertUrlToScreenshot("https://example.com", {
  viewportWidth: 1440,
  saveTo: "screenshot.png",
});
```

### URL to Markdown

Extract clean GitHub-Flavored Markdown from any URL — strips nav/footer/ads/scripts, keeps the main article content, and adds YAML frontmatter (title, description, url, links, images).

```ts
const result = await client.convertUrlToMarkdown("https://example.com/article", {
  saveTo: "article.md",
});
```

### Website to PDF / Screenshot (whole-site batch)

Discover every page of a website (via sitemap, or full crawl on Pro/Business plans), convert each one in the background, and receive a single ZIP. Requires a private API key with crawl access.

```ts
const batch = await client.convertWebsiteToPdf("https://example.com", {
  crawlMode: "sitemap",            // "auto" (default) | "sitemap" | "full"
  excludePatterns: ["/blog/tag/"], // full crawl mode only
});
console.log(batch.batchId, batch.urlCount, batch.discoveryMethod);

// Block until done and save the ZIP:
const status = await client.waitForBatch(batch.batchId, { saveTo: "site.zip" });
console.log(status.completed, "of", status.total, "pages converted");

// Or poll yourself:
const s = await client.getBatchStatus(batch.batchId);
if (s.status !== "processing") console.log(s.zipDownloadUrl);
```

`convertWebsiteToScreenshot` works the same way and produces a ZIP of PNGs.

### Image Conversion

```ts
const result = await client.convertImage("photo.heic", {
  outputFormat: "webp",
  saveTo: "photo.webp",
});
```

Any pair among `jpeg`, `png`, `svg`, `heic`, `webp` — plus PDF rasterization:

```ts
await client.convertImage("scan.pdf", { outputFormat: "jpeg", saveTo: "scan.jpeg" });
```

### Document Conversion

```ts
await client.convertDocument("report.docx", { saveTo: "report.pdf" });
await client.convertDocument("data.json", { outputFormat: "yaml", saveTo: "data.yaml" });
await client.convertDocument("notes.md", { outputFormat: "html", saveTo: "notes.html" });
```

Supported inputs: `doc`/`docx`, `xls`/`xlsx`, `ppt`/`pptx`, `odt`, `ods`, `odp`, `ots`, `pages`, `numbers`, `epub`, `html`, `markdown`, `csv`, `json`, `xml`, `yaml`, `toml`

The SDK validates every `{input}-to-{output}` pair against the conversions the API actually implements and throws immediately — with the list of valid outputs for that input — instead of sending a doomed request. Introspect programmatically:

```ts
import { IMPLEMENTED_CONVERSIONS, validOutputsFor } from "@enconvert/node-sdk";

validOutputsFor("json");  // ["csv", "toml", "xml", "yaml"]
validOutputsFor("pdf");   // ["jpeg"]
```

### Supported conversions

| Input | Outputs |
|-------|---------|
| json | csv, toml, xml, yaml |
| xml | csv, json |
| yaml | json |
| csv | json, xml |
| toml | json |
| markdown | html, pdf |
| html | pdf |
| doc, excel, ppt, odt, ods, odp, ots, pages, numbers, epub | pdf |
| jpeg, png, svg, heic, webp | each other (all 20 pairs) |
| pdf | jpeg |

### Job Status (async polling)

```ts
const status = await client.getJobStatus("job_abc123");
if (status.status === "success") {
  console.log(status.presignedUrl);
}
```

## PDF Options

```ts
const result = await client.convertUrlToPdf("https://example.com", {
  pdfOptions: {
    pageSize: "A4",              // or custom dimensions via pageWidth + pageHeight
    orientation: "landscape",
    margins: { top: 10, bottom: 10, left: 15, right: 15 },
    header: { content: "Quarterly Report", height: 15 },
    footer: { content: "Confidential", height: 12 },
  },
  saveTo: "report.pdf",
});
```

## Authenticated Pages (plan-gated)

All URL and website conversions accept HTTP Basic Auth, cookies, and custom headers for pages behind a login:

```ts
await client.convertUrlToPdf("https://internal.example.com/report", {
  auth: { username: "user", password: "pass" },
  // or cookies / headers:
  cookies: [{ name: "session", value: "abc123", domain: "internal.example.com" }],
  headers: { "X-Tenant": "acme" },
  saveTo: "report.pdf",
});
```

Do not combine `auth` with an `Authorization` header — the API rejects the conflict.

## Error Handling

```ts
import { Enconvert, AuthenticationError, RateLimitError, APIError } from "@enconvert/node-sdk";

try {
  await client.convertUrlToPdf("https://example.com");
} catch (e) {
  if (e instanceof AuthenticationError) console.error("Invalid API key");
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

## V2 API (`client.v2`)

The V2 namespace turns web pages into agent-ready data: render, search, extract, ingest, and monitor. All V2 endpoints require a **private API key** and are plan-gated — a disabled feature or exhausted monthly quota throws `QuotaError` (HTTP 402).

### Perceive — render a URL into artifacts

```ts
const op = await client.v2.perceive("https://example.com", {
  outputs: ["markdown", "screenshot", "structured"],
  extract: ["tables", "metadata"],
});
console.log(op.outputs.markdown.url);   // 15-min signed URL
console.log(op.structured);

// Re-sign artifact URLs later:
const again = await client.v2.getPerceiveOperation(op.operationId);

// Batch (<=10 URLs runs inline; larger returns "queued" — poll):
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
for (const hit of search.results) console.log(hit.title, hit.url, hit.perceive?.outputs);
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

### Ingest — site to RAG-ready JSONL (always async)

```ts
const job = await client.v2.ingest({
  mode: "sitemap",
  url: "https://docs.example.com",
  maxPages: 100,
  chunk: { maxWords: 512, sentenceOverlap: 1 },
  webhookUrl: "https://my.app/hooks/enconvert",
});

const status = await client.v2.getIngestJob(job.jobId);   // poll
if (status.status === "completed") console.log(status.outputUrl); // JSONL

await client.v2.listIngestJobs({ limit: 20 });
await client.v2.cancelIngestJob(job.jobId);                // idempotent

// Webhook signing (HMAC):
const { secret, signatureHeader } = await client.v2.getWebhookSecret();
await client.v2.rotateWebhookSecret();                     // invalidates old secret
await client.v2.retryIngestWebhook(job.jobId);             // re-deliver
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
await client.v2.deleteWatcher(watcher.watcherId);          // soft-delete, idempotent
```

### V2 error handling

```ts
import { QuotaError } from "@enconvert/node-sdk";

try {
  await client.v2.ingest({ urls: ["https://example.com"] });
} catch (e) {
  if (e instanceof QuotaError) console.error("Upgrade plan or wait for quota reset");
  else throw e;
}
```

## Get an API Key

Sign up at [enconvert.com](https://enconvert.com) to get your API key.

## License

MIT
