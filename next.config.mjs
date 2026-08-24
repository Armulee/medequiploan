/** @type {import('next').NextConfig} */
const nextConfig = {
  // Uploaded ID-card / illness photos are streamed through /api/files/[id]
  // rather than served from a public URL, so no remote image config is needed.
  experimental: {
    // Keep request bodies small; photo uploads go straight to Blob storage.
  },
};

export default nextConfig;
