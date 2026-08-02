import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  allowedDevOrigins: ["unstuck-deed-sulk.ngrok-free.dev"],
  experimental: {
    devtoolSegmentExplorer: false,
  },
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "lh3.googleusercontent.com",
      },
      {
        protocol: "https",
        hostname: "firebasestorage.googleapis.com",
      },
    ],
  },
};

export default nextConfig;
