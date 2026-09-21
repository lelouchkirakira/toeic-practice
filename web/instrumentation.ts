// 伺服器端（route handler 的後端代理跑在這裡）。
export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    await import("./sentry.server.config");
  }
}

export { captureRequestError as onRequestError } from "@sentry/nextjs";
