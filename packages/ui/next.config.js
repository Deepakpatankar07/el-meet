const path = require("path");

/** @type {import('next').NextConfig} */
const nextConfig = {
  webpack: (config) => {
    config.resolve.alias = {
      ...(config.resolve.alias || {}),
      "@": path.resolve(__dirname, "packages/ui/src"), // Adjust this path to match your alias
    };
    return config;
  },
};

module.exports = nextConfig;
