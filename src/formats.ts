/**
 * Format tables mirroring the gateway's CONVERTER_MAP (api/v1/convert.py).
 *
 * IMPLEMENTED_CONVERSIONS is the client-side gate: the gateway returns 503
 * for any `{input}-to-{output}` endpoint not in its CONVERTER_MAP, so we
 * reject unsupported pairs here with a useful message instead of paying a
 * network round-trip for a guaranteed failure.
 */

/** The 43 implemented `{input}-to-{output}` conversion endpoints. */
export const IMPLEMENTED_CONVERSIONS: ReadonlySet<string> = new Set([
  // Structured text (13)
  "json-to-xml",
  "xml-to-json",
  "json-to-yaml",
  "yaml-to-json",
  "csv-to-json",
  "json-to-csv",
  "json-to-toml",
  "toml-to-json",
  "csv-to-xml",
  "xml-to-csv",
  "markdown-to-html",
  "markdown-to-pdf",
  "html-to-pdf",
  // Documents (9) — EPUB→PDF now flows through anything-to-pdf, not a dedicated pair.
  "doc-to-pdf",
  "excel-to-pdf",
  "ppt-to-pdf",
  "odt-to-pdf",
  "ods-to-pdf",
  "odp-to-pdf",
  "ots-to-pdf",
  "pages-to-pdf",
  "numbers-to-pdf",
  // Images (21)
  "jpeg-to-png",
  "png-to-jpeg",
  "jpeg-to-svg",
  "svg-to-jpeg",
  "jpeg-to-heic",
  "heic-to-jpeg",
  "jpeg-to-webp",
  "webp-to-jpeg",
  "png-to-svg",
  "svg-to-png",
  "png-to-heic",
  "heic-to-png",
  "png-to-webp",
  "webp-to-png",
  "svg-to-heic",
  "heic-to-svg",
  "svg-to-webp",
  "webp-to-svg",
  "heic-to-webp",
  "webp-to-heic",
  "pdf-to-jpeg",
]);

// Extension -> API format name (input side)
export const IMAGE_FORMATS: Record<string, string> = {
  ".jpg": "jpeg",
  ".jpeg": "jpeg",
  ".png": "png",
  ".svg": "svg",
  ".heic": "heic",
  ".webp": "webp",
  // PDF is an image input solely for pdf-to-jpeg (rasterization).
  ".pdf": "pdf",
};

export const DOCUMENT_FORMATS: Record<string, string> = {
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
  // .epub has no dedicated document pair — use convertToPdf / convertToMarkdown.
  ".md": "markdown",
  ".markdown": "markdown",
  ".csv": "csv",
  ".json": "json",
  ".xml": "xml",
  ".yaml": "yaml",
  ".yml": "yaml",
  ".toml": "toml",
};

export const MIME_BY_EXT: Record<string, string> = {
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".heic": "image/heic",
  ".heif": "image/heif",
  ".webp": "image/webp",
  ".gif": "image/gif",
  ".bmp": "image/bmp",
  ".tif": "image/tiff",
  ".tiff": "image/tiff",
  ".pdf": "application/pdf",
  ".doc": "application/msword",
  ".docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  ".xls": "application/vnd.ms-excel",
  ".xlsx": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  ".ppt": "application/vnd.ms-powerpoint",
  ".pptx": "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  ".rtf": "application/rtf",
  ".html": "text/html",
  ".htm": "text/html",
  ".xhtml": "application/xhtml+xml",
  ".odt": "application/vnd.oasis.opendocument.text",
  ".ods": "application/vnd.oasis.opendocument.spreadsheet",
  ".odp": "application/vnd.oasis.opendocument.presentation",
  ".ots": "application/vnd.oasis.opendocument.spreadsheet-template",
  ".pages": "application/vnd.apple.pages",
  ".numbers": "application/vnd.apple.numbers",
  ".epub": "application/epub+zip",
  ".md": "text/markdown",
  ".markdown": "text/markdown",
  ".mdown": "text/markdown",
  ".mkd": "text/markdown",
  ".txt": "text/plain",
  ".text": "text/plain",
  ".csv": "text/csv",
  ".json": "application/json",
  ".xml": "application/xml",
  ".yaml": "application/x-yaml",
  ".yml": "application/x-yaml",
  ".toml": "application/toml",
};

/**
 * Input extensions accepted by POST /v1/convert/compress-image. The output
 * keeps the input format, so there is no output format to choose.
 */
export const COMPRESS_IMAGE_EXTENSIONS: ReadonlySet<string> = new Set([
  ".png",
  ".jpg",
  ".jpeg",
  ".webp",
]);

/** The 22 input extensions accepted by POST /v1/convert/anything-to-markdown. */
export const ANYTHING_TO_MARKDOWN_EXTENSIONS: ReadonlySet<string> = new Set([
  ".csv",
  ".doc",
  ".docx",
  ".epub",
  ".htm",
  ".html",
  ".markdown",
  ".md",
  ".mdown",
  ".mkd",
  ".odp",
  ".ods",
  ".odt",
  ".pdf",
  ".ppt",
  ".pptx",
  ".rtf",
  ".text",
  ".txt",
  ".xhtml",
  ".xls",
  ".xlsx",
]);

/** The 36 input extensions accepted by POST /v1/convert/anything-to-pdf. */
export const ANYTHING_TO_PDF_EXTENSIONS: ReadonlySet<string> = new Set([
  ".bmp",
  ".csv",
  ".doc",
  ".docx",
  ".epub",
  ".gif",
  ".heic",
  ".heif",
  ".htm",
  ".html",
  ".jpeg",
  ".jpg",
  ".markdown",
  ".md",
  ".mdown",
  ".mkd",
  ".numbers",
  ".odp",
  ".ods",
  ".odt",
  ".ots",
  ".pages",
  ".pdf",
  ".png",
  ".ppt",
  ".pptx",
  ".rtf",
  ".svg",
  ".text",
  ".tif",
  ".tiff",
  ".txt",
  ".webp",
  ".xhtml",
  ".xls",
  ".xlsx",
]);

/**
 * Conversions that accept the optional `width` / `height` form fields.
 * svg-to-heic does not, so it is deliberately absent.
 */
export const SVG_SIZED_CONVERSIONS: ReadonlySet<string> = new Set([
  "svg-to-png",
  "svg-to-jpeg",
  "svg-to-webp",
]);

// Common aliases users pass that differ from the API's canonical format names.
const OUTPUT_FORMAT_ALIASES: Record<string, string> = {
  jpg: "jpeg",
  yml: "yaml",
  htm: "html",
  md: "markdown",
};

export function extOf(name: string): string {
  const i = name.lastIndexOf(".");
  return i === -1 ? "" : name.slice(i).toLowerCase();
}

export function mimeFor(name: string): string {
  return MIME_BY_EXT[extOf(name)] ?? "application/octet-stream";
}

/** Map a filename's extension to its API input format, or throw. */
export function resolveInputFormat(name: string, map: Record<string, string>): string {
  const ext = extOf(name);
  const fmt = map[ext];
  if (!fmt) {
    const supported = Array.from(new Set(Object.keys(map))).sort().join(", ");
    throw new Error(`Unsupported file extension '${ext}'. Supported: ${supported}`);
  }
  return fmt;
}

/**
 * Assert a filename's extension is accepted by a fixed-endpoint conversion
 * (compress-image, anything-to-markdown, anything-to-pdf), or throw with the
 * sorted list of extensions that endpoint accepts.
 */
export function assertExtensionAllowed(
  filename: string,
  allowed: ReadonlySet<string>,
  endpoint: string,
): void {
  const ext = extOf(filename);
  if (!allowed.has(ext)) {
    const supported = Array.from(allowed).sort().join(", ");
    throw new Error(
      `Unsupported file extension '${ext}' for '${endpoint}'. Supported: ${supported}`,
    );
  }
}

/** Lowercase, strip a leading dot, and resolve aliases (jpg, yml, htm, md). */
export function normalizeOutputFormat(fmt: string): string {
  const f = fmt.toLowerCase().replace(/^\./, "");
  return OUTPUT_FORMAT_ALIASES[f] ?? f;
}

/** List the output formats the API implements for a given input format. */
export function validOutputsFor(inputFormat: string): string[] {
  const prefix = `${inputFormat}-to-`;
  return Array.from(IMPLEMENTED_CONVERSIONS)
    .filter((name) => name.startsWith(prefix))
    .map((name) => name.slice(prefix.length))
    .sort();
}

/**
 * Assert `{input}-to-{output}` is an implemented endpoint and return its
 * name. Throws with the list of valid outputs for that input otherwise.
 */
export function assertConversionImplemented(inputFormat: string, outputFormat: string): string {
  const endpoint = `${inputFormat}-to-${outputFormat}`;
  if (!IMPLEMENTED_CONVERSIONS.has(endpoint)) {
    const outputs = validOutputsFor(inputFormat);
    const hint = outputs.length
      ? `Supported outputs for '${inputFormat}': ${outputs.join(", ")}`
      : `No conversions are available for input format '${inputFormat}'`;
    throw new Error(`Conversion '${inputFormat}' to '${outputFormat}' is not supported. ${hint}.`);
  }
  return endpoint;
}
