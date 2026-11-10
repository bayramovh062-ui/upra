import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import { defineConfig, globalIgnores } from 'eslint/config'

export default defineConfig([
  globalIgnores(['dist']),
  {
    files: ['**/*.{js,jsx}'],
    extends: [
      js.configs.recommended,
      reactHooks.configs.flat.recommended,
      reactRefresh.configs.vite,
    ],
    languageOptions: {
      globals: globals.browser,
      parserOptions: { ecmaFeatures: { jsx: true } },
    },
    rules: {
      // Yalnız Fast Refresh (HMR) rahatlığıdır: komponent faylda köməkçi export (məs. fieldClass, calcCommissionCents)
      // olanda həmin fayl dəyişəndə səhifə tam yenilənir. Kodun işləyişinə təsir etmir, ona görə xəta yox, xəbərdarlıqdır.
      'react-refresh/only-export-components': 'warn',
    },
  },
  {
    // Node mühitində işləyən fayllar (Playwright konfiqi və E2E testləri): process, Buffer və s.
    files: ['*.config.js', 'e2e/**/*.{js,jsx}'],
    languageOptions: {
      globals: globals.node,
    },
  },
])
