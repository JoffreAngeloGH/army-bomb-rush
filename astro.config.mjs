// @ts-check
import { defineConfig } from 'astro/config';

// https://astro.build/config
export default defineConfig({
  vite: {
    server: {
      // Cloudflare quick tunnels get a new random subdomain each run
      allowedHosts: ['.trycloudflare.com'],
    },
  },
});
