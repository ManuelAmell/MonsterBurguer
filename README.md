# MonsterBurguer POS

Sistema POS (Point of Sale) integral para restaurante de hamburguesas artesanales: toma de pedidos táctil, pantalla de cocina (KDS) en tiempo real mediante Server-Sent Events (SSE), control de inventario descontado por recetas con bloqueos pesimistas, gestión de caja/cobro y panel administrativo con retroalimentación automática.

El sistema nace del documento académico [`Etapa1_Definicion_del_Sistema_Restaurante.docx`](./Etapa1_Definicion_del_Sistema_Restaurante.docx) (Enfoque de Sistemas): cada subsistema del restaurante corresponde a un módulo delimitado en el código, y cada interacción entre ellos es un evento de dominio transaccional auditable.

---

## 🎯 Estado Actual del MVP

El sistema se encuentra implementado como un **MVP funcional de extremo a extremo**:

### ✅ Lo que SÍ incluye el MVP (100% Completado y Verificado):
- **Autenticación y Seguridad:** Sesiones opacas almacenadas en PostgreSQL con hash SHA-256 en cookies `HttpOnly`, hash de contraseñas con argon2id, protección CSRF por cabecera `Origin` y rate limiting estricto en login.
- **Toma de Pedidos (POS):** Terminal táctil en `/pos` con rail de categorías, grilla de productos, buscador rápido con atajo `/` y debounce de 200 ms, ticket en vivo, soporte de pedidos para `MESA` (con monitor de ocupadas) y `LLEVAR`.
- **Confirmación Atómica:** Descuento de stock en la misma transacción mediante `SELECT ... FOR UPDATE` ordenado por ID (previniendo deadlocks y sobreventas) y creación automática de comanda en cocina.
- **Cocina (KDS) en Tiempo Real:** Pantalla en `/cocina` con diseño oscuro nativo para alta visibilidad, columnas por estado (`PENDIENTE`, `EN_PREPARACION`, `LISTA`, `ENTREGADA`), temporizadores con umbrales de alerta (8 min warning, 12 min grave), difusión SSE instantánea (≤ 2 s) y función "Deshacer" en ≤ 10 s (RN-22).
- **Anulación de Pedidos:** Endpoint `POST /pedidos/:id/anular` protegido para rol `ADMIN` con motivo obligatorio (RN-50), reversión de stock en comanda pendiente y reclasificación a merma si ya estaba en cocina.
- **Caja Completa y Cobro Mixto:** Apertura con base en efectivo, cobro con 1 a 3 métodos de pago (`EFECTIVO`, `TARJETA`, `TRANSFERENCIA`) con atajo "Resto en...", propina voluntaria sugerida (10% redondeada), emisión de recibo POS de 80 mm (`@media print`), movimientos manuales de caja (`INGRESO` y `RETIRO`, RN-46), historial de cierres y arqueo ciego con conteo exclusivo de efectivo en el esperado (RN-47).
- **Inventario y Recetas:** Kardex de movimientos inmutable (`movimiento_inventario`), registro de entradas, ajustes físicos y mermas en `/admin/inventario` con paginación keyset determinista (`(nombre, id)` con botón accesible "Cargar más"), y editor de recetas por producto en `/admin/productos`.
- **Administración y Analítica:** Dashboard gerencial en `/admin` con KPIs en vivo, gestión completa de usuarios y cambio de claves (`/admin/usuarios`), gestión de categorías (`/admin/categorias`), edición de parámetros del negocio (`/admin/configuracion`), módulo de reportes analíticos de ventas por rango con exportación a CSV UTF-8 (`/admin/reportes`) y widget de alertas operativas.
- **Accesibilidad WAI-ARIA:** Trampa de foco accesible (`useFocusTrap`) en todos los diálogos (`Dialog`, `AlertDialog`, `Sheet`) con ciclado de `Tab`/`Shift+Tab`, cierre con `Escape` y retorno del foco al disparador original.
- **Endurecimiento Operativo:** Script de respaldo automatizado [`ops/backup.sh`](./ops/backup.sh) con compresión `pg_dump -F c -b`, retención de 30 días y flag `--verify` para pruebas de restauración en base temporal.
- **Pruebas Automatizadas:** 314 pruebas unitarias y de integración pasando al 100%, y suite E2E de Playwright sobre Chrome real (7 specs, 13 pruebas automatizadas).

### ⏳ Lo que NO incluye el MVP (Backlog diferido a v2.0):
- Emisión de Documento Equivalente Electrónico POS (DEE POS DIAN con CUDE y QR) y Factura Electrónica de Venta (el MVP emite recibos no fiscales conforme al Art. 616-1 del E.T. y el régimen no responsable).
- Integración directa con pasarelas de pago online externas (PayU, Wompi, datáfonos integrados).
- Programa de fidelización de clientes con acumulación de puntos.

---

## 🛠️ Stack Tecnológico

Monorepo **TypeScript** de extremo a extremo:
- **Backend:** Node.js 24 LTS · NestJS 12 · Drizzle ORM (`drizzle-kit`) · Zod 4 · Logger Pino (`nestjs-pino`).
- **Base de Datos:** PostgreSQL 17 (desarrollo local) / compatible PostgreSQL 18 (producción Docker).
- **Frontend:** React 19 · Vite 8 · React Router 8 · Tailwind CSS v4 · shadcn/ui · Lucide Icons · TanStack Query.
- **Tiempo Real:** Server-Sent Events (SSE) nativo con reconexión y `Last-Event-ID`.
- **Paquete Compartido:** `@mb/shared` (esquemas Zod 4, tipos inferidos, aritmética monetaria en COP y fechas operativas).
- **Calidad y Pruebas:** Vitest 5 · base de datos de test PostgreSQL dedicada (`DATABASE_URL_TEST`) · ESLint · `dependency-cruiser`.
- **Despliegue e Infra:** Docker Compose · Nginx Alpine (Reverse Proxy y estáticos) · GitHub Actions.

---

## 🚀 Puesta en Marcha Local (Desarrollo)

### 1. Requisitos Previos
- [Node.js 24 LTS](https://nodejs.org/) instalado.
- [pnpm](https://pnpm.io/) v9 o superior (`corepack enable && corepack prepare pnpm@latest --activate`).
- [PostgreSQL 17](https://www.postgresql.org/) instalado localmente (o Docker para levantar la base de datos).

### 2. Configuración de la Base de Datos Local
En PostgreSQL local, crear el rol de desarrollo `mb` y las bases de datos para desarrollo y pruebas:

```sql
CREATE ROLE mb WITH LOGIN PASSWORD 'mb_dev_pass' CREATEDB;
CREATE DATABASE monsterburguer OWNER mb;
CREATE DATABASE monsterburguer_test OWNER mb;
```

*(Alternativamente, puedes levantar únicamente la base de datos con Docker: `docker compose up -d postgres`).*

### 3. Configuración del Entorno
Copiar el archivo de variables de entorno de la API:

```bash
cp apps/api/.env.example apps/api/.env
```

*(El archivo `apps/api/.env` ya viene preconfigurado para conectar con `postgres://mb:mb_dev_pass@localhost:5432/monsterburguer` y `monsterburguer_test`).*

### 4. Instalación de Dependencias
```bash
pnpm install
```

### 5. Aplicar Migraciones y Cargar Datos Semilla
```bash
# Aplica las migraciones Drizzle sobre la base de datos local
pnpm --filter api db:migrate

# Carga los usuarios demo, catálogo de hamburguesas e inventario inicial (idempotente)
pnpm --filter api db:seed
```

### 6. Iniciar los Servidores de Desarrollo
```bash
pnpm dev
```
- **Backend API:** `http://localhost:3000` (Salud: `http://localhost:3000/api/v1/health`)
- **Frontend Web:** `http://localhost:5173`

---

## 🔑 Credenciales Demo de Prueba

Cargadas automáticamente por el script de semilla (`seed.ts`):

| Usuario | Contraseña | Rol asignado | Pantalla de inicio |
|---|---|:---:|---|
| `admin` | `admin123` | **`ADMIN`** | Dashboard (`/admin`), Menú e Inventario |
| `caja1` | `caja1234` | **`CAJERO`** | Terminal POS (`/pos`) y Caja (`/caja`) |
| `cocina1` | `cocina1234` | **`COCINA`** | Pantalla KDS (`/cocina`) |

---

## 📋 Comandos Frecuentes

```bash
# Desarrollo
pnpm dev                     # Inicia API (:3000) y Web (:5173) en paralelo
pnpm build                   # Construye todos los paquetes y aplicaciones

# Base de datos
pnpm --filter api db:generate# Genera nueva migración SQL a partir del esquema Drizzle
pnpm --filter api db:migrate # Aplica migraciones pendientes en PostgreSQL
pnpm --filter api db:seed    # Carga datos semilla de prueba

# Pruebas y Calidad
pnpm test                    # Pruebas unitarias de @mb/shared (159 tests)
pnpm --filter api test       # Pruebas de integración sobre PostgreSQL (155 tests)
pnpm --filter web test:e2e   # Pruebas E2E de Playwright en navegador real (13 tests)
pnpm lint                    # Linter ESLint en todo el monorepo (0 advertencias)
pnpm depcruise               # Verifica fronteras modulares (solo imports *.public.ts)
pnpm typecheck               # Comprobación de tipos estricta con tsc --noEmit

# Operación y Backups
./ops/backup.sh              # Genera backup comprimido pg_dump en ./backups
./ops/backup.sh --verify     # Genera backup y valida restauración en BD temporal
```

---

## 📁 Estructura del Repositorio

```
MonsterBurguer/
├── apps/
│   ├── api/                 # Backend NestJS 12
│   │   ├── drizzle/         # Migraciones SQL versionadas (0000..0007)
│   │   ├── src/
│   │   │   ├── config/      # Variables de entorno validadas con Zod
│   │   │   ├── db/          # Script semilla (seed.ts)
│   │   │   ├── health/      # Healthcheck (/health)
│   │   │   ├── modules/     # Módulos del monolito (identidad, pedidos, cocina, etc.)
│   │   │   └── shared-kernel/# DB client, EventBus, OutboxDispatcher, errores
│   │   └── test/            # Pruebas de integración sobre PostgreSQL real
│   └── web/                 # Frontend React 19 + Vite 8
│       ├── e2e/             # Pruebas de integración End-to-End con Playwright
│       └── src/
│           ├── app/         # Shell, layouts y router de navegación por rol
│           ├── components/  # Componentes reutilizables (pos, kds, admin, ui)
│           ├── features/    # Pantallas por módulo (pos, cocina, caja, admin, auth)
│           ├── hooks/       # useEventStream (SSE) y useFocusTrap
│           └── lib/         # Cliente API, formateadores y utilidades
├── packages/
│   └── shared/              # Paquete compartido @mb/shared
│       └── src/
│           ├── schemas/     # Esquemas de validación Zod (fuente única de verdad)
│           ├── money.ts     # Aritmética pura de dinero en COP (sin floats)
│           ├── fecha-operativa.ts # Lógica de día de negocio (corte 05:00)
│           └── enums.ts     # Enums compartidos de roles, estados y métodos de pago
├── ops/                     # Scripts de infraestructura y operaciones (backup.sh)
├── docs/                    # Documentación técnica, arquitectura, datos y guías
│   ├── README.md            # Índice maestro de documentación
│   ├── API.md               # Contrato HTTP REST 1:1 y Server-Sent Events
│   ├── DATA_MODEL.md        # Modelo relacional (ERD) y diccionario de datos
│   ├── BUSINESS_RULES.md    # Reglas de negocio (RN-01..RN-61) y estado de implementación
│   ├── ROADMAP.md           # Estado de hitos y backlog técnico
│   ├── OPERACION.md         # Guía de despliegue con Docker Compose, variables y backups
│   ├── DESARROLLO.md        # Guía para desarrolladores, convenciones y glosario
│   ├── adr/                 # Architectural Decision Records (ADR-001..ADR-011)
│   ├── critica/             # Auditoría crítica adversarial de arquitectura y seguridad
│   ├── entregables-isoft/   # Entregables académicos UdeC (Word, Excel y fuentes Markdown)
│   └── verificacion/        # Informes de verificación de calidad y docs-cambios.md
├── docker-compose.yml       # Orquestación de producción local (PostgreSQL, API, Nginx)
├── ARCHITECTURE.md          # Arquitectura técnica, C4 en Mermaid, outbox y seguridad
├── DESIGN.md                # Sistema de diseño UI/UX y especificación de interfaces
└── CLAUDE.md                # Reglas operativas para agentes de IA y desarrolladores
```

---

## 📖 Enlaces a la Documentación Completa

- [**Índice Maestro de Documentación**](./docs/README.md)
- [**Arquitectura del Sistema (C4 y Outbox)**](./ARCHITECTURE.md)
- [**Decisiones de Arquitectura (ADR)**](./docs/adr/README.md)
- [**Contrato de API REST y SSE**](./docs/API.md)
- [**Modelo de Datos y ERD**](./docs/DATA_MODEL.md)
- [**Reglas de Negocio (RN-01..RN-61)**](./docs/BUSINESS_RULES.md)
- [**Roadmap y Backlog Técnico**](./docs/ROADMAP.md)
- [**Guía de Operación y Despliegue**](./docs/OPERACION.md)
- [**Guía de Desarrollo y Glosario**](./docs/DESARROLLO.md)
- [**Sistema de Diseño UI/UX**](./DESIGN.md)
- [**Reglas para Agentes (CLAUDE.md)**](./CLAUDE.md)
