import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "img.youtube.com", pathname: "/**" },
      { protocol: "https", hostname: "i.ytimg.com", pathname: "/**" },
      { protocol: "https", hostname: "yt3.ggpht.com", pathname: "/**" },
      { protocol: "https", hostname: "yt3.googleusercontent.com", pathname: "/**" },
      { protocol: "https", hostname: "res.cloudinary.com", pathname: "/**" },
    ],
    // Vercel Blob URLs vary (e.g. xxx.public.blob.vercel-storage.com); use unoptimized or <img> if needed
  },
  serverExternalPackages: ["@anthropic-ai/sdk", "googleapis", "cloudinary"],
};

export default nextConfig;
