# MonsterBurguer POS

Sistema POS (Point of Sale) integral para restaurante de hamburguesas artesanales: toma de pedidos táctil, pantalla de cocina (KDS) en tiempo real mediante Server-Sent Events (SSE), control de inventario descontado por recetas con bloqueos pesimistas, gestión de caja/cobro y panel administrativo con retroalimentación automática.

El sistema nace del documento académico [`Etapa1_Definicion_del_Sistema_Restaurante.docx`](./Etapa1_Definicion_del_Sistema_Restaurante.docx) (Enfoque de Sistemas): cada subsistema del restaurante corresponde a un módulo delimitado en el código, y cada interacción entre ellos es un evento de dominio transaccional auditable.

---

## 🎯 Estado Actual del MVP

El sistema se encuentra implementado como un **MVP funcional de extremo a extremo**:

### ✅ Lo que SÍ incluye el MVP:
- **Autenticación y Seguridad:** Sesiones opacas almacenadas en PostgreSQL con hash SHA-256 en cookies `HttpOnly`, hash de contraseñas con argon2id, protección CSRF por cabecera `Origin` y rate limiting estricto en login.
- **Toma de Pedidos (POS):** Terminal táctil en `/pos` con rail de categorías, grilla de productos, buscador con debounce, ticket en vivo, soporte de pedidos para `MESA` (con control de mesas ocupadas) y `LLEVAR`.
- **Confirmación Atómica:** Descuento de stock en la misma transacción mediante `SELECT ... FOR UPDATE` ordenado por ID (previniendo deadlocks y sobreventas) y creación automática de comanda en cocina.
- **Cocina (KDS) en Tiempo Real:** Pantalla en `/cocina` con diseño oscuro nativo para alta visibilidad, columnas por estado (`PENDIENTE`, `EN_PREPARACION`, `LISTA`, `ENTREGADA`), temporizadores con umbrales de alerta (8 min warning, 12 min grave) y difusión SSE instantánea (≤ 2 s).
- **Caja y Cobro:** Apertura de caja con base en efectivo, cobro con cálculo de cambio en efectivo y propina voluntaria sugerida (máx. 10 % redondeada a la centena), emisión de recibo POS de 80 mm (`@media print`) y arqueo de cierre con cálculo de sobrante/faltante.
- **Inventario y Recetas:** Kardex de movimientos inmutable (`movimiento_inventario`), registro de entradas, ajustes físicos y mermas en `/admin/inventario`, y editor de recetas por producto en `/admin/productos`.
- **Administración y Retroalimentación:** Dashboard gerencial en `/admin` con KPIs en vivo (ventas hoy, ticket promedio, tiempos KDS, ventas por hora) y retroalimentación automática de agotados (al agotarse un ingrediente, sus productos se marcan automáticamente como no disponibles).

### ⏳ Lo que NO incluye el MVP (Backlog diferido para v1.1 / v2.0):
- Anulación de pedidos desde la interfaz de usuario (`POST /pedidos/:id/anular` con reversión automática de stock).
- Pagos mixtos en el mismo cobro (en el MVP actual el cobro valida estrictamente un único método de pago).
- Movimientos manuales de caja durante el turno (`INGRESO` y `RETIRO` de efectivo).
- Pantallas web de administración para creación y edición de categorías y usuarios (se configuran por API y seed).
- Generación de reportes analíticos avanzados con filtro por rango de fechas y exportación a CSV/PDF.
- Emisión de Documento Equivalente Electrónico POS (DEE POS DIAN con CUDE y QR) y Factura Electrónica (diferido a v2.0; el MVP emite un recibo interno no fiscal rotulado conforme a la ley).

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
pnpm test                    # Ejecuta pruebas unitarias de @mb/shared
pnpm --filter api test       # Ejecuta pruebas de integración contra DATABASE_URL_TEST
pnpm lint                    # Linter ESLint en todo el monorepo
pnpm depcruise               # Verifica fronteras modulares (solo imports *.public.ts)
pnpm typecheck               # Comprobación de tipos estricta con tsc --noEmit
```

---

## 📁 Estructura del Repositorio

```
MonsterBurguer/
├── apps/
│   ├── api/                 # Backend NestJS 12
│   │   ├── drizzle/         # Migraciones SQL versionadas (0000..0003)
│   │   ├── src/
│   │   │   ├── config/      # Variables de entorno validadas con Zod
│   │   │   ├── db/          # Script semilla (seed.ts)
│   │   │   ├── health/      # Healthcheck (/health)
│   │   │   ├── modules/     # Módulos del monolito (identidad, pedidos, cocina, etc.)
│   │   │   └── shared-kernel/# DB client, EventBus, OutboxDispatcher, errores
│   │   └── test/            # Pruebas de integración sobre PostgreSQL real
│   └── web/                 # Frontend React 19 + Vite 8
│       └── src/
│           ├── app/         # Shell, layouts y router de navegación por rol
│           ├── components/  # Componentes reutilizables (pos, kds, admin, ui)
│           ├── features/    # Pantallas por módulo (pos, cocina, caja, admin, auth)
│           ├── hooks/       # useEventStream (SSE)
│           └── lib/         # Cliente API, formateadores y utilidades
├── packages/
│   └── shared/              # Paquete compartido @mb/shared
│       └── src/
│           ├── schemas/     # Esquemas de validación Zod (fuente única de verdad)
│           ├── money.ts     # Aritmética pura de dinero en COP (sin floats)
│           ├── fecha-operativa.ts # Lógica de día de negocio (corte 05:00)
│           └── enums.ts     # Enums compartidos de roles, estados y métodos de pago
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
