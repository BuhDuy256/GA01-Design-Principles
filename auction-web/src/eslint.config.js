import importPlugin from 'eslint-plugin-import';

export default [
  {
    ignores: ['node_modules/**', 'public/js/**', 'public/uploads/**', 'public/images/**'],
  },
  {
    files: ['**/*.js'],
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module',
    },
    plugins: {
      import: importPlugin,
    },
    rules: {
      'import/no-unresolved': 'error',
    },
  },
];
