import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    useCache: true,
  },
  skipTrailingSlashRedirect: true,
};

export default nextConfig;
