import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['tests/unit/**/*.test.ts', 'sim/**/*.test.ts'],
    environment: 'node',
  },
});
