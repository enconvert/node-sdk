/** Enconvert — JavaScript / TypeScript SDK for the Enconvert file conversion API. */

export { Enconvert } from "./client.js";
export {
  EnconvertError,
  APIError,
  AuthenticationError,
  RateLimitError,
} from "./errors.js";
export type {
  ClientOptions,
  ConversionResult,
  ConvertDocumentOptions,
  ConvertImageOptions,
  FileInput,
  JobStatus,
  JobStatusValue,
  PdfHeaderFooter,
  PdfMargins,
  PdfOptions,
  UrlToMarkdownOptions,
  UrlToPdfOptions,
  UrlToScreenshotOptions,
} from "./types.js";

export const VERSION = "0.0.1";
