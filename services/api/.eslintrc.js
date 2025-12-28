/**
 * MSSanté API - Configuration ESLint
 * 
 * Configuration pour Node.js + Express avec Jest
 * Compatible avec Prettier pour le formatage
 */

module.exports = {
  // Environnement d'exécution
  env: {
    node: true,
    es2022: true,
    jest: true,
  },

  // Configuration de base
  extends: [
    'eslint:recommended',
  ],

  // Parser et options
  parserOptions: {
    ecmaVersion: 2022,
    sourceType: 'module',
  },

  // Variables globales personnalisées
  globals: {
    // Ajouter ici les variables globales si nécessaire
  },

  // Règles ESLint
  rules: {
    // ===========================================
    // Erreurs possibles
    // ===========================================
    'no-console': 'off', // Autorisé pour les logs serveur
    'no-debugger': 'error',
    'no-duplicate-imports': 'error',
    'no-template-curly-in-string': 'warn',
    'no-unreachable-loop': 'error',
    'no-use-before-define': ['error', { functions: false, classes: true }],

    // ===========================================
    // Bonnes pratiques
    // ===========================================
    'array-callback-return': 'error',
    'block-scoped-var': 'error',
    'consistent-return': 'error',
    'curly': ['error', 'all'],
    'default-case': 'warn',
    'default-case-last': 'error',
    'default-param-last': 'error',
    'dot-notation': 'error',
    'eqeqeq': ['error', 'always', { null: 'ignore' }],
    'no-alert': 'error',
    'no-caller': 'error',
    'no-else-return': ['error', { allowElseIf: false }],
    'no-empty-function': ['error', { allow: ['arrowFunctions'] }],
    'no-eval': 'error',
    'no-extend-native': 'error',
    'no-extra-bind': 'error',
    'no-floating-decimal': 'error',
    'no-implied-eval': 'error',
    'no-invalid-this': 'error',
    'no-iterator': 'error',
    'no-labels': 'error',
    'no-lone-blocks': 'error',
    'no-loop-func': 'error',
    'no-multi-str': 'error',
    'no-new': 'error',
    'no-new-func': 'error',
    'no-new-wrappers': 'error',
    'no-octal-escape': 'error',
    'no-param-reassign': ['error', { props: false }],
    'no-proto': 'error',
    'no-return-assign': ['error', 'always'],
    'no-return-await': 'error',
    'no-script-url': 'error',
    'no-self-compare': 'error',
    'no-sequences': 'error',
    'no-throw-literal': 'error',
    'no-unmodified-loop-condition': 'error',
    'no-unused-expressions': ['error', { allowShortCircuit: true, allowTernary: true }],
    'no-useless-call': 'error',
    'no-useless-concat': 'error',
    'no-useless-return': 'error',
    'prefer-promise-reject-errors': 'error',
    'prefer-regex-literals': 'error',
    'radix': 'error',
    'require-await': 'error',
    'yoda': 'error',

    // ===========================================
    // Variables
    // ===========================================
    'no-shadow': ['error', { builtinGlobals: false, hoist: 'functions' }],
    'no-undef-init': 'error',
    'no-unused-vars': ['error', { 
      argsIgnorePattern: '^_',
      varsIgnorePattern: '^_',
      caughtErrorsIgnorePattern: '^_'
    }],

    // ===========================================
    // Style (compatible Prettier)
    // ===========================================
    // Note: Les règles de formatage sont gérées par Prettier
    // Ces règles ne concernent que ce que Prettier ne gère pas
    'camelcase': ['warn', { 
      properties: 'never',
      ignoreDestructuring: true,
      allow: ['^UNSAFE_', '^_']
    }],
    'capitalized-comments': 'off',
    'consistent-this': ['error', 'self'],
    'func-name-matching': 'error',
    'func-names': ['warn', 'as-needed'],
    'func-style': ['error', 'declaration', { allowArrowFunctions: true }],
    'id-denylist': ['error', 'err', 'e', 'cb', 'callback'],
    'id-length': ['warn', { 
      min: 2, 
      max: 40,
      exceptions: ['i', 'j', 'k', 'x', 'y', 'z', '_', 'a', 'b']
    }],
    'max-depth': ['warn', 4],
    'max-lines': ['warn', { max: 500, skipBlankLines: true, skipComments: true }],
    'max-lines-per-function': ['warn', { max: 100, skipBlankLines: true, skipComments: true }],
    'max-nested-callbacks': ['error', 4],
    'max-params': ['warn', 5],
    'new-cap': ['error', { newIsCap: true, capIsNew: false }],
    'no-array-constructor': 'error',
    'no-bitwise': 'warn',
    'no-continue': 'off',
    'no-inline-comments': 'off',
    'no-lonely-if': 'error',
    'no-multi-assign': 'error',
    'no-negated-condition': 'warn',
    'no-nested-ternary': 'error',
    'no-new-object': 'error',
    'no-plusplus': ['error', { allowForLoopAfterthoughts: true }],
    'no-underscore-dangle': ['warn', { 
      allowAfterThis: true,
      allowAfterSuper: true,
      allow: ['_id', '__dirname', '__filename']
    }],
    'no-unneeded-ternary': 'error',
    'one-var': ['error', 'never'],
    'operator-assignment': ['error', 'always'],
    'prefer-exponentiation-operator': 'error',
    'prefer-object-spread': 'error',
    'spaced-comment': ['error', 'always', { 
      markers: ['/'],
      exceptions: ['-', '+', '*']
    }],

    // ===========================================
    // ECMAScript 6+
    // ===========================================
    'arrow-body-style': ['error', 'as-needed'],
    'no-confusing-arrow': ['error', { allowParens: true }],
    'no-duplicate-imports': 'error',
    'no-useless-computed-key': 'error',
    'no-useless-constructor': 'error',
    'no-useless-rename': 'error',
    'no-var': 'error',
    'object-shorthand': ['error', 'always'],
    'prefer-arrow-callback': ['error', { allowNamedFunctions: true }],
    'prefer-const': ['error', { destructuring: 'all' }],
    'prefer-destructuring': ['warn', {
      VariableDeclarator: { array: false, object: true },
      AssignmentExpression: { array: false, object: false }
    }],
    'prefer-numeric-literals': 'error',
    'prefer-rest-params': 'error',
    'prefer-spread': 'error',
    'prefer-template': 'error',
    'require-yield': 'error',
    'symbol-description': 'error',

    // ===========================================
    // Node.js spécifique
    // ===========================================
    'callback-return': ['error', ['callback', 'cb', 'next', 'done']],
    'global-require': 'warn',
    'handle-callback-err': ['error', '^(err|error)$'],
    'no-buffer-constructor': 'error',
    'no-mixed-requires': 'error',
    'no-new-require': 'error',
    'no-path-concat': 'error',
    'no-process-exit': 'warn',
  },

  // Surcharges par fichier/dossier
  overrides: [
    // Fichiers de test
    {
      files: ['**/*.test.js', '**/*.spec.js', '**/tests/**/*.js'],
      env: {
        jest: true,
      },
      rules: {
        'no-unused-expressions': 'off',
        'max-lines-per-function': 'off',
        'max-nested-callbacks': ['error', 6],
        'id-length': 'off',
      },
    },
    // Fichiers de configuration
    {
      files: ['*.config.js', '.eslintrc.js', 'jest.config.js'],
      rules: {
        'no-unused-vars': 'off',
        'global-require': 'off',
      },
    },
    // Scripts et migrations
    {
      files: ['scripts/**/*.js', 'migrations/**/*.js', 'seeds/**/*.js'],
      rules: {
        'no-console': 'off',
        'no-process-exit': 'off',
      },
    },
    // Fichiers de routes Express
    {
      files: ['**/routes/**/*.js'],
      rules: {
        'max-lines-per-function': ['warn', { max: 150, skipBlankLines: true, skipComments: true }],
      },
    },
  ],

  // Fichiers/dossiers à ignorer
  ignorePatterns: [
    'node_modules/',
    'dist/',
    'build/',
    'coverage/',
    '*.min.js',
    'logs/',
    'data/',
  ],

  // Paramètres additionnels
  settings: {
    // Configuration pour les imports (si utilisation de eslint-plugin-import)
  },

  // Reporter les erreurs non utilisées
  reportUnusedDisableDirectives: true,
};