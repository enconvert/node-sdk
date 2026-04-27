/** Enconvert SDK response and option types. */
interface ConversionResult {
    presignedUrl: string;
    objectKey: string;
    filename: string;
    fileSize?: number;
    conversionTimeSeconds?: number;
    jobId?: string;
}
type JobStatusValue = "processing" | "success" | "failed";
interface JobStatus {
    status: JobStatusValue;
    presignedUrl?: string;
    objectKey?: string;
    error?: string;
}
interface PdfMargins {
    top?: number;
    bottom?: number;
    left?: number;
    right?: number;
}
interface PdfHeaderFooter {
    [key: string]: string;
}
interface PdfOptions {
    pageSize?: string;
    orientation?: "portrait" | "landscape";
    margins?: PdfMargins;
    scale?: number;
    grayscale?: boolean;
    header?: PdfHeaderFooter;
    footer?: PdfHeaderFooter;
}
/**
 * File input accepted by convertImage / convertDocument.
 *
 * - Pass a string path: `"./photo.heic"`.
 * - Pass raw bytes as `Uint8Array` or Node `Buffer`.
 * - For raw bytes with an explicit filename, wrap as `{ data, filename, contentType? }`.
 */
type FileInput = string | Uint8Array | {
    data: Uint8Array;
    filename: string;
    contentType?: string;
};
interface ClientOptions {
    apiKey: string;
    /** Request timeout in milliseconds. Defaults to 300_000 (5 minutes). */
    timeout?: number;
    /** Override the API base URL. Defaults to https://api.enconvert.com */
    baseUrl?: string;
}
interface UrlToPdfOptions {
    saveTo?: string;
    singlePage?: boolean;
    pdfOptions?: PdfOptions;
    viewportWidth?: number;
    viewportHeight?: number;
    loadMedia?: boolean;
    enableScroll?: boolean;
    outputFilename?: string;
}
interface UrlToScreenshotOptions {
    saveTo?: string;
    viewportWidth?: number;
    viewportHeight?: number;
    loadMedia?: boolean;
    enableScroll?: boolean;
    outputFilename?: string;
}
interface UrlToMarkdownOptions {
    saveTo?: string;
    viewportWidth?: number;
    viewportHeight?: number;
    loadMedia?: boolean;
    enableScroll?: boolean;
    outputFilename?: string;
}
interface ConvertImageOptions {
    outputFormat: string;
    saveTo?: string;
    outputFilename?: string;
}
interface ConvertDocumentOptions {
    outputFormat?: string;
    saveTo?: string;
    outputFilename?: string;
    pdfOptions?: PdfOptions;
}

/** Enconvert API client. Node 18+ only. */

/**
 * Enconvert file conversion client (Node 18+).
 *
 * @example
 *   import { Enconvert } from "enconvert";
 *   const client = new Enconvert({ apiKey: "sk_..." });
 *   const result = await client.convertUrlToPdf("https://example.com");
 *   console.log(result.presignedUrl);
 */
declare class Enconvert {
    private readonly apiKey;
    private readonly baseUrl;
    private readonly timeout;
    constructor(opts: ClientOptions);
    /** Convert a URL to PDF. */
    convertUrlToPdf(url: string, opts?: UrlToPdfOptions): Promise<ConversionResult>;
    /** Convert a URL to a PNG screenshot. */
    convertUrlToScreenshot(url: string, opts?: UrlToScreenshotOptions): Promise<ConversionResult>;
    /**
     * Convert a URL to clean GitHub-Flavored Markdown with YAML frontmatter
     * (title, description, url, links, images). Strips nav/footer/ads/scripts
     * and extracts the main article content.
     */
    convertUrlToMarkdown(url: string, opts?: UrlToMarkdownOptions): Promise<ConversionResult>;
    /** Convert an image between formats (jpeg, png, svg, heic, webp). */
    convertImage(file: FileInput, opts: ConvertImageOptions): Promise<ConversionResult>;
    /**
     * Convert a document (doc, excel, ppt, html, epub, markdown, csv, json,
     * xml, yaml, toml).
     */
    convertDocument(file: FileInput, opts?: ConvertDocumentOptions): Promise<ConversionResult>;
    /** Poll the status of an async conversion job. */
    getJobStatus(jobId: string): Promise<JobStatus>;
    private postJson;
    private postFile;
    /** Poll job status until success/failure. Used as fallback when the HTTP request fails. */
    private pollJob;
    /** Save a presigned URL to a local file. Streams the response to disk. */
    private download;
    /** Convert a `FileInput` into a normalized `{ bytes, filename, contentType }`. */
    private toFilePart;
    /** Centralized fetch with API key + timeout. */
    private fetch;
}

/** Enconvert SDK exceptions. */
declare class EnconvertError extends Error {
    constructor(message: string);
}
declare class APIError extends EnconvertError {
    readonly statusCode: number;
    constructor(statusCode: number, message: string);
}
declare class AuthenticationError extends APIError {
    constructor(message?: string);
}
declare class RateLimitError extends APIError {
    constructor(message?: string);
}

/** Enconvert — JavaScript / TypeScript SDK for the Enconvert file conversion API. */

declare const VERSION = "0.2.0";

export { APIError, AuthenticationError, type ClientOptions, type ConversionResult, type ConvertDocumentOptions, type ConvertImageOptions, Enconvert, EnconvertError, type FileInput, type JobStatus, type JobStatusValue, type PdfHeaderFooter, type PdfMargins, type PdfOptions, RateLimitError, type UrlToMarkdownOptions, type UrlToPdfOptions, type UrlToScreenshotOptions, VERSION };
