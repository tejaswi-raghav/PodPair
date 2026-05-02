// next.config.js
/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    domains: ['lh3.googleusercontent.com', 'podpair-recordings.s3.amazonaws.com'],
  },
  // Transpile simple-peer (CommonJS module)
  transpilePackages: ['simple-peer'],
};

module.exports = nextConfig;
