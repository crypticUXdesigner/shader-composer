import tseslint from 'typescript-eslint';
import eslintPluginSvelte from 'eslint-plugin-svelte';
import svelteParser from 'svelte-eslint-parser';

// Flat config for ESLint 10, TypeScript, and Svelte 5.
// Start with a conservative rule set so linting can be adopted incrementally.
export default tseslint.config(
  {
    ignores: ['dist/**', 'node_modules/**', 'vite.config.*', 'vitest.config.*', '**/*.svelte.ts'],
  },
  // TypeScript recommended rules.
  ...tseslint.configs.recommended,
  // Svelte base config (parser + core rules only).
  eslintPluginSvelte.configs['flat/base'],
  // Project-specific tweaks.
  {
    files: ['**/*.ts', '**/*.tsx'],
    languageOptions: {
      sourceType: 'module',
      ecmaVersion: 2020,
    },
    rules: {
      // Keep TypeScript strictness focused in tsconfig; relax the noisiest rules for now.
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/explicit-module-boundary-types': 'off',
      '@typescript-eslint/no-unused-vars': 'off',
      '@typescript-eslint/no-unused-expressions': 'off',
      '@typescript-eslint/no-this-alias': 'off',
      // Prefer letting TypeScript handle const vs let for now.
      'prefer-const': 'off',
    },
  },
  {
    files: ['**/*.svelte'],
    languageOptions: {
      parser: svelteParser,
      parserOptions: {
        parser: tseslint.parser,
        extraFileExtensions: ['.svelte'],
        ecmaVersion: 2020,
        sourceType: 'module',
      },
    },
    rules: {
      // Rely on the base Svelte config; relax TS-specific rules that duplicate tsconfig behavior.
      '@typescript-eslint/no-unused-vars': 'off',
      '@typescript-eslint/no-unused-expressions': 'off',
      '@typescript-eslint/no-this-alias': 'off',
      'prefer-const': 'off',
    },
  }
);

