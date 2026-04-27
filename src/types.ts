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

export interface PdfHeaderFooter {
  [key: string]: string;
}

export interface PdfOptions {
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

export interface UrlToPdfOptions {
  saveTo?: string;
  singlePage?: boolean;
  pdfOptions?: PdfOptions;
  viewportWidth?: number;
  viewportHeight?: number;
  loadMedia?: boolean;
  enableScroll?: boolean;
  outputFilename?: string;
}

export interface UrlToScreenshotOptions {
  saveTo?: string;
  viewportWidth?: number;
  viewportHeight?: number;
  loadMedia?: boolean;
  enableScroll?: boolean;
  outputFilename?: string;
}

export interface UrlToMarkdownOptions {
  saveTo?: string;
  viewportWidth?: number;
  viewportHeight?: number;
  loadMedia?: boolean;
  enableScroll?: boolean;
  outputFilename?: string;
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
