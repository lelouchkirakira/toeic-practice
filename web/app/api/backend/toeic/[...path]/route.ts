/* 後端同源代理。
 *
 * dashai-go 的 ORIGIN_LOCK 是 enforce，沒帶 X-Origin-Key 的請求一律 403，
 * 而 next.config.ts 的 rewrite 加不了自訂標頭，所以轉送要走這裡。
 * 瀏覽器打同源的 /api/backend/toeic/<path>，這支把它帶著金鑰轉給 Render。
 *
 * 兩個變數都是伺服器端的，不會進到前端 bundle：
 *   TOEIC_BACKEND_ORIGIN  後端位址，本機是 http://localhost:8010
 *   ORIGIN_KEY            origin lock 的金鑰，本機不用設
 */

const BACKEND_ORIGIN =
  process.env.TOEIC_BACKEND_ORIGIN ?? "http://localhost:8010";
const ORIGIN_KEY = process.env.ORIGIN_KEY ?? "";

// 只轉送必要的標頭，避免把 cookie 之類的東西帶去後端。
const PASS_REQUEST = ["content-type", "accept", "accept-language", "x-learner-id"];
const PASS_RESPONSE = ["content-type", "cache-control"];

async function proxy(request: Request, path: string[]): Promise<Response> {
  const incoming = new URL(request.url);
  const target = new URL(
    `${BACKEND_ORIGIN}/toeic/${path.map(encodeURIComponent).join("/")}`,
  );
  target.search = incoming.search;

  const headers = new Headers();
  for (const name of PASS_REQUEST) {
    const value = request.headers.get(name);
    if (value) headers.set(name, value);
  }
  if (ORIGIN_KEY) headers.set("X-Origin-Key", ORIGIN_KEY);

  const hasBody = request.method !== "GET" && request.method !== "HEAD";

  let upstream: Response;
  try {
    upstream = await fetch(target, {
      method: request.method,
      headers,
      body: hasBody ? await request.arrayBuffer() : undefined,
      cache: "no-store",
    });
  } catch {
    // 後端連不上就照實回 503，不要塞假資料。
    return Response.json(
      { success: false, error: "題庫與字庫暫時無法使用" },
      { status: 503 },
    );
  }

  const responseHeaders = new Headers();
  for (const name of PASS_RESPONSE) {
    const value = upstream.headers.get(name);
    if (value) responseHeaders.set(name, value);
  }

  return new Response(upstream.body, {
    status: upstream.status,
    headers: responseHeaders,
  });
}

type RouteContext = { params: Promise<{ path: string[] }> };

export async function GET(request: Request, context: RouteContext) {
  const { path } = await context.params;
  return proxy(request, path);
}

export async function POST(request: Request, context: RouteContext) {
  const { path } = await context.params;
  return proxy(request, path);
}

export const dynamic = "force-dynamic";
