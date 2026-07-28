import { describe, expect, it, vi } from "vitest";
import { createToolYourClient, ToolYourError } from "../src/client.js";
import { OPERATION_COUNT } from "../src/generated/routes.js";

describe("createToolYourClient", () => {
  it("requires apiKey", () => {
    expect(() => createToolYourClient({ apiKey: "" })).toThrow(ToolYourError);
  });

  it("exposes generated operation count", () => {
    expect(OPERATION_COUNT).toBeGreaterThan(200);
  });

  it("calls SEO GET with url query and API key", async () => {
    const fetchMock = vi.fn(async () =>
      Response.json({
        status: true,
        result: { title: "Example" },
      })
    );

    const client = createToolYourClient({
      apiKey: "ty_test_key",
      fetch: fetchMock as typeof fetch,
    });

    await client.seo.metaTagsAnalyzer({ url: "https://example.com" });

    expect(fetchMock).toHaveBeenCalledOnce();
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toContain("/api/v1/seo-apis/meta-tags-analyzer");
    expect(url).toContain("url=https%3A%2F%2Fexample.com");
    expect(init.method).toBe("GET");
    expect((init.headers as Record<string, string>)["X-Api-Key"]).toBe("ty_test_key");
  });

  it("POSTs JSON for text utilities", async () => {
    const fetchMock = vi.fn(async () =>
      Response.json({ status: true, result: { slug: "hello-world" } })
    );

    const client = createToolYourClient({
      apiKey: "ty_test_key",
      fetch: fetchMock as typeof fetch,
    });

    await client.text.convertToSlug({ text: "Hello World" });

    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(init.method).toBe("POST");
    expect(JSON.parse(init.body as string)).toEqual({ text: "Hello World" });
  });

  it("throws on unknown operationId", async () => {
    const client = createToolYourClient({
      apiKey: "ty_test_key",
      fetch: vi.fn() as typeof fetch,
    });
    await expect(client.invoke("not_a_real_tool")).rejects.toMatchObject({
      code: "UNKNOWN_OPERATION",
    });
  });
});
