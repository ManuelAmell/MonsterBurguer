# Documentación del Sistema — MonsterBurguer POS

> **Índice maestro de la documentación técnica, arquitectónica y operativa del proyecto.**  
> Toda la documentación refleja el estado del código fuente real implementado en el repositorio (rama `main`).

---

## 🗺️ Mapa de la Documentación

```
MonsterBurguer/
├── README.md                           # Puesta en marcha rápida, estado del MVP y guía general
├── ARCHITECTURE.md                     # Modelo C4, monolito modular, outbox, SSE y seguridad
├── DESIGN.md                           # Sistema de diseño UI/UX, tokens, paletas y componentes
├── CLAUDE.md                           # Reglas de desarrollo para agentes y programadores
└── docs/
    ├── README.md                       # (Este índice maestro)
    ├── PRD.md                          # Requisitos de producto, alcance del MVP e historias de usuario
    ├── BUSINESS_RULES.md               # Catálogo de reglas de negocio (RN-01..RN-61) y estado real
    ├── API.md                          # Contrato HTTP REST 1:1 y Server-Sent Events (SSE)
    ├── DATA_MODEL.md                   # Modelo relacional (ERD), tablas Drizzle y vistas SQL
    ├── ROADMAP.md                      # Estado de hitos del MVP y backlog técnico
    ├── OPERACION.md                    # Despliegue con Docker Compose, variables de entorno y backups
    ├── DESARROLLO.md                   # Convenciones, guías paso a paso, testing y glosario
    ├── adr/                            # Architectural Decision Records (ADRs)
    │   ├── README.md                   # Índice consolidado de ADRs
    │   ├── 0001-typescript-fullstack.md
    │   ├── 0002-postgresql-como-base-de-datos.md
    │   ├── 0003-drizzle-orm.md
    │   ├── 0004-monolito-modular.md
    │   ├── 0005-eventos-de-dominio-con-outbox-en-postgresql.md
    │   ├── 0006-server-sent-events-sse.md
    │   ├── 0007-sesiones-opacas-en-base-de-datos-con-cookies-httponly.md
    │   ├── 0008-dinero-en-enteros-pesos-cop.md
    │   ├── 0009-cantidades-de-inventario-en-enteros-de-unidad-base.md
    │   ├── 0010-spa-con-react-19-y-vite-8.md
    │   └── 0011-regimen-no-responsable-y-recibo-no-fiscal.md
    ├── critica/                        # Informes de auditoría crítica adversarial
    │   └── arquitectura-seguridad-1.md # Auditoría de arquitectura y seguridad del Hito 1
    ├── entregables-isoft/              # Entregables académicos de Ingeniería de Software (UdeC)
    │   ├── README.md                   # Resumen ejecutivo y guía de entregables
    │   ├── REPORTE.md                  # Reporte de cumplimiento y estado de artefactos
    │   ├── *.docx / *.xlsx             # Documentos Word (Manual, SRS, Arquitectura) y Casos de Uso en Excel
    │   └── *.md                        # Fuentes Markdown con 13 capturas reales de pantalla
    └── verificacion/                   # Informes de verificación de calidad
        ├── contrato-shared.md          # Verificación del contrato tipado de @mb/shared
        ├── hito-0.md                   # Verificación independiente del Hito 0 (Fundaciones)
        ├── kit-ui.md                   # Verificación visual e interactiva del Kit de UI
        └── docs-cambios.md             # Registro de cambios y resolución de discrepancias docs vs. código
```

---

## 📚 Guías Rápidas por Perfil

### Si vas a entender la arquitectura del sistema:
1. Revisa [**ARCHITECTURE.md**](../ARCHITECTURE.md) para conocer el modelo C4, la división de módulos y el flujo transaccional de una venta.
2. Consulta [**docs/adr/README.md**](./adr/README.md) para entender el porqué de cada decisión técnica (Drizzle, Outbox en Postgres, SSE, dinero en enteros COP).

### Si vas a implementar o modificar una funcionalidad:
1. Consulta [**docs/BUSINESS_RULES.md**](./BUSINESS_RULES.md) para verificar el identificador de regla (`RN-xx`) y su estado en el código.
2. Revisa [**docs/API.md**](./API.md) para validar la ruta, método, permisos y esquema Zod de entrada/salida.
3. Revisa [**docs/DATA_MODEL.md**](./DATA_MODEL.md) para consultar las tablas, restricciones e índices en PostgreSQL.
4. Consulta [**docs/DESARROLLO.md**](./DESARROLLO.md) para seguir las convenciones de TypeScript y la guía paso a paso de extensión.

### Si vas a trabajar en la interfaz de usuario (Frontend):
1. Lee [**DESIGN.md**](../DESIGN.md) para aplicar los principios de velocidad táctil, tokens semánticos y componentes de shadcn/ui.
2. Consulta [**CLAUDE.md**](../CLAUDE.md) para conocer las directrices obligatorias de diseño y testing.

### Si vas a operar o desplegar en el restaurante:
1. Lee [**docs/OPERACION.md**](./OPERACION.md) para configurar el archivo `.env`, desplegar con Docker Compose, configurar backups con `pg_dump` y resolver problemas frecuentes.
2. Revisa la tabla de variables de entorno en [**docs/OPERACION.md §3**](./OPERACION.md#3-matriz-de-variables-de-entorno).

### Si vas a auditar calidad o revisar el historial de verificación:
1. Consulta la auditoría crítica en [**docs/critica/arquitectura-seguridad-1.md**](./critica/arquitectura-seguridad-1.md).
2. Consulta los informes de verificación en [**docs/verificacion/**](./verificacion/).
3. Consulta el detalle de inconsistencias corregidas en [**docs/verificacion/docs-cambios.md**](./verificacion/docs-cambios.md).
4. Consulta el reporte consolidado de QA del MVP en [**docs/verificacion/reporte-qa-2026-10-07.md**](./verificacion/reporte-qa-2026-10-07.md).

### Si vas a consultar los entregables académicos (Universidad de Cartagena):
1. Consulta [**docs/entregables-isoft/README.md**](./entregables-isoft/README.md) y [**docs/entregables-isoft/REPORTE.md**](./entregables-isoft/REPORTE.md).
2. Los documentos formales generados en Word y Excel se encuentran en `docs/entregables-isoft/` (*Manual de Usuario*, *Especificación de Requisitos*, *Documento de Arquitectura* y *Casos de Uso*).

