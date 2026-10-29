/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: false, // Prevents double WebRTC connection mounting in local dev
  allowedDevOrigins: [
    "*.loca.lt",
    "*.ngrok-free.app",
    "*.ngrok.app",
    "*.trycloudflare.com",
    "*.pinggy.link",
    "*.a.pinggy.link",
    "*.pinggy.io",
    "*.untun.com",
  ],
};

export default nextConfig;

