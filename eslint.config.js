import js from '@eslint/js';
import prettier from 'eslint-config-prettier';
import tseslint from 'typescript-eslint';

/**
 * Flat config, applied across every workspace from the repo root.
 *
 * Type-aware linting is on (`recommendedTypeChecked`): without type information the
 * rules that actually catch bugs in a strict codebase — floating promises, unsafe
 * `any` propagation, misused thenables — cannot run at all.
 */
export default tseslint.config(
  {
    ignores: [
      '**/node_modules/**',
      '**/dist/**',
      '**/build/**',
      '**/coverage/**',
      '**/.expo/**',
      'apps/backend/drizzle/**',
    ],
  },

  js.configs.recommended,
  ...tseslint.configs.recommendedTypeChecked,

  {
    languageOptions: {
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
    rules: {
      // CLAUDE.md: no `any` without a comment explaining why. The lint rule is the
      // enforcement; the comment is what earns the disable.
      '@typescript-eslint/no-explicit-any': 'error',

      // Nothing fails silently.
      '@typescript-eslint/no-floating-promises': 'error',
      '@typescript-eslint/no-misused-promises': 'error',

      // An unused variable in strict TypeScript is nearly always a half-finished edit.
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],

      '@typescript-eslint/consistent-type-imports': [
        'error',
        { prefer: 'type-imports', fixStyle: 'inline-type-imports' },
      ],

      // Secrets and config come from the validated config module, never ad hoc.
      // The backend's config module is the one legitimate reader and opts out locally.
      'no-restricted-properties': [
        'error',
        {
          object: 'process',
          property: 'env',
          message:
            'Read configuration through the validated config module, not process.env directly.',
        },
      ],

      'no-console': ['error', { allow: ['warn', 'error'] }],
      eqeqeq: ['error', 'always'],
      'prefer-const': 'error',
    },
  },

  // Plain JavaScript config files sit outside any tsconfig, so type-aware rules
  // cannot run against them.
  {
    files: ['**/*.js', '**/*.cjs', '**/*.mjs'],
    ...tseslint.configs.disableTypeChecked,
  },

  // Metro and Babel configs must stay CommonJS — the React Native toolchain loads
  // them with `require`, regardless of what the root package.json says about ESM.
  {
    files: ['apps/mobile/*.config.js', '**/*.cjs'],
    languageOptions: {
      sourceType: 'commonjs',
      globals: {
        __dirname: 'readonly',
        __filename: 'readonly',
        module: 'writable',
        require: 'readonly',
        process: 'readonly',
      },
    },
    rules: {
      '@typescript-eslint/no-require-imports': 'off',
    },
  },

  // Tests legitimately hand deliberately-malformed values to schemas, and reach for
  // non-null assertions on fixtures they just constructed.
  {
    files: ['**/*.test.ts', '**/*.spec.ts', '**/test/**/*.ts'],
    rules: {
      '@typescript-eslint/no-non-null-assertion': 'off',
      '@typescript-eslint/no-unsafe-assignment': 'off',
      '@typescript-eslint/no-unsafe-argument': 'off',
    },
  },

  // Must stay last: switches off every stylistic rule Prettier already owns.
  prettier,
);
