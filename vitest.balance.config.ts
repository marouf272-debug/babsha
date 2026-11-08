import { defineConfig } from 'vitest/config';

// Separate config for the long balance run (`npm run balance`).
export default defineConfig({
  test: { include: ['sim/balance.run.ts'], environment: 'node', testTimeout: 3_600_000 },
});
