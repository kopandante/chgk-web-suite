import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "img.clerk.com",
      },
    ],
  },
  webpack: (config, { isServer }) => {
    if (!isServer) {
      const resolve = config.resolve;

      // Handle node: protocol - pptxgenjs uses these
      resolve.fallback = {
        ...resolve.fallback,
        fs: false,
        path: false,
        https: false,
        http: false,
        stream: false,
        zlib: false,
        crypto: false,
        buffer: false,
        url: false,
        util: false,
      };

      // Ignore node: protocol imports
      config.plugins = config.plugins || [];
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const webpack = require("webpack");
      config.plugins.push(
        new webpack.NormalModuleReplacementPlugin(/^node:/, (resource: { request: string }) => {
          resource.request = resource.request.replace(/^node:/, "");
        }),
      );
    }
    return config;
  },
};

export default nextConfig;
