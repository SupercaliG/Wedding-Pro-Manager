# Vite/Vitest Alias Resolution in Monorepo (`wedding-pro-app`)

This document explains the configuration required for proper alias resolution, specifically for the `'@'` alias, in Vitest tests within the `wedding-pro-app` sub-project of the `d:/AI PROJECTS/Wedding Pro 1.5` monorepo.

## 1. The Problem

Vitest tests running within the `wedding-pro-app` (a sub-project) were initially failing to resolve module paths using the `'@'` alias (e.g., `'@/components/my-component'`). This alias is configured in [`tsconfig.json`](../../tsconfig.json) to point to the root of the `wedding-pro-app` directory.

## 2. Solution Path and Key Findings

Several steps were taken to diagnose and resolve this issue, leading to a key understanding of how Vitest handles aliases in conjunction with TypeScript paths in a monorepo setup.

### 2.1. Initial Attempts with `vite-tsconfig-paths`

*   The `vite-tsconfig-paths` plugin was installed as it's commonly used to make Vite/Vitest respect `paths` defined in `tsconfig.json`.
*   The [`tsconfig.json`](../../tsconfig.json) file within `wedding-pro-app` was updated to include `"baseUrl": "."` to correctly anchor the path aliases.

While these steps are necessary, they were found to be insufficient on their own.

### 2.2. Refactoring `vi.spyOn` Calls

During the investigation, it was also noted that dynamic `require()` calls within `vi.spyOn` for aliased modules can be problematic. For instance, calls like:
`vi.spyOn(require('@/some-module'), 'someFunction')`
were refactored to use static ES module imports first, and then spy on the imported module. This is a general best practice (see section 4).

### 2.3. The Crucial Insight: Dual Configuration is Required

The key finding was that for the `'@'` alias to resolve correctly in Vitest tests within our `wedding-pro-app` monorepo setup, **both** the `vite-tsconfig-paths` plugin AND an explicit alias configuration within [`vitest.config.ts`](../../vitest.config.ts) are necessary.

Simply relying on `vite-tsconfig-paths` to pick up the `paths` from [`tsconfig.json`](../../tsconfig.json) was not enough. An explicit `alias` entry in the Vitest configuration, along with setting the `root` directory correctly, was required to make it work.

## 3. Final `vitest.config.ts` Configuration

The following configuration in [`wedding-pro-app/vitest.config.ts`](../../vitest.config.ts) was verified to enable correct `'@'` alias resolution:

```typescript
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import tsconfigPaths from 'vite-tsconfig-paths';
import { resolve } from 'path';

export default defineConfig({
  // Explicitly set root to the directory of this config file (wedding-pro-app)
  // This is crucial for monorepo setups where the config might not be at the project root.
  root: __dirname, 
  plugins: [
    react(), 
    // This plugin reads paths from tsconfig.json.
    // 'loose: true' can help with some resolution edge cases.
    tsconfigPaths({ loose: true }) 
  ],
  test: {
    environment: 'jsdom',
    include: ['**/*.{test,spec}.{js,ts,jsx,tsx}'],
    exclude: ['e2e/**', 'node_modules/**'],
    globals: true,
    setupFiles: [resolve(__dirname, './test/setup.ts')],
    // This explicit alias configuration is ALSO needed, despite using tsconfigPaths.
    // It ensures the '@' alias correctly points to the root of the 'wedding-pro-app' directory.
    alias: {
      '@': resolve(__dirname, './'), 
    },
  },
});
```

**Key points in this configuration:**

*   `root: __dirname`: Sets the root directory for Vitest to the location of the `vitest.config.ts` file itself (i.e., `wedding-pro-app`). This is important in a monorepo context.
*   `tsconfigPaths({ loose: true })`: The plugin to read paths from `tsconfig.json`.
*   `alias: { '@': resolve(__dirname, './') }`: The explicit alias definition that works in tandem with the plugin.

## 4. Best Practice for `vi.spyOn` with Aliased Modules

When you need to spy on methods from modules that are resolved using path aliases, it's best practice to:

1.  **Import the module statically:**
    ```typescript
    import * as myAliasedModule from '@/utils/my-helpers'; 
    ```
2.  **Then, use `vi.spyOn` with the imported module object:**
    ```typescript
    vi.spyOn(myAliasedModule, 'someFunctionToSpyOn');
    ```

This approach is more reliable than attempting to use `require()` directly within `vi.spyOn` for aliased paths, e.g., `vi.spyOn(require('@/utils/my-helpers'), 'someFunctionToSpyOn')`, especially with ES module resolution intricacies.

## 5. Conclusion

For reliable `'@'` alias resolution in Vitest tests within the `wedding-pro-app` monorepo package, a combination of the `vite-tsconfig-paths` plugin and an explicit `alias` mapping in the [`vitest.config.ts`](../../vitest.config.ts) is essential. This documentation serves as a reference for understanding and maintaining this setup.