import {
  OPERATIONS,
  OPERATION_COUNT,
  NAMESPACES,
  type OperationId,
  type OperationDefinition,
} from "./generated/routes.js";
import {
  NAMESPACE_METHODS,
  METHOD_NAME_BY_OPERATION,
} from "./generated/namespaces.js";
import {
  ToolYourError,
  ToolYourQuotaError,
  type InvokeInput,
  type InvokeOptions,
  type ToolYourClient,
  type ToolYourClientOptions,
  type ToolYourEnvelope,
} from "./types.js";

export { ToolYourError, ToolYourQuotaError };
export type {
  ToolYourClient,
  ToolYourClientOptions,
  ToolYourEnvelope,
  InvokeInput,
  InvokeOptions,
};
export { OPERATIONS, OPERATION_COUNT, NAMESPACES, NAMESPACE_METHODS };
export type { OperationId };

const DEFAULT_BASE = "https://api.toolyour.com";

function resolveFetch(custom?: typeof fetch): typeof fetch {
  const f = custom ?? globalThis.fetch;
  if (!f) {
    throw new ToolYourError(
      "NETWORK_ERROR",
      "fetch is not available — pass fetch in ToolYourClientOptions (Node 18+ required)"
    );
  }
  return f;
}

function appendFile(
  form: FormData,
  field: string,
  file: unknown
): void {
  if (file == null) {
    throw new ToolYourError("VALIDATION_ERROR", `Missing file for field "${field}"`);
  }
  if (typeof Blob !== "undefined" && file instanceof Blob) {
    form.append(field, file);
    return;
  }
  if (typeof file === "object" && file !== null && "buffer" in file) {
    const buf = file as { buffer: ArrayBuffer; name?: string };
    const blob = new Blob([buf.buffer]);
    form.append(field, blob, buf.name ?? field);
    return;
  }
  throw new ToolYourError(
    "VALIDATION_ERROR",
    `Unsupported file type for "${field}" — use Blob, File, or { buffer, name? }`
  );
}

async function parseResponse<T>(
  res: Response,
  responseFormat?: string
): Promise<T> {
  if (res.status === 429) {
    let body: unknown;
    try {
      body = await res.json();
    } catch {
      /* ignore */
    }
    throw new ToolYourQuotaError("Monthly API quota exceeded", body);
  }

  if (!res.ok) {
    let body: unknown;
    const ct = res.headers.get("content-type") ?? "";
    try {
      body = ct.includes("json") ? await res.json() : await res.text();
    } catch {
      body = undefined;
    }
    throw new ToolYourError("HTTP_ERROR", `HTTP ${res.status}: ${res.statusText}`, {
      status: res.status,
      body,
    });
  }

  if (
    responseFormat === "rawText" ||
    (responseFormat === "binary" && !res.headers.get("content-type")?.includes("json"))
  ) {
    return (await res.text()) as T;
  }

  if (
    responseFormat === "binary" ||
    responseFormat === "zipBinary" ||
    responseFormat === "jsonFile"
  ) {
    const ct = res.headers.get("content-type") ?? "";
    if (ct.includes("json")) {
      return (await res.json()) as T;
    }
    const buf = await res.arrayBuffer();
    return buf as T;
  }

  const json = (await res.json()) as ToolYourEnvelope<T> | T;

  if (json && typeof json === "object" && "status" in json && json.status === false) {
    throw new ToolYourError(
      "API_ERROR",
      (json as ToolYourEnvelope).message ?? (json as ToolYourEnvelope).error ?? "API error",
      { body: json }
    );
  }

  if (json && typeof json === "object" && "result" in json) {
    return (json as ToolYourEnvelope<T>).result as T;
  }

  return json as T;
}

function createNamespaceProxy(client: ToolYourClient, namespace: string) {
  const methods = NAMESPACE_METHODS[namespace] ?? [];
  const target: Record<string, unknown> = {};

  for (const { operationId, methodName } of methods) {
    target[methodName] = (input: InvokeInput = {}, options?: InvokeOptions) =>
      client.invoke(operationId, input, options);
  }

  return new Proxy(target, {
    get(obj, prop) {
      if (prop in obj) return obj[prop as string];
      throw new ToolYourError(
        "UNKNOWN_OPERATION",
        `Unknown ${namespace} method: ${String(prop)}. Regenerate SDK after API changes.`
      );
    },
  });
}

export function createToolYourClient(
  options: ToolYourClientOptions
): ToolYourClient & Record<string, unknown> {
  const apiKey = options.apiKey?.trim();
  if (!apiKey) {
    throw new ToolYourError("VALIDATION_ERROR", "apiKey is required");
  }

  const baseUrl = (options.baseUrl ?? DEFAULT_BASE).replace(/\/$/, "");
  const fetchImpl = resolveFetch(options.fetch);

  const client: ToolYourClient = {
    async invoke<T>(
      operationId: string,
      input: InvokeInput = {},
      invokeOptions: InvokeOptions = {}
    ): Promise<T> {
      const op = OPERATIONS[operationId as OperationId] as OperationDefinition;
      if (!op) {
        throw new ToolYourError(
          "UNKNOWN_OPERATION",
          `Unknown operationId: ${operationId}. Run npm run sync:generate in @toolyour/sdk.`
        );
      }

      const url = new URL(op.path, `${baseUrl}/`);

      if (invokeOptions.delivery) {
        url.searchParams.set("delivery", invokeOptions.delivery);
      }
      if (invokeOptions.format) {
        url.searchParams.set("format", invokeOptions.format);
      }
      if (invokeOptions.query) {
        for (const [k, v] of Object.entries(invokeOptions.query)) {
          if (v !== undefined) url.searchParams.set(k, String(v));
        }
      }

      const headers: Record<string, string> = {};
      if (!op.noAuth) {
        headers["X-Api-Key"] = apiKey;
      }

      let body: BodyInit | undefined;

      if (op.method === "GET") {
        for (const q of op.queryParams ?? ["url"]) {
          if (input[q] !== undefined && input[q] !== null) {
            url.searchParams.set(q, String(input[q]));
          }
        }
      } else if (op.multipart) {
        const form = new FormData();
        const fileField = op.fileField ?? "file";
        const file = input[fileField] ?? input.file;
        appendFile(form, fileField, file);
        for (const [key, value] of Object.entries(input)) {
          if (key === fileField || key === "file") continue;
          if (value === undefined || value === null) continue;
          if (typeof value === "object") {
            form.append(key, JSON.stringify(value));
          } else {
            form.append(key, String(value));
          }
        }
        body = form;
      } else {
        headers["Content-Type"] = "application/json";
        body = JSON.stringify(input);
      }

      let res: Response;
      try {
        res = await fetchImpl(url.toString(), {
          method: op.method,
          headers,
          body,
          signal: invokeOptions.signal,
        });
      } catch (err) {
        throw new ToolYourError("NETWORK_ERROR", "Network request failed", {
          cause: err,
        });
      }

      return parseResponse<T>(res, op.responseFormat);
    },

    listOperations() {
      return Object.keys(OPERATIONS);
    },

    listNamespaces() {
      return [...NAMESPACES];
    },
  };

  const root = client as ToolYourClient & Record<string, unknown>;

  for (const ns of NAMESPACES) {
    root[ns] = createNamespaceProxy(client, ns);
  }

  root.invokeByName = (methodPath: string, input?: InvokeInput, opts?: InvokeOptions) => {
    const [ns, method] = methodPath.split(".");
    const proxy = root[ns] as Record<string, (i?: InvokeInput, o?: InvokeOptions) => Promise<unknown>>;
    if (!proxy?.[method]) {
      throw new ToolYourError("UNKNOWN_OPERATION", `Unknown method path: ${methodPath}`);
    }
    return proxy[method](input, opts);
  };

  root.getMethodName = (operationId: OperationId) =>
    METHOD_NAME_BY_OPERATION[operationId];

  return root;
}

/** Alias for createToolYourClient */
export const ToolYour = createToolYourClient;

export default createToolYourClient;
