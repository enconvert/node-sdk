/** Test the enconvert SDK end-to-end. Run with: npm run test:sdk */

import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { Buffer } from "node:buffer";

import { APIError, Enconvert } from "../src/index.js";

const client = new Enconvert({
  apiKey: "sk_Yyh9YYU_rFSu0d_O8ZRqlBaFUOMwlCyFedw4LvQeCx4",
  baseUrl: "http://localhost:8010",
});
const output = "test_output";
await mkdir(output, { recursive: true });

// -- URL to PDF --
console.log("1. URL -> PDF");
let result = await client.convertUrlToPdf("https://apple.com", { saveTo: join(output, "example.pdf") });
console.log(`   ${result.filename} (${result.fileSize} bytes)`);

console.log("2. URL -> PDF (A4 landscape)");
result = await client.convertUrlToPdf("https://apple.com", {
  pdfOptions: { pageSize: "A4", orientation: "landscape" },
  singlePage: false,
  saveTo: join(output, "example_a4.pdf"),
});
console.log(`   ${result.filename}`);

// -- URL to Screenshot --
console.log("3. URL -> Screenshot");
result = await client.convertUrlToScreenshot("https://apple.com", {
  saveTo: join(output, "example.png"),
});
console.log(`   ${result.filename} (${result.fileSize} bytes)`);

console.log("3b. URL -> Markdown");
result = await client.convertUrlToMarkdown("https://en.wikipedia.org/wiki/Markdown", {
  saveTo: join(output, "example.md"),
});
console.log(`   ${result.filename} (${result.fileSize} bytes)`);

// -- Image conversion --
// Minimal valid 1x1 red PNG (67 bytes, precomputed)
const ONE_PX_PNG = Buffer.from(
  "89504e470d0a1a0a0000000d49484452000000010000000108020000009077" +
    "53de0000000c4944415408996300010000050001a5f7eecc0000000049454e" +
    "44ae426082",
  "hex",
);
await writeFile(join(output, "test.png"), ONE_PX_PNG);

console.log("4. PNG -> JPEG");
result = await client.convertImage(join(output, "test.png"), {
  outputFormat: "jpeg",
  saveTo: join(output, "test.jpeg"),
});
console.log(`   ${result.filename} (${result.fileSize} bytes)`);

console.log("5. PNG -> WebP");
result = await client.convertImage(join(output, "test.png"), {
  outputFormat: "webp",
  saveTo: join(output, "test.webp"),
});
console.log(`   ${result.filename} (${result.fileSize} bytes)`);

// -- Document conversion --
await writeFile(join(output, "test.json"), '{"name": "enconvert", "version": "0.1.0"}');
await writeFile(join(output, "test.csv"), "name,format\nenconvert,pdf\ntest,png");
await writeFile(join(output, "test.html"), "<html><body><h1>Hello from Enconvert SDK</h1></body></html>");

console.log("6. JSON -> YAML");
await client.convertDocument(join(output, "test.json"), {
  outputFormat: "yaml",
  saveTo: join(output, "data.yaml"),
});
console.log(`   ${await readFile(join(output, "data.yaml"), "utf8")}`);

console.log("7. CSV -> JSON");
await client.convertDocument(join(output, "test.csv"), {
  outputFormat: "json",
  saveTo: join(output, "data.json"),
});
console.log(`   ${await readFile(join(output, "data.json"), "utf8")}`);

console.log("8. HTML -> PDF");
result = await client.convertDocument(join(output, "test.html"), {
  saveTo: join(output, "from_html.pdf"),
});
console.log(`   ${result.filename} (${result.fileSize} bytes)`);

// -- Job status --
console.log("9. Job status (fake ID)");
try {
  await client.getJobStatus("fake_job_123");
} catch (e) {
  if (e instanceof APIError) console.log(`   Correctly rejected: ${e.message}`);
  else throw e;
}

console.log("\nAll done. Check test_output/ for files.");
