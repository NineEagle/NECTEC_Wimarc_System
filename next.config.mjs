/** @type {import('next').NextConfig} */
const nextConfig = {
  devIndicators: false,
  typescript: {
    ignoreBuildErrors: true,
  },
  images: {
    unoptimized: true,
  },
  async rewrites() {
    const backend = process.env.BACKEND_PROXY_URL ?? "http://localhost:8000"
    const media = process.env.MEDIA_PROXY_URL ?? "http://localhost:8001"
    return [
      { source: "/backend/:path*", destination: `${backend}/:path*` },
      { source: "/media/:path*", destination: `${media}/:path*` },
    ]
  },
}

export default nextConfig
