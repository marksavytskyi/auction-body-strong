const API_TARGET = (process.env.API_BASE_URL || process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:8000").replace(/\/+$/, "");

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const HOP_BY_HOP_HEADERS = new Set([
    "connection",
    "keep-alive",
    "proxy-authenticate",
    "proxy-authorization",
    "te",
    "trailer",
    "transfer-encoding",
    "upgrade",
    "host",
    "content-length",
]);
const RETRYABLE_STATUS = new Set([500, 502, 503, 504]);

function buildTargetUrl(pathParts = [], search = "") {
    const joinedPath = Array.isArray(pathParts) ? pathParts.join("/") : "";
    return `${API_TARGET}/${joinedPath}${search || ""}`;
}

function buildForwardHeaders(requestHeaders) {
    const headers = new Headers();
    for (const [key, value] of requestHeaders.entries()) {
        if (HOP_BY_HOP_HEADERS.has(key.toLowerCase())) continue;
        headers.set(key, value);
    }
    return headers;
}

function buildResponseHeaders(upstreamHeaders) {
    const headers = new Headers();
    for (const [key, value] of upstreamHeaders.entries()) {
        if (HOP_BY_HOP_HEADERS.has(key.toLowerCase())) continue;
        headers.set(key, value);
    }
    return headers;
}

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function fetchUpstream(targetUrl, method, headers, body) {
    const canRetry = method === "GET";
    const attempts = canRetry ? 3 : 1;
    const timeout = 60000; // 60s timeout per attempt

    for (let attempt = 1; attempt <= attempts; attempt += 1) {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), timeout);

        try {
            const response = await fetch(targetUrl, {
                method,
                headers,
                body,
                redirect: "manual",
                cache: "no-store",
                signal: controller.signal,
            });

            if (canRetry && RETRYABLE_STATUS.has(response.status) && attempt < attempts) {
                console.warn(`Upstream returned ${response.status} for ${method} ${targetUrl}. Retrying (attempt ${attempt}/${attempts})...`);
                await delay(500 * attempt);
                continue;
            }

            return response;
        } catch (error) {
            const isTimeout = error.name === "AbortError";
            const errorMessage = isTimeout ? "Request timed out" : (error?.message || String(error));
            
            if (canRetry && attempt < attempts) {
                console.warn(`Fetch error for ${method} ${targetUrl}: ${errorMessage}. Retrying (attempt ${attempt}/${attempts})...`);
                await delay(500 * attempt);
                continue;
            }
            throw error;
        } finally {
            clearTimeout(timeoutId);
        }
    }

    throw new Error("Failed to fetch upstream after retries");
}

async function proxyRequest(request, context) {
    const resolvedParams = await Promise.resolve(context?.params);
    const targetUrl = buildTargetUrl(resolvedParams?.path, request.nextUrl.search);
    const headers = buildForwardHeaders(request.headers);
    const method = request.method.toUpperCase();
    const hasBody = !["GET", "HEAD"].includes(method);

    try {
        let upstreamBody;
        if (hasBody) {
            const buf = await request.arrayBuffer();
            upstreamBody = buf.byteLength > 0 ? buf : undefined;
        }
        const upstreamResponse = await fetchUpstream(targetUrl, method, headers, upstreamBody);

        const responseHeaders = buildResponseHeaders(upstreamResponse.headers);
        
        // Log non-200 responses for easier debugging
        if (upstreamResponse.status >= 400) {
            console.error(`Upstream error response for ${method} ${targetUrl}: ${upstreamResponse.status} ${upstreamResponse.statusText}`);
        }

        return new Response(upstreamResponse.body, {
            status: upstreamResponse.status,
            statusText: upstreamResponse.statusText,
            headers: responseHeaders,
        });
    } catch (error) {
        console.error(`Proxy error for ${method} ${targetUrl}:`, error);
        return Response.json(
            {
                detail: "Upstream API is unreachable",
                target: targetUrl,
                error: String(error?.message || error),
            },
            { status: 502 }
        );
    }
}

export async function GET(request, context) {
    return proxyRequest(request, context);
}

export async function POST(request, context) {
    return proxyRequest(request, context);
}

export async function PUT(request, context) {
    return proxyRequest(request, context);
}

export async function PATCH(request, context) {
    return proxyRequest(request, context);
}

export async function DELETE(request, context) {
    return proxyRequest(request, context);
}

export async function OPTIONS(request, context) {
    return proxyRequest(request, context);
}
