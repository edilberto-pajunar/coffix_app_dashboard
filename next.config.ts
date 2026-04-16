import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "**",
      },
    ],
  },
  turbopack: {
    resolveAlias: {
      fs: { browser: "./empty.js" },
      path: { browser: "./empty.js" },
    },
  },
};

export default nextConfig;
