import type { NextConfig } from "next";

const repo = "v_for_x";
const isProd = process.env.NODE_ENV === "production";
const useBasePath = isProd && process.env.LHCI !== "true";

const nextConfig: NextConfig = {
  output: "export",
  trailingSlash: true,
  basePath: useBasePath ? `/${repo}` : "",
  assetPrefix: useBasePath ? `/${repo}/` : "",
  images: {
    unoptimized: true,
  },
};

export default nextConfig;
