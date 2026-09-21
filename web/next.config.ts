import type { NextConfig } from "next";

// 本機開發時瀏覽器不直接打後端（Python 版的 CORS 白名單只有 5173），
// 改由 Next 伺服器把同源路徑轉給後端，路徑規則與上線用的同源代理一致。
//
// 兩種後端的路徑前綴不同，用環境變數切換：
//   Python（舊版，對照用）  origin=http://localhost:8003  prefix=/api
//   Go（dashai-go）         origin=http://localhost:8010  prefix=/toeic
const devBackendOrigin =
  process.env.DEV_BACKEND_ORIGIN ?? "http://localhost:8010";
const devBackendPrefix = process.env.DEV_BACKEND_PREFIX ?? "/toeic";

const nextConfig: NextConfig = {
  async rewrites() {
    return [
      {
        source: "/api/backend/toeic/:path*",
        destination: `${devBackendOrigin}${devBackendPrefix}/:path*`,
      },
    ];
  },
};

export default nextConfig;
