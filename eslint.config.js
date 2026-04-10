import tseslint from 'typescript-eslint'

export default tseslint.config(
  ...tseslint.configs.recommended,
  {
    files: ['src/**/*.ts'],
    languageOptions: {
      parserOptions: {
        ecmaVersion: 2024,
        sourceType: 'module'
      }
    },
    rules: {
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
      '@typescript-eslint/no-explicit-any': 'warn',
      'no-console': 'warn',
      'prefer-const': 'error',
      'no-var': 'error'
    }
  },
  {
    ignores: ['dist/**', 'node_modules/**', 'scripts/**', 'test/**']
  }
)
