import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import tsconfigPaths from 'vite-tsconfig-paths';
import { resolve } from 'path';

export default defineConfig({
  root: __dirname, // Explicitly set root to ensure alias resolution works from wedding-pro-app/
  plugins: [tsconfigPaths(), react({ jsxRuntime: 'automatic' })], // Re-added tsconfigPaths
  // Removed server.fs.allow as the node_modules path assumption was likely incorrect
  test: {
    environment: 'jsdom',
    include: ['**/*.{test,spec}.{js,ts,jsx,tsx}'],
    exclude: ['e2e/**', 'node_modules/**'],
    globals: true,
    setupFiles: [
      resolve(__dirname, './test/setup.ts'),
      resolve(__dirname, './test/setup-jest-dom.ts'),
    ],
    // server: {
    //   deps: {
    //     inline: [
    //       // /^(?!.*vitest).*react.*$/, // Inline react and its submodules
    //       // /^react-dom.*$/,         // Inline react-dom and its submodules
    //       // Ensure specific problematic paths are inlined
    //       'react/jsx-dev-runtime',
    //       'react/jsx-runtime',
    //       'react',
    //       'react-dom'
    //     ],
    //   },
    // },
    // ssr: {
    //   noExternal: [
    //     // /^(?!.*vitest).*react.*$/,
    //     // /^react-dom.*$/,
    //     'react/jsx-dev-runtime',
    //     'react/jsx-runtime',
    //     'react',
    //     'react-dom'
    //   ],
    // },
    deps: {
      optimizer: {
        web: {
          // Temporarily remove includes to simplify
          // include: [
          //   'react',
          //   'react-dom',
          //   'react/jsx-runtime',
          //   'react/jsx-dev-runtime',
          // ],
        },
        // ssr: {
        //   include: ['react', 'react-dom', 'react/jsx-runtime', 'react/jsx-dev-runtime'],
        // }
      },
    },
  },
  resolve: {
    preserveSymlinks: true, // Added to handle pnpm structure
    alias: {
      '@': resolve(__dirname, '.'), // tsconfigPaths should handle this, but keep as fallback
      // Aliases point to node_modules within wedding-pro-app
      'react': resolve(__dirname, 'node_modules/react'),
      'react-dom': resolve(__dirname, 'node_modules/react-dom'),
      // Keep the testing-specific alias for react-dom/client
      'react-dom/client': 'react-dom/test-utils',
      // Removed manual alias for context, tsconfigPaths should handle it
      // Let the react plugin handle jsx-runtime and jsx-dev-runtime resolution
    },
    dedupe: ['react', 'react-dom'],
  },
  // Remove root-level optimizeDeps to simplify
  // optimizeDeps: {
  //   include: [
  //     'react',
  //     'react-dom',
  //     'react/jsx-runtime',
  //     'react/jsx-dev-runtime',
  //   ],
  // },
});