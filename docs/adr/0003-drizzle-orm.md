# ADR-003: Drizzle ORM como Capa de Acceso a Datos

## Estado
Aceptado

## Fecha
2026-10-06

## Contexto
El backend requiere interactuar con PostgreSQL con seguridad de tipos estricta y máximo control sobre el SQL generado. Alternativas tradicionales como TypeORM presentan sobrecarga de abstracción en transacciones complejas, y Prisma introduce un binario Rust (Prisma Engine), sobrecoste de memoria y latencia, y dificultades para emitir bloqueos pesimistas granulares (`FOR UPDATE SKIP LOCKED`, transacciones interactivas directas en el connection pool).

## Decisión
Utilizar **Drizzle ORM** (`drizzle-orm`) y **drizzle-kit**:
- Esquemas declarados en TypeScript puro (`*.schema.ts`) por módulo.
- Migraciones SQL versionadas y legibles generadas con `drizzle-kit generate` y aplicadas con `drizzle-kit migrate`.
- Uso explícito de transacciones (`db.transaction(async (tx) => ...)`) y métodos nativos `.for('update')`.

## Consecuencias

### Positivas
- Cero overhead de binarios externos; cliente ligero sobre `node-postgres` (`pg`).
- SQL transparente y predecible; no genera consultas N+1 inesperadas.
- Soporte nativo para cláusulas avanzadas de Postgres (`FOR UPDATE`, `SKIP LOCKED`, `ON CONFLICT`, `RETURNING`).
- Migraciones en archivos SQL estándar auditables (`apps/api/drizzle/*.sql`).

### Negativas / Riesgos
- Al ser SQL-like, requiere escribir manualmente joins y transformaciones en lugar de navegación de relaciones mágicas en memoria.
- Requiere disciplina para propagar la instancia de transacción `tx` (tipo `Tx` / `Executor`) en operaciones multi-tabla.

### Mitigaciones
- Tipado estricto `Executor = Db | Tx` en `apps/api/src/shared-kernel/db/db.ts`.
- Pruebas de integración sobre base de datos real que verifican atomicidad y reversión ante errores.
