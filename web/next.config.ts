import type { NextConfig } from "next";
import { withSentryConfig } from "@sentry/nextjs/config";

// 後端轉送走 app/api/backend/toeic/[...path]/route.ts，不用 rewrite。
// dashai-go 的 origin lock 是 enforce，轉送要帶 X-Origin-Key，
// 而 rewrite 加不了自訂標頭。
const nextConfig: NextConfig = {};

export default withSentryConfig(nextConfig, {
  org: "dashai-jz",
  project: "toeic-practice",

  // 沒有 SENTRY_AUTH_TOKEN 時跳過 source map 上傳，本機建構不會因此失敗。
  silent: !process.env.CI,
  // disableLogger 已棄用，改用這個。
  webpack: { treeshake: { removeDebugLogging: true } },

  // Sentry 的自動檢測路由會經過 /monitoring，擋廣告的擴充套件不會擋掉它。
  tunnelRoute: "/monitoring",
});
