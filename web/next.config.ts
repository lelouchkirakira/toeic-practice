import type { NextConfig } from "next";

// 後端轉送走 app/api/backend/toeic/[...path]/route.ts，不用 rewrite。
// dashai-go 的 origin lock 是 enforce，轉送要帶 X-Origin-Key，
// 而 rewrite 加不了自訂標頭。
const nextConfig: NextConfig = {};

export default nextConfig;
