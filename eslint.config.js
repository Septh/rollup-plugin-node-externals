import { defineConfig } from 'eslint/config'
import js from '@eslint/js'
import ts from 'typescript-eslint'
import globals from 'globals'

export default defineConfig({
    files: [ "source/*.ts" ],
    plugins: { js },
    extends: [
        js.configs.recommended,
        ts.configs.recommendedTypeChecked
    ],
    languageOptions: {
        globals: globals.node,
        parserOptions: {
            projectService: true
        }
    },
    rules: {
        "no-debugger": "off",
        "no-unused-vars": "off",
        "prefer-const": "warn",
        "no-inner-declarations": "off",
        "no-cond-assign": "off",
        "@typescript-eslint/no-unused-vars": "off",
    }
})
