import type { NextConfig } from 'next';

const config: NextConfig = {
  reactStrictMode: true,
  // The storefront is a self-contained fixture: no images, no external calls.
  poweredByHeader: false,
};

export default config;
