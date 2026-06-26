/** @type {import('next').NextConfig} */
const nextConfig = {
  env: {
    FLASK_API_URL: process.env.FLASK_API_URL ?? "http://localhost:5000",
  },
};

export default nextConfig;
