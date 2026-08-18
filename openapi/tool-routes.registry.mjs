/**
 * Customer-facing tool API routes for OpenAPI generation.
 * Keep in sync with toolyour-apis routes and toolyour-py-apis modules.
 */

/** @typedef {{ method: string, path: string, summary: string, operationId: string, multipart?: boolean, fileField?: string, jsonBody?: boolean, noAuth?: boolean, responseFormat?: 'binary' | 'rawJson' | 'rawText' | 'jsonFile' | 'zipBinary' | 'extract' | 'pythonEnvelope' | 'nodeEnvelope' | 'nodeEnvelope201' | 'supportedConversionsFlat' | 'tempFileUrl', queryParams?: { name: string, required?: boolean, description?: string, schema?: object }[] }} StaticRoute */

const DELIVERY_QUERY_PARAMS = [{
  name: "delivery",
  required: false,
  description:
    "Response delivery mode. Default returns JSON with a presigned `downloadUrl`. " +
    "Legacy `binary` returns file bytes directly (deprecated; includes Deprecation/Sunset headers during grace period).",
  schema: { type: "string", enum: ["url", "binary"], default: "url" },
}];

/** Shared SEO report export mode (not a separate catalog tool). */
const SEO_EXPORT_FORMAT_PARAM = {
  name: "format",
  required: false,
  description:
    "Optional export mode. Omit for the standard JSON envelope. " +
    "`markdown` returns text/markdown assembled from scores + findings (agent brief template, not AI prose). " +
    "`json` returns pretty-printed toolResult JSON without the envelope wrapper.",
  schema: { type: "string", enum: ["markdown", "json"] },
};

/** @param {StaticRoute} route */
function withSeoExportFormat(route) {
  const existing = Array.isArray(route.queryParams) ? route.queryParams : [];
  if (existing.some((p) => p.name === "format")) return route;
  return { ...route, queryParams: [...existing, SEO_EXPORT_FORMAT_PARAM] };
}

const NODE_TEMP_FILE_EXCLUSIONS = new Set([
  "imageToBase64",
  "imageMetadata",
  "csvToJson",
]);

/** @param {StaticRoute} route */
function withTempFileDelivery(route) {
  if (route.responseFormat === "tempFileUrl" || NODE_TEMP_FILE_EXCLUSIONS.has(route.operationId)) {
    return route;
  }
  if (route.responseFormat && route.responseFormat !== "binary") {
    return route;
  }
  if (!route.multipart) {
    return route;
  }
  return {
    ...route,
    responseFormat: "tempFileUrl",
    queryParams: DELIVERY_QUERY_PARAMS,
  };
}

const JSON_FILE_SLUGS = new Set([
  "xls-to-json", "xlsx-to-json", "ods-to-json",
  "html-to-json", "xml-to-json", "csv-to-json",
]);

/** @param {string[]} slugs @returns {StaticRoute[]} */
function pythonFileSlugs(slugs) {
  return slugs.map((slug) => {
    let responseFormat = "tempFileUrl";
    if (slug === "pptx-to-images") responseFormat = "zipBinary";
    else if (JSON_FILE_SLUGS.has(slug)) responseFormat = "jsonFile";

    /** @type {StaticRoute} */
    const route = {
      method: "post",
      path: `/${slug}`,
      summary: slug.replace(/-/g, " "),
      operationId: slug.replace(/-/g, "_"),
      multipart: true,
      fileField: "file",
      responseFormat,
    };
    if (responseFormat === "tempFileUrl") {
      route.queryParams = DELIVERY_QUERY_PARAMS;
    }
    return route;
  });
}

/** @param {string} moduleId @returns {StaticRoute} */
function supportedConversionsRoute(moduleId) {
  return {
    method: "get",
    path: "/supported-conversions",
    summary: "List supported conversions",
    operationId: `${moduleId}_supported_conversions`,
    responseFormat: "supportedConversionsFlat",
  };
}

/** @typedef {{ tag: string, tagDescription: string, basePath: string, catalog?: boolean, slugPost?: boolean, slugs?: string[], routes?: StaticRoute[] }} ToolGroup */

/** @type {ToolGroup[]} */
export const toolGroups = [
  {
    tag: "Convertors",
    tagDescription: "Image and CSV conversion",
    basePath: "/api/v1/convertors",
    routes: [
      { method: "post", path: "/to-jpg", summary: "Convert image to JPG", operationId: "convertToJpg", multipart: true, fileField: "image", responseFormat: "tempFileUrl", queryParams: DELIVERY_QUERY_PARAMS },
      { method: "post", path: "/to-png", summary: "Convert image to PNG", operationId: "convertToPng", multipart: true, fileField: "image" },
      { method: "post", path: "/to-webp", summary: "Convert image to WebP", operationId: "convertToWebp", multipart: true, fileField: "image" },
      { method: "post", path: "/to-svg", summary: "Convert image to SVG", operationId: "convertToSvg", multipart: true, fileField: "image" },
      { method: "post", path: "/to-avif", summary: "Convert image to AVIF", operationId: "convertToAvif", multipart: true, fileField: "image" },
      { method: "post", path: "/to-heic", summary: "Convert image to HEIC", operationId: "convertToHeic", multipart: true, fileField: "image" },
      { method: "post", path: "/to-heif", summary: "Convert image to HEIF", operationId: "convertToHeif", multipart: true, fileField: "image" },
      { method: "post", path: "/to-tiff", summary: "Convert image to TIFF", operationId: "convertToTiff", multipart: true, fileField: "image" },
      { method: "post", path: "/to-gif", summary: "Convert image to GIF", operationId: "convertToGif", multipart: true, fileField: "image" },
      { method: "post", path: "/compress-image", summary: "Compress image", operationId: "compressImage", multipart: true, fileField: "image" },
      { method: "post", path: "/compress-svg", summary: "Compress SVG", operationId: "compressSvg", multipart: true, fileField: "image" },
      { method: "post", path: "/to-grayscale", summary: "Convert image to grayscale", operationId: "convertToGrayscale", multipart: true, fileField: "image" },
      { method: "post", path: "/to-base64", summary: "Image to Base64", operationId: "imageToBase64", multipart: true, fileField: "image", responseFormat: "rawText" },
      { method: "post", path: "/image-to-pdf", summary: "Convert image to PDF", operationId: "imageToPdf", multipart: true, fileField: "image" },
      { method: "post", path: "/image-metadata", summary: "Read image metadata", operationId: "imageMetadata", multipart: true, fileField: "image", responseFormat: "rawJson" },
      { method: "post", path: "/csv-2-json", summary: "Convert CSV to JSON", operationId: "csvToJson", multipart: true, fileField: "csvFile", responseFormat: "rawJson" },
      { method: "post", path: "/json-2-csv", summary: "Convert JSON to CSV", operationId: "jsonToCsv", multipart: true, fileField: "jsonFile" },
      { method: "post", path: "/folder-to-zip", summary: "Pack files or URLs into a ZIP", operationId: "folderToZip", multipart: true, fileField: "files" },
      { method: "post", path: "/zip-extract", summary: "Extract a ZIP into downloadable files", operationId: "zipExtract", multipart: true, fileField: "file", responseFormat: "nodeEnvelope" },
    ].map(withTempFileDelivery),
  },
  {
    tag: "Documents",
    tagDescription: "Document conversion — POST multipart file",
    basePath: "/api/v1/documents",
    routes: [
      "docx-to-pdf", "docx-to-txt", "txt-to-pdf", "docx-to-html", "pdf-to-txt",
      "docx-to-rtf", "pdf-to-rtf", "txt-to-rtf", "rtf-to-txt", "txt-to-md",
      "rtf-to-pdf", "md-to-pdf", "md-to-txt", "md-to-html", "pdf-to-html",
      "txt-to-html", "rtf-to-html", "html-to-pdf", "html-to-txt", "html-to-md",
      "txt-to-docx", "pdf-to-docx", "rtf-to-docx", "md-to-docx", "html-to-docx",
    ].flatMap((slug) => pythonFileSlugs([slug])).concat([supportedConversionsRoute("documents")]),
  },
  {
    tag: "Office",
    tagDescription: "Spreadsheet and presentation conversion",
    basePath: "/api/v1/office",
    routes: pythonFileSlugs([
      "xls-to-xlsx", "xls-to-csv", "xls-to-txt", "xls-to-json",
      "xlsx-to-xls", "xlsx-to-csv", "xlsx-to-txt", "xlsx-to-json",
      "ppt-to-pptx", "ppt-to-txt", "ppt-to-html",
      "pptx-to-ppt", "pptx-to-txt", "pptx-to-html",
      "xlsx-to-pdf", "xls-to-pdf", "ppt-to-pdf", "pptx-to-pdf", "pptx-to-images",
      "odt-to-pdf", "odt-to-docx", "odt-to-txt", "odt-to-html",
      "ods-to-pdf", "ods-to-xlsx", "ods-to-csv", "ods-to-txt", "ods-to-json",
      "odp-to-pdf", "odp-to-pptx", "odp-to-txt", "odp-to-html",
    ]).concat([supportedConversionsRoute("office")]),
  },
  {
    tag: "Web",
    tagDescription: "Structured data format conversion",
    basePath: "/api/v1/web",
    routes: pythonFileSlugs([
      "html-to-xml", "html-to-json", "html-to-md",
      "xml-to-html", "xml-to-json", "xml-to-txt", "xml-to-csv",
      "json-to-html", "json-to-xml", "json-to-txt", "json-to-csv",
      "csv-to-html", "csv-to-xml", "csv-to-json", "csv-to-txt",
    ]).concat([supportedConversionsRoute("web")]),
  },
  {
    tag: "eBook",
    tagDescription: "eBook format conversion",
    basePath: "/api/v1/ebook",
    routes: pythonFileSlugs([
      "epub-to-mobi", "epub-to-azw", "epub-to-fb2", "epub-to-txt", "epub-to-html", "epub-to-pdf", "epub-to-docx",
      "mobi-to-epub", "mobi-to-txt", "mobi-to-html", "mobi-to-pdf",
      "azw-to-epub", "azw-to-mobi", "azw-to-txt", "azw-to-html", "azw-to-pdf",
      "fb2-to-epub", "fb2-to-txt", "fb2-to-html", "fb2-to-pdf",
    ]).concat([supportedConversionsRoute("ebook")]),
  },
  {
    tag: "Archive",
    tagDescription: "Archive format conversion",
    basePath: "/api/v1/archive",
    routes: pythonFileSlugs([
      "zip-to-rar", "zip-to-7z", "zip-to-tar", "zip-to-gz", "zip-to-bz2",
      "rar-to-zip", "rar-to-7z", "rar-to-tar", "rar-to-gz", "rar-to-bz2",
      "7z-to-zip", "7z-to-rar", "7z-to-tar", "7z-to-gz", "7z-to-bz2",
      "tar-to-zip", "tar-to-rar", "tar-to-7z", "tar-to-gz", "tar-to-bz2",
      "gz-to-zip", "gz-to-rar", "gz-to-7z", "gz-to-tar", "gz-to-bz2",
      "bz2-to-zip", "bz2-to-rar", "bz2-to-7z", "bz2-to-tar", "bz2-to-gz",
    ]).concat([supportedConversionsRoute("archive")]),
  },
  {
    tag: "File Extract",
    tagDescription: "Extract text from uploaded files",
    basePath: "/api/v1",
    routes: [
      {
        method: "post",
        path: "/extract",
        summary: "Extract text from file content (base64 JSON body)",
        operationId: "extract_text",
        jsonBody: true,
        responseFormat: "extract",
      },
    ],
  },
  {
    tag: "Text Utilities",
    tagDescription: "Text manipulation tools — POST JSON body per slug",
    basePath: "/api/v1/text-utilities",
    catalog: true,
    slugPost: true,
    jsonBody: true,
    slugs: [
      "text-case-converter", "reverse-text", "remove-spaces", "remove-line-breaks",
      "convert-to-slug", "convert-to-hashtags", "comma-separate", "sort-words",
      "sort-lines", "repeat-text", "dummy-text-generator", "random-word-generator",
      "number-to-words", "words-to-number", "compare-texts", "text-stats",
      "convert-to-xml-tags",
    ],
  },
  {
    tag: "SEO Tools",
    tagDescription: "SEO analysis",
    basePath: "/api/v1/seo-tools",
    routes: [
      { method: "post", path: "/analyze", summary: "Analyze URL SEO", operationId: "seoAnalyze", jsonBody: true },
      { method: "post", path: "/compare", summary: "Compare two URLs", operationId: "seoCompare", jsonBody: true },
    ],
  },
  {
    tag: "SEO APIs",
    tagDescription: "SEO data endpoints — GET with url query param",
    basePath: "/api/v1/seo-apis",
    routes: [
      { method: "get", path: "/rank-checker/keywords", summary: "Rank checker keywords", operationId: "rankCheckerKeywords", queryParams: [{ name: "url", required: true }, { name: "keyword", required: false, description: "Optional focus keyword for placement map scoring" }] },
      { method: "get", path: "/social-media-integration", summary: "Social media integration check", operationId: "socialMediaIntegration", queryParams: [{ name: "url", required: true }] },
      { method: "get", path: "/page-speed-analyzer", summary: "Page speed analysis", operationId: "pageSpeedAnalyzer", queryParams: [{ name: "url", required: true }] },
      { method: "get", path: "/content-optimization", summary: "Content optimization", operationId: "contentOptimization", queryParams: [{ name: "url", required: true }] },
      { method: "get", path: "/internal-linking", summary: "Internal linking analysis", operationId: "internalLinking", queryParams: [{ name: "url", required: true }, { name: "depth", required: false, description: "Crawl depth from start URL (0–6, default 2)" }] },
      { method: "get", path: "/link-extractor", summary: "Extract links from URL", operationId: "linkExtractor", queryParams: [{ name: "url", required: true }] },
      { method: "get", path: "/meta-tags-analyzer", summary: "Meta tags analysis", operationId: "metaTagsAnalyzer", queryParams: [{ name: "url", required: true }] },
      { method: "get", path: "/robots-txt-checker", summary: "Robots.txt checker", operationId: "robotsTxtChecker", queryParams: [{ name: "url", required: true }] },
      { method: "get", path: "/sitemap-xml-validator", summary: "Sitemap XML validator", operationId: "sitemapXmlValidator", queryParams: [{ name: "url", required: true }] },
      { method: "get", path: "/canonical-url-checker", summary: "Canonical URL checker", operationId: "canonicalUrlChecker", queryParams: [{ name: "url", required: true }] },
      { method: "get", path: "/http-status-checker", summary: "HTTP status checker", operationId: "httpStatusChecker", queryParams: [{ name: "url", required: true }] },
      { method: "get", path: "/redirect-chain-analyzer", summary: "Redirect chain analyzer", operationId: "redirectChainAnalyzer", queryParams: [{ name: "url", required: true }] },
      { method: "get", path: "/broken-link-checker", summary: "Broken link checker", operationId: "brokenLinkChecker", queryParams: [{ name: "url", required: true }] },
      { method: "get", path: "/mixed-content-checker", summary: "Mixed content checker", operationId: "mixedContentChecker", queryParams: [{ name: "url", required: true }] },
      { method: "get", path: "/schema-markup-validator", summary: "Schema markup validator", operationId: "schemaMarkupValidator", queryParams: [{ name: "url", required: true }] },
      { method: "get", path: "/serp-snippet-preview", summary: "SERP snippet preview", operationId: "serpSnippetPreview", queryParams: [{ name: "url", required: true }] },
      { method: "get", path: "/heading-structure-analyzer", summary: "Heading structure analyzer", operationId: "headingStructureAnalyzer", queryParams: [{ name: "url", required: true }] },
      { method: "get", path: "/image-alt-text-checker", summary: "Image alt text checker", operationId: "imageAltTextChecker", queryParams: [{ name: "url", required: true }] },
      { method: "post", path: "/competitor-page-compare", summary: "Competitor page compare", operationId: "competitorPageCompare", jsonBody: true },
      { method: "get", path: "/hreflang-checker", summary: "Hreflang checker", operationId: "hreflangChecker", queryParams: [{ name: "url", required: true }] },
      { method: "get", path: "/llms-txt-builder", summary: "llms.txt builder (deterministic stub)", operationId: "llmsTxtBuilder", queryParams: [{ name: "url", required: true }] },
      { method: "get", path: "/llms-txt-validator", summary: "llms.txt validator", operationId: "llmsTxtValidator", queryParams: [{ name: "url", required: true }] },
      { method: "get", path: "/ai-overview-readiness-checker", summary: "AI Overview readiness checker (structural heuristics)", operationId: "aiOverviewReadinessChecker", queryParams: [{ name: "url", required: true }] },
      { method: "get", path: "/site-icons-checker", summary: "Favicon and apple-touch icon reachability", operationId: "siteIconsChecker", queryParams: [{ name: "url", required: true }] },
      { method: "post", path: "/seo-change-diff", summary: "SEO change diff between two URLs", operationId: "seoChangeDiff", jsonBody: true },
      { method: "post", path: "/duplicate-content-checker", summary: "Duplicate content checker (URLs or texts)", operationId: "duplicateContentChecker", jsonBody: true },
      { method: "post", path: "/bulk-url-seo-auditor", summary: "Bulk URL SEO auditor (lite scorecard, plan-capped)", operationId: "bulkUrlSeoAuditor", jsonBody: true },
    ].map(withSeoExportFormat),
  },
  {
    tag: "Security APIs",
    tagDescription:
      "Web & developer security checks — headers, TLS, cookies, JWT, passwords, hashes, email auth",
    basePath: "/api/v1/security-apis",
    routes: [
      { method: "get", path: "/catalog", summary: "List security tool slugs", operationId: "securityToolsCatalog", noAuth: true },
      { method: "get", path: "/security-headers-analyzer", summary: "Analyze HTTP security headers", operationId: "securityHeadersAnalyzer", queryParams: [{ name: "url", required: true }] },
      { method: "get", path: "/ssl-tls-certificate-checker", summary: "Inspect TLS certificate", operationId: "sslTlsCertificateChecker", queryParams: [{ name: "url", required: true }] },
      { method: "get", path: "/cookie-security-analyzer", summary: "Analyze Set-Cookie flags", operationId: "cookieSecurityAnalyzer", queryParams: [{ name: "url", required: true }] },
      { method: "get", path: "/spf-dkim-dmarc-checker", summary: "Check SPF, DKIM, DMARC DNS", operationId: "spfDkimDmarcChecker", queryParams: [{ name: "url", required: true, description: "Domain or URL" }] },
      { method: "get", path: "/cors-policy-checker", summary: "Inspect CORS response headers", operationId: "corsPolicyChecker", queryParams: [{ name: "url", required: true }] },
      { method: "get", path: "/http-security-redirect-checker", summary: "HTTP→HTTPS and redirect hop hygiene", operationId: "httpSecurityRedirectChecker", queryParams: [{ name: "url", required: true }] },
      { method: "get", path: "/dns-lookup", summary: "DNS A/AAAA/MX/TXT/NS/CNAME lookup", operationId: "dnsLookup", queryParams: [{ name: "url", required: true, description: "Domain or URL" }] },
      { method: "get", path: "/security-txt-checker", summary: "Fetch security.txt (RFC 9116)", operationId: "securityTxtChecker", queryParams: [{ name: "url", required: true }] },
      { method: "get", path: "/subresource-integrity-checker", summary: "Report SRI on script/link tags", operationId: "subresourceIntegrityChecker", queryParams: [{ name: "url", required: true }] },
      { method: "post", path: "/jwt-decoder", summary: "Decode JWT (no signature verify)", operationId: "jwtDecoder", jsonBody: true },
      { method: "post", path: "/password-strength-checker", summary: "Estimate password strength", operationId: "passwordStrengthChecker", jsonBody: true },
      { method: "post", path: "/secure-password-generator", summary: "Generate a random password", operationId: "securePasswordGenerator", jsonBody: true },
      { method: "post", path: "/hash-generator", summary: "Hash text with common digests", operationId: "hashGenerator", jsonBody: true },
      { method: "post", path: "/secret-leak-scanner", summary: "Scan text for leaked secrets (heuristics)", operationId: "secretLeakScanner", jsonBody: true },
      { method: "post", path: "/hmac-generator", summary: "Compute HMAC digest", operationId: "hmacGenerator", jsonBody: true },
      { method: "post", path: "/bcrypt-hash-generator", summary: "Generate bcrypt or Argon2id password hash", operationId: "bcryptHashGenerator", jsonBody: true },
      { method: "post", path: "/csp-policy-evaluator", summary: "Evaluate a CSP policy string", operationId: "cspPolicyEvaluator", jsonBody: true },
      { method: "post", path: "/jwt-signature-verifier", summary: "Verify JWT signature with secret or public key", operationId: "jwtSignatureVerifier", jsonBody: true },
      { method: "post", path: "/webhook-signature-verifier", summary: "Verify webhook HMAC signatures", operationId: "webhookSignatureVerifier", jsonBody: true },
      { method: "post", path: "/security-headers-analyzer", summary: "Analyze HTTP security headers (POST body.url)", operationId: "securityHeadersAnalyzerPost", jsonBody: true },
      { method: "post", path: "/ssl-tls-certificate-checker", summary: "Inspect TLS certificate (POST body.url)", operationId: "sslTlsCertificateCheckerPost", jsonBody: true },
      { method: "post", path: "/cookie-security-analyzer", summary: "Analyze cookies (POST body.url)", operationId: "cookieSecurityAnalyzerPost", jsonBody: true },
      { method: "post", path: "/spf-dkim-dmarc-checker", summary: "Email auth DNS (POST body.url)", operationId: "spfDkimDmarcCheckerPost", jsonBody: true },
      { method: "post", path: "/cors-policy-checker", summary: "CORS check (POST body.url)", operationId: "corsPolicyCheckerPost", jsonBody: true },
      { method: "post", path: "/http-security-redirect-checker", summary: "Redirect security check (POST body.url)", operationId: "httpSecurityRedirectCheckerPost", jsonBody: true },
      { method: "post", path: "/dns-lookup", summary: "DNS lookup (POST body.url)", operationId: "dnsLookupPost", jsonBody: true },
      { method: "post", path: "/security-txt-checker", summary: "security.txt check (POST body.url)", operationId: "securityTxtCheckerPost", jsonBody: true },
      { method: "post", path: "/subresource-integrity-checker", summary: "SRI check (POST body.url)", operationId: "subresourceIntegrityCheckerPost", jsonBody: true },
    ],
  },
  {
    tag: "Calculators",
    tagDescription: "Billing and finance calculators",
    basePath: "/api/v1/calculators",
    catalog: true,
    slugPost: true,
    jsonBody: true,
    slugs: [
      "gst-calculator", "vat-calculator", "invoice-total-calculator", "discount-calculator",
      "profit-margin-calculator", "markup-calculator", "freelancer-hourly-rate-calculator",
      "salary-to-hourly-converter", "payment-due-date-calculator", "emi-calculator",
      "simple-interest-calculator", "compound-interest-calculator", "break-even-calculator",
      "cost-plus-pricing-calculator", "currency-converter", "tax-compliant-invoice-calculator",
      "credit-note-calculator", "debit-note-calculator", "recurring-invoice-calculator",
      "timesheet-invoice-calculator",
    ],
  },
  {
    tag: "Unit Conversions",
    tagDescription: "Unit conversion tools",
    basePath: "/api/v1/unit-conversions",
    catalog: true,
    slugPost: true,
    jsonBody: true,
    slugs: [
      "length-converter", "area-converter", "mass-converter", "volume-converter",
      "each-converter", "temperature-converter", "time-converter", "digital-converter",
      "parts-per-converter", "speed-converter", "pace-converter", "pressure-converter",
      "current-converter", "voltage-converter", "power-converter", "reactive-power-converter",
      "apparent-power-converter", "energy-converter", "reactive-energy-converter",
      "volume-flow-rate-converter", "illuminance-converter", "frequency-converter",
      "angle-converter",
    ],
  },
  {
    tag: "YouTube Tools",
    tagDescription: "YouTube utilities",
    basePath: "/api/v1/youtube-tools",
    catalog: true,
    slugPost: true,
    jsonBody: true,
    slugs: [
      "youtube-url-parser", "youtube-title-optimizer", "youtube-description-optimizer",
      "youtube-engagement-calculator", "youtube-rpm-calculator", "youtube-caption-formatter",
    ],
  },
  {
    tag: "Marketing APIs",
    tagDescription:
      "Campaign tracking, ads copy QA, email subject checks, growth math, and landing conversion helpers",
    basePath: "/api/v1/marketing-apis",
    routes: [
      { method: "get", path: "/catalog", summary: "List marketing tool slugs", operationId: "marketingToolsCatalog", noAuth: true },
      { method: "get", path: "/landing-page-cta-finder", summary: "Find CTAs on a landing page", operationId: "landingPageCtaFinder", queryParams: [{ name: "url", required: true }] },
      { method: "get", path: "/form-field-inventory", summary: "Inventory form fields on a page", operationId: "formFieldInventory", queryParams: [{ name: "url", required: true }] },
      { method: "get", path: "/marketing-tag-extractor", summary: "Extract marketing tags from a page", operationId: "marketingTagExtractor", queryParams: [{ name: "url", required: true }] },
      { method: "post", path: "/utm-builder", summary: "Build UTM campaign URL", operationId: "utmBuilder", jsonBody: true },
      { method: "post", path: "/utm-parser", summary: "Parse UTM parameters from a URL", operationId: "utmParser", jsonBody: true },
      { method: "post", path: "/ads-utm-builder", summary: "Build ads UTM URL with platform macros", operationId: "adsUtmBuilder", jsonBody: true },
      { method: "post", path: "/qr-code-generator", summary: "Generate QR code SVG", operationId: "qrCodeGenerator", jsonBody: true },
      { method: "post", path: "/ads-copy-counter", summary: "Count ads copy against platform limits", operationId: "adsCopyCounter", jsonBody: true },
      { method: "post", path: "/google-ads-rsa-preview", summary: "Preview Google Ads RSA assets", operationId: "googleAdsRsaPreview", jsonBody: true },
      { method: "post", path: "/email-subject-line-tester", summary: "Score an email subject line", operationId: "emailSubjectLineTester", jsonBody: true },
      { method: "post", path: "/email-spam-word-checker", summary: "Check text for spammy tokens", operationId: "emailSpamWordChecker", jsonBody: true },
      { method: "post", path: "/roas-calculator", summary: "Calculate ROAS", operationId: "roasCalculator", jsonBody: true },
      { method: "post", path: "/cpc-calculator", summary: "Calculate CPC", operationId: "cpcCalculator", jsonBody: true },
      { method: "post", path: "/ctr-calculator", summary: "Calculate CTR", operationId: "ctrCalculator", jsonBody: true },
      { method: "post", path: "/cpa-calculator", summary: "Calculate CPA", operationId: "cpaCalculator", jsonBody: true },
      { method: "post", path: "/cac-calculator", summary: "Calculate CAC", operationId: "cacCalculator", jsonBody: true },
      { method: "post", path: "/utm-bulk-builder", summary: "Bulk-build UTM URLs", operationId: "utmBulkBuilder", jsonBody: true },
      { method: "post", path: "/utm-naming-convention-checker", summary: "Check UTM naming conventions", operationId: "utmNamingConventionChecker", jsonBody: true },
      { method: "post", path: "/email-link-extractor", summary: "Extract links from email HTML", operationId: "emailLinkExtractor", jsonBody: true },
      { method: "post", path: "/email-unsubscribe-checker", summary: "Check unsubscribe link presence", operationId: "emailUnsubscribeChecker", jsonBody: true },
      { method: "post", path: "/social-caption-counter", summary: "Count social caption length", operationId: "socialCaptionCounter", jsonBody: true },
      { method: "post", path: "/social-image-size-validator", summary: "Validate social image dimensions", operationId: "socialImageSizeValidator", jsonBody: true },
      { method: "post", path: "/engagement-rate-calculator", summary: "Calculate engagement rate", operationId: "engagementRateCalculator", jsonBody: true },
      { method: "post", path: "/cpm-calculator", summary: "Calculate CPM", operationId: "cpmCalculator", jsonBody: true },
      { method: "post", path: "/ab-test-sample-size-calculator", summary: "Estimate A/B test sample size", operationId: "abTestSampleSizeCalculator", jsonBody: true },
      { method: "post", path: "/ab-test-significance-calculator", summary: "Estimate A/B test significance", operationId: "abTestSignificanceCalculator", jsonBody: true },
      { method: "post", path: "/ai-ad-headline-variants", summary: "Template ad headline variants (not LLM)", operationId: "aiAdHeadlineVariants", jsonBody: true },
      { method: "post", path: "/ai-email-subject-variants", summary: "Template email subject variants (not LLM)", operationId: "aiEmailSubjectVariants", jsonBody: true },
    ],
  },
  {
    tag: "Developer APIs",
    tagDescription:
      "JSON, encoding, codegen, HTTP helpers, formatters — requires X-Api-Key",
    basePath: "/api/v1/developer-apis",
    routes: [
      { method: "get", path: "/catalog", summary: "List developer tool slugs", operationId: "developerToolsCatalog", noAuth: true },
      { method: "get", path: "/http-headers-checker", summary: "Fetch and inspect HTTP response headers", operationId: "httpHeadersChecker", queryParams: [{ name: "url", required: true }] },
      { method: "post", path: "/json-formatter", summary: "Format / pretty-print JSON", operationId: "jsonFormatter", jsonBody: true },
      { method: "post", path: "/json-validator", summary: "Validate JSON syntax", operationId: "jsonValidator", jsonBody: true },
      { method: "post", path: "/base64-encoder-decoder", summary: "Encode or decode Base64 text", operationId: "base64EncoderDecoder", jsonBody: true },
      { method: "post", path: "/url-encoder-decoder", summary: "Encode or decode URL components", operationId: "urlEncoderDecoder", jsonBody: true },
      { method: "post", path: "/uuid-generator", summary: "Generate UUIDs", operationId: "uuidGenerator", jsonBody: true },
      { method: "post", path: "/timestamp-converter", summary: "Convert unix ↔ human timestamps", operationId: "timestampConverter", jsonBody: true },
      { method: "post", path: "/regex-tester", summary: "Test a regular expression against input", operationId: "regexTester", jsonBody: true },
      { method: "post", path: "/json-to-typescript", summary: "Generate TypeScript types from JSON", operationId: "jsonToTypescript", jsonBody: true },
      { method: "post", path: "/json-to-zod", summary: "Generate Zod schema from JSON", operationId: "jsonToZod", jsonBody: true },
      { method: "post", path: "/json-to-go-struct", summary: "Generate Go structs from JSON", operationId: "jsonToGoStruct", jsonBody: true },
      { method: "post", path: "/json-to-python", summary: "Generate Python typed dicts/dataclasses from JSON", operationId: "jsonToPython", jsonBody: true },
      { method: "post", path: "/yaml-to-json", summary: "Convert YAML to JSON", operationId: "yamlToJson", jsonBody: true },
      { method: "post", path: "/json-to-yaml", summary: "Convert JSON to YAML", operationId: "jsonToYaml", jsonBody: true },
      { method: "post", path: "/xml-formatter", summary: "Format / pretty-print XML", operationId: "xmlFormatter", jsonBody: true },
      { method: "post", path: "/jwt-generator", summary: "Generate a signed JWT (test/dev use)", operationId: "jwtGenerator", jsonBody: true },
      { method: "post", path: "/http-headers-checker", summary: "Fetch HTTP headers (POST body.url)", operationId: "httpHeadersCheckerPost", jsonBody: true },
      { method: "post", path: "/api-request-builder", summary: "Build HTTP request / cURL from fields", operationId: "apiRequestBuilder", jsonBody: true },
      { method: "post", path: "/user-agent-parser", summary: "Parse a User-Agent string", operationId: "userAgentParser", jsonBody: true },
      { method: "post", path: "/ip-address-tools", summary: "IP address parse / classify helpers", operationId: "ipAddressTools", jsonBody: true },
      { method: "post", path: "/html-formatter", summary: "Format HTML", operationId: "htmlFormatter", jsonBody: true },
      { method: "post", path: "/css-formatter", summary: "Format CSS", operationId: "cssFormatter", jsonBody: true },
      { method: "post", path: "/js-formatter", summary: "Format JavaScript", operationId: "jsFormatter", jsonBody: true },
      { method: "post", path: "/sql-formatter", summary: "Format SQL", operationId: "sqlFormatter", jsonBody: true },
      { method: "post", path: "/sql-validator", summary: "Validate SQL syntax (local heuristics)", operationId: "sqlValidator", jsonBody: true },
      { method: "post", path: "/regex-generator", summary: "Build a regex from guided options (not LLM)", operationId: "regexGenerator", jsonBody: true },
      { method: "post", path: "/cron-expression-generator", summary: "Build a cron expression", operationId: "cronExpressionGenerator", jsonBody: true },
      { method: "post", path: "/cron-expression-parser", summary: "Parse / explain a cron expression", operationId: "cronExpressionParser", jsonBody: true },
      { method: "post", path: "/css-minifier", summary: "Minify CSS", operationId: "cssMinifier", jsonBody: true },
      { method: "post", path: "/js-minifier", summary: "Minify JavaScript", operationId: "jsMinifier", jsonBody: true },
      { method: "post", path: "/color-converter", summary: "Convert color formats (hex/rgb/hsl)", operationId: "colorConverter", jsonBody: true },
    ],
  },
  {
    tag: "Text Intelligence",
    tagDescription: "Text intelligence and NLP tools",
    basePath: "/api/v1/text-intelligence",
    routes: [
      { method: "post", path: "/pii-scrub", summary: "Scrub PII from text", operationId: "piiScrub", jsonBody: true, responseFormat: "pythonEnvelope" },
      { method: "post", path: "/pii-scrub-file", summary: "Scrub PII from uploaded file", operationId: "piiScrubFile", multipart: true, fileField: "file", responseFormat: "pythonEnvelope" },
      { method: "post", path: "/jargon-buster", summary: "Simplify jargon in text", operationId: "jargonBuster", jsonBody: true, responseFormat: "pythonEnvelope" },
      { method: "post", path: "/snippet-maker", summary: "Generate text snippets", operationId: "snippetMaker", jsonBody: true, responseFormat: "pythonEnvelope" },
      { method: "post", path: "/headline-restructurer", summary: "Restructure headlines", operationId: "headlineRestructurer", jsonBody: true, responseFormat: "pythonEnvelope" },
      { method: "post", path: "/ats-gap", summary: "ATS keyword gap analysis", operationId: "atsGap", jsonBody: true, responseFormat: "pythonEnvelope" },
      { method: "post", path: "/ats-gap-file", summary: "ATS gap from resume file", operationId: "atsGapFile", multipart: true, responseFormat: "pythonEnvelope" },
      { method: "post", path: "/expense-categorizer", summary: "Categorize expenses from text", operationId: "expenseCategorizer", jsonBody: true, responseFormat: "pythonEnvelope" },
      { method: "post", path: "/expense-categorizer-file", summary: "Categorize expenses from file", operationId: "expenseCategorizerFile", multipart: true, fileField: "file", responseFormat: "pythonEnvelope" },
    ],
  },
  {
    tag: "AI Models",
    tagDescription: "AI-powered analysis and generation — requires X-Api-Key",
    basePath: "/api/v1/ai-models",
    routes: [
      { method: "post", path: "/file-insights", summary: "Analyze uploaded file with AI", operationId: "aiFileInsights", multipart: true, responseFormat: "nodeEnvelope201" },
      { method: "post", path: "/text-ai", summary: "Text generation and analysis", operationId: "aiTextAi", jsonBody: true, responseFormat: "nodeEnvelope201" },
      { method: "post", path: "/youtube-insight", summary: "YouTube video insights", operationId: "aiYoutubeInsight", jsonBody: true, responseFormat: "nodeEnvelope201" },
    ],
  },
];

export const toolTags = toolGroups.map((g) => ({
  name: g.tag,
  description: g.tagDescription,
}));
