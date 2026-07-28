export type ToolYourErrorCode =
  | "UNKNOWN_OPERATION"
  | "HTTP_ERROR"
  | "API_ERROR"
  | "QUOTA_EXCEEDED"
  | "VALIDATION_ERROR"
  | "NETWORK_ERROR";

export class ToolYourError extends Error {
  readonly code: ToolYourErrorCode;
  readonly status?: number;
  readonly body?: unknown;

  constructor(
    code: ToolYourErrorCode,
    message: string,
    options?: { status?: number; body?: unknown; cause?: unknown }
  ) {
    super(message, { cause: options?.cause });
    this.name = "ToolYourError";
    this.code = code;
    this.status = options?.status;
    this.body = options?.body;
  }
}

export class ToolYourQuotaError extends ToolYourError {
  constructor(message = "Monthly API quota exceeded", body?: unknown) {
    super("QUOTA_EXCEEDED", message, { status: 429, body });
    this.name = "ToolYourQuotaError";
  }
}

/** Standard ToolYour JSON envelope (Node/Python tools). */
export interface ToolYourEnvelope<T = unknown> {
  status?: boolean;
  code?: number;
  message?: string;
  result?: T;
  error?: string;
}

export type DeliveryMode = "url" | "binary";

export interface InvokeOptions {
  /** Multipart converters: presigned URL (default) vs legacy binary stream */
  delivery?: DeliveryMode;
  /** SEO/security GET tools: markdown or raw json export */
  format?: "markdown" | "json";
  /** Extra query string parameters */
  query?: Record<string, string | number | boolean | undefined>;
  /** AbortSignal for fetch */
  signal?: AbortSignal;
}

export type InvokeInput = Record<string, unknown>;

export interface ToolYourClientOptions {
  /** ToolYour API key (`ty_...`) */
  apiKey: string;
  /** Default: https://api.toolyour.com */
  baseUrl?: string;
  /** Custom fetch (Node 18+ global fetch by default) */
  fetch?: typeof fetch;
}

export interface ToolYourClient {
  invoke<T = unknown>(
    operationId: string,
    input?: InvokeInput,
    options?: InvokeOptions
  ): Promise<T>;
  listOperations(): string[];
  listNamespaces(): string[];
}
