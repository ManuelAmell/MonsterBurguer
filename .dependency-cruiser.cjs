/** @type {import('dependency-cruiser').IConfiguration} */
module.exports = {
  forbidden: [
    {
      name: 'modules-only-import-public',
      comment:
        'Un módulo en apps/api/src/modules/X solo puede importar *.public.ts de otro módulo Y (ARCHITECTURE.md §3)',
      severity: 'error',
      from: {
        path: '^apps/api/src/modules/([^/]+)/',
      },
      to: {
        path: '^apps/api/src/modules/([^/]+)/',
        pathNot: [
          '^apps/api/src/modules/$1/',
          '\\.public(\\.(ts|js|d\\.ts))?$',
        ],
      },
    },
    {
      name: 'shared-kernel-not-import-modules',
      comment:
        'shared-kernel no debe importar de ningún módulo en apps/api/src/modules (ARCHITECTURE.md §3)',
      severity: 'error',
      from: {
        path: '^apps/api/src/shared-kernel/',
      },
      to: {
        path: '^apps/api/src/modules/',
      },
    },
    {
      name: 'no-circular',
      comment: 'Dependencias circulares prohibidas',
      severity: 'warn',
      from: {},
      to: {
        circular: true,
      },
    },
  ],
  options: {
    doNotFollow: {
      path: 'node_modules',
    },
    tsPreCompilationDeps: true,
    tsConfig: {
      fileName: 'tsconfig.base.json',
    },
    enhancedResolveOptions: {
      exportsFields: ['exports'],
      conditionNames: ['import', 'require', 'node', 'default'],
      extensions: ['.ts', '.tsx', '.js', '.jsx', '.json'],
    },
    reporterOptions: {
      text: {
        highlightFocused: true,
      },
    },
  },
};
