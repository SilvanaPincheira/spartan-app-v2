// next.config.js
const withPWA = require("next-pwa")({
  dest: "public",         // ⬅️ Carpeta donde se guardan los archivos de cache
  register: true,         // ⬅️ Registra el service worker automáticamente
  skipWaiting: true,      // ⬅️ Activa la nueva versión sin esperar
  disable: process.env.NODE_ENV === "development", // ⬅️ Para que en local no moleste
});

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  experimental: {
    esmExternals: "loose", // 👈 habilita librerías ESM como d3
  },
};

module.exports = withPWA(nextConfig);
