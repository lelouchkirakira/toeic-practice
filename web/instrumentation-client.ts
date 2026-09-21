// Next.js 的 Turbopack 路徑只會載入這個檔名，舊式的 sentry.client.config.ts
// 是 webpack 路徑才會被注入，放在那裡等於沒載到。
import * as Sentry from "@sentry/nextjs";

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,

  // 瀏覽器的 bundle 只內嵌 NEXT_PUBLIC_ 前綴的變數，讀 VERCEL_ENV 會永遠是
  // development。
  environment: process.env.NEXT_PUBLIC_VERCEL_ENV ?? "development",
  release: process.env.NEXT_PUBLIC_VERCEL_GIT_COMMIT_SHA,

  tracesSampleRate: 0.2,

  beforeSend(event, hint) {
    // 微軟 Office 系瀏覽器擴充套件注入頁面產生的雜訊，不是應用程式的錯誤。
    // 每個裝了那個套件的訪客都會產生一筆，會讓部署後查 is:unresolved 失效。
    const raw = hint?.originalException;
    const text =
      typeof raw === "string" ? raw : (event.exception?.values?.[0]?.value ?? "");
    if (/Object Not Found Matching Id:\d+/.test(text)) return null;
    return event;
  },
});

export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;
