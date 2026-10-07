# ADR-001: TypeScript Full-Stack (NestJS + React)

## Estado
Aceptado

## Fecha
2026-10-06

## Contexto
El sistema POS MonsterBurguer requiere sincronización rigurosa de tipos entre frontend y backend: contratos de API, esquemas de validación de formularios, definiciones de eventos de dominio y estructuras de datos monetarios. Contar con lenguajes heterogéneos (por ejemplo, backend en Java/Spring o Python/FastAPI con frontend en React) obligaría a duplicar definiciones de esquemas, mantener generadores de código OpenAPI propensos a desincronizaciones y asumir la sobrecarga cognitiva de múltiples toolchains.

## Decisión
Adoptar **TypeScript** de extremo a extremo en todo el monorepo (estricto, sin `any`), utilizando:
- **Backend:** Node.js 24 LTS con NestJS 12.
- **Frontend:** React 19 con Vite 8.
- **Paquete compartido (`@mb/shared`):** Esquemas Zod 4, tipos inferidos, enums y utilidades de dominio puras (aritmética monetaria y fechas operativas).

## Consecuencias

### Positivas
- Compartición directa de tipos y esquemas Zod entre frontend y backend sin capas intermedias ni generadores externos.
- Unificación del ecosistema de dependencias, scripts y herramientas (`pnpm`, `eslint`, `vitest`).
- Menor tiempo de inducción para desarrolladores y agentes de IA al operar bajo una única sintaxis tipada.

### Negativas / Riesgos
- Node.js es single-threaded por proceso para cómputo intensivo; las operaciones bloqueantes deben evitarse.
- Necesidad de compilar TypeScript antes de la ejecución o empaquetado para producción.

### Mitigaciones
- Cómputo intensivo fuera del flujo crítico; operaciones de I/O asíncronas con pool de conexiones PostgreSQL.
- Compilación incremental con `swc` en NestJS y `esbuild`/`rolldown`/`vite` en frontend para builds ultra-rápidos.
