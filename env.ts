/* eslint-disable no-process-env */
import { createEnv } from "@t3-oss/env-nextjs";
import { z } from "zod";

export const env = createEnv({
  server: {},
  client: {
    NEXT_PUBLIC_WEB3STORAGE_PROJECT_ID: z.string().min(1),
    NEXT_PUBLIC_NODE_ENV: z.string(),
    // Optional: Unicorn/Autoconnect integration (only needed when accessed via Unicorn portal)
    NEXT_PUBLIC_THIRDWEB_CLIENT_ID: z.string().optional(),
    NEXT_PUBLIC_THIRDWEB_FACTORY_ADDRESS: z.string().optional(),
  },
  runtimeEnv: {
    NEXT_PUBLIC_NODE_ENV: process.env.NODE_ENV,
    NEXT_PUBLIC_WEB3STORAGE_PROJECT_ID:
      process.env.NEXT_PUBLIC_WEB3STORAGE_PROJECT_ID,
    NEXT_PUBLIC_THIRDWEB_CLIENT_ID: process.env.NEXT_PUBLIC_THIRDWEB_CLIENT_ID,
    NEXT_PUBLIC_THIRDWEB_FACTORY_ADDRESS:
      process.env.NEXT_PUBLIC_THIRDWEB_FACTORY_ADDRESS,
  },
});
