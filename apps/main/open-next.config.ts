import { defineCloudflareConfig } from "@opennextjs/cloudflare"

// Every Sajilo page is per-user and dynamic, so no incremental cache is configured.
export default defineCloudflareConfig({})
