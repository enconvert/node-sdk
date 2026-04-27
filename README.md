# enconvert

JavaScript / TypeScript SDK for the [Enconvert](https://enconvert.com) file conversion API.

Convert URLs to PDFs, capture screenshots, transform images, and convert documents — all with a single API call. Node 18+.

## Install

```bash
npm install enconvert
```

## Quick Start

```ts
import { Enconvert } from "enconvert";

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

### Image Conversion

```ts
const result = await client.convertImage("photo.heic", {
  outputFormat: "webp",
  saveTo: "photo.webp",
});
```

Supported formats: `jpeg`, `png`, `svg`, `heic`, `webp`

### Document Conversion

```ts
await client.convertDocument("report.docx", { saveTo: "report.pdf" });
await client.convertDocument("data.json", { outputFormat: "yaml", saveTo: "data.yaml" });
```

Supported inputs: `doc`/`docx`, `xls`/`xlsx`, `ppt`/`pptx`, `html`, `odt`, `ods`, `odp`, `epub`, `markdown`, `csv`, `json`, `xml`, `yaml`, `toml`

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
    pageSize: "A4",
    orientation: "landscape",
    margins: { top: 10, bottom: 10, left: 15, right: 15 },
  },
  saveTo: "report.pdf",
});
```

## Error Handling

```ts
import { Enconvert, AuthenticationError, RateLimitError, APIError } from "enconvert";

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

## Get an API Key

Sign up at [enconvert.com](https://enconvert.com) to get your API key.

## License

MIT
