import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Prevent Next.js from bundling packages that use Node.js worker_threads
  serverExternalPackages: ['tesseract.js'],
};

export default nextConfig;
