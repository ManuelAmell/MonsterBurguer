# Guía de Desarrollo — MonsterBurguer POS

> **Manual de desarrollo, convenciones arquitectónicas, guías de extensión del sistema y glosario del dominio.**

---

## 1. Convenciones del Código y Estándares

### 1.1. Tipado Estricto y Calidad
- **TypeScript estricto:** Configuración estricta en todo el monorepo. Prohibido terminantemente el uso de `: any`, `as any` o `<any>`.
- **Validación única con Zod:** Los contratos de entrada y salida se definen en `packages/shared/src/schemas/`. Prohibido duplicar esquemas de validación entre frontend y backend.
- **Sin `console.log`:** El backend emite logs estructurados en formato JSON utilizando el logger inyectado Pino (`nestjs-pino`). Los scripts de desarrollo o inicialización (`seed.ts`) pueden usar `console.info` / `console.error`.

### 1.2. Idioma y Nomenclatura
- **Dominio en español:** Entidades de negocio, métodos de dominio y nombres de tablas en español (`Pedido`, `Comanda`, `confirmar()`, `cobrar()`, `sesion_caja`, `receta_item`).
- **Sufijos técnicos en inglés:** Patrones técnicos y artefactos de arquitectura (`PedidosService`, `pedidos.controller.ts`, `identidad.repository.ts`, `auth.guards.ts`).
- **Transformación de casos:**
  - Base de datos relacional: `snake_case` en singular (`pedido_item`, `fecha_operativa`).
  - Código TypeScript y JSON en la API: `camelCase` (`pedidoItem`, `fechaOperativa`).
  - Textos de interfaz: Español (Colombia), centralizados en `apps/web/src/i18n/es.ts`.

### 1.3. Dinero y Magnitudes Físicas
- **Dinero:** Siempre en números enteros en pesos colombianos (**COP**). Cualquier cálculo de totales, bases imponibles, impuestos o propinas debe realizarse invocando exclusivamente las funciones de `@mb/shared/money.ts`.
- **Inventario:** Cantidades enteras en unidad base (`G`, `ML`, `UND`). Prohibido almacenar fracciones decimales de kilogramos o litros. Costos unitarios almacenados en milésimas de peso COP (COP × 1.000).

### 1.4. Manejo de Tiempos y Zonas Horarias
- Las columnas de fecha y hora se declaran como `timestamp with time zone` (`timestamptz`) en PostgreSQL y se operan como objetos `Date` en UTC en el servidor.
- La presentación en pantalla y los agrupamientos diarios en vistas SQL se convierten a `America/Bogota`.
- La lógica de negocio diaria se rige por la **Fecha Operativa** (`YYYY-MM-DD`, de 05:00 a 04:59 del día siguiente, ver RN-16).

---

## 2. Fronteras Modulares y Reglas de Dependencia

El backend (`apps/api`) es un monolito modular verificado por `dependency-cruiser` (`pnpm depcruise`):

```
apps/api/src/
├── shared-kernel/           # Núcleo compartido (db, events, config, errors, validation)
└── modules/
    ├── identidad/
    ├── catalogo/
    ├── inventario/
    ├── clientes/
    ├── pedidos/
    ├── cocina/
    ├── caja/
    ├── administracion/
    └── realtime/
```

### Reglas de Importación Obligatorias
1. **Regla de la Fachada Pública:** Un módulo **únicamente** puede importar de otro módulo su archivo `*.public.ts` (por ejemplo, `pedidos` solo importa de cocina `import { CocinaPublicService } from '../cocina/cocina.public';`).
2. **Propiedad de Tablas:** Cada módulo solo ejecuta consultas sobre sus propias tablas. Si un módulo requiere datos de otro, invoca un método de su servicio público.
3. **El Shared-Kernel es Aislado:** `shared-kernel/` no puede importar nada de ningún módulo de `modules/`.
4. **Administración y Vistas:** El módulo `administracion` no consulta tablas de otros módulos de forma directa; accede exclusivamente a través de las vistas SQL de reportes (`v_ventas_*`, `v_tiempos_cocina`, `v_stock_alertas`).

---

## 3. Guías Paso a Paso para Nuevos Desarrollos

### 3.1. Cómo Agregar un Nuevo Endpoint

1. **Definir Esquemas Zod en `@mb/shared`:**
   En `packages/shared/src/schemas/<modulo>.ts`, declarar el esquema de entrada y tipos inferidos:
   ```ts
   export const actualizarNotaSchema = z.object({
     nota: z.string().max(200, 'La nota no puede superar 200 caracteres').optional(),
   });
   export type ActualizarNotaInput = z.infer<typeof actualizarNotaSchema>;
   ```
   Re-exportar en `packages/shared/src/index.ts`.

2. **Implementar en el Controlador:**
   En `apps/api/src/modules/<modulo>/<modulo>.controller.ts`:
   ```ts
   @Roles('ADMIN', 'CAJERO')
   @Patch(':id/nota')
   async actualizarNota(
     @Param('id', IdPipe) id: string,
     @Body(new ZodPipe(actualizarNotaSchema)) body: ActualizarNotaInput,
   ) {
     return this.servicio.actualizarNota(id, body.nota);
   }
   ```

3. **Implementar Caso de Uso en el Servicio:**
   En `<modulo>.service.ts`, ejecutar la validación de negocio, mutación y publicación de eventos si aplica.

---

### 3.2. Cómo Crear un Nuevo Módulo Backend

1. Crear la carpeta en `apps/api/src/modules/<nuevo-modulo>/`.
2. Crear los archivos base:
   - `<modulo>.schema.ts`: Definición de tablas Drizzle.
   - `<modulo>.repository.ts`: Métodos de acceso a base de datos.
   - `<modulo>.service.ts`: Casos de uso y transacciones.
   - `<modulo>.controller.ts`: Endpoints HTTP REST y pipes Zod.
   - `<modulo>.module.ts`: Declaración del módulo NestJS.
   - `<modulo>.public.ts`: Fachada pública exportando servicios e interfaces permitidas para consumo externo.
3. Registrar el módulo en `apps/api/src/app.module.ts`.
4. Ejecutar `pnpm depcruise` para verificar que no se violaron fronteras.

---

### 3.3. Cómo Crear y Aplicar una Migración de Base de Datos

1. Modificar o crear la definición de tabla en el archivo `<modulo>.schema.ts`.
2. Generar el archivo SQL de migración:
   ```bash
   pnpm --filter api db:generate
   ```
3. Revisar el archivo generado en `apps/api/drizzle/NNNN_nombre.sql` asegurando que las restricciones `CHECK`, `UNIQUE` e índices sean correctos.
4. Aplicar la migración localmente:
   ```bash
   pnpm --filter api db:migrate
   ```

---

### 3.4. Cómo Agregar una Nueva Pantalla en el Frontend

1. **Definir la Ruta:**
   En `apps/web/src/features/<feature>/routes.tsx`:
   ```tsx
   export const miFeatureRoutes: RouteObject[] = [
     {
       path: 'mi-ruta',
       element: (
         <RequiereRol roles={['ADMIN']}>
           <MiNuevaPagina />
         </RequiereRol>
       ),
     },
   ];
   ```
2. **Consultas con TanStack Query:**
   Crear hook de consulta consumiendo el cliente centralizado `apiClient` (`apps/web/src/lib/api.ts`):
   ```tsx
   export function useDatos() {
     return useQuery({
       queryKey: ['mi-recurso'],
       queryFn: () => apiClient.get<MiRecurso[]>('/api/v1/mi-recurso'),
     });
   }
   ```
3. **Invalidación por Eventos SSE:**
   En `apps/web/src/hooks/use-event-stream.ts`, suscribir la clave de query al evento en tiempo real correspondiente.
4. **Diseño Visual:**
   Utilizar tokens semánticos de Tailwind v4 y componentes shadcn/ui (`Button`, `Card`, `Dialog`, `Input`, `StatusBadge`). Prohibido usar colores hex crudos o emojis como iconos (solo `lucide-react`).

---

## 4. Estrategia de Pruebas (Testing)

### 4.1. Pruebas Unitarias
- **Herramienta:** Vitest.
- **Ubicación:** `*.test.ts` / `*.spec.ts`.
- **Alcance:** Funciones puras de cálculo (`money.ts`), lógica de fecha operativa (`fecha-operativa.ts`), validación de esquemas Zod y máquinas de estado en memoria.
- **Comando:**
  ```bash
  pnpm test
  ```

### 4.2. Pruebas de Integración con Base de Datos Real
- **Herramienta:** Vitest + PostgreSQL real.
- **Configuración:** Variable de entorno `DATABASE_URL_TEST` (apunta a la base de datos `monsterburguer_test`).
- **Regla estricta:** Prohibido mockear la base de datos en pruebas de integración. Los tests deben verificar transacciones reales, bloqueos pesimistas, claves foráneas y despacho del outbox.
- **Comando:**
  ```bash
  pnpm --filter api test
  ```

### 4.3. Verificación de Tipos y Fronteras
Antes de cada confirmación o entrega:
```bash
pnpm lint           # ESLint sobre todo el monorepo
pnpm depcruise      # Verificación de fronteras modulares
pnpm typecheck      # Verificación tsc sin emisión en todos los paquetes
```

### 4.4. Pruebas End-to-End (E2E) con Playwright
- **Herramienta:** Playwright Test ejecutando sobre Google Chrome instalado (`channel: 'chrome'`).
- **Ubicación:** `apps/web/e2e/`.
- **Configuración:** `apps/web/playwright.config.ts`.
- **Aislamiento y entorno:**
  - El archivo `global-setup.ts` ejecuta `db:migrate` y `db:seed` antes de iniciar la suite contra la base de datos de pruebas configurada.
  - La suite corre con 1 worker (`workers: 1`) para optimizar el consumo de memoria en entornos con recursos limitados.
  - El bloque `webServer` levanta automáticamente el backend (`apps/api`, puerto configurado) y el frontend (`apps/web` con Vite), apagándolos de forma segura al finalizar.
- **Comandos de ejecución:**
  ```bash
  # Ejecutar todas las pruebas E2E
  pnpm --filter web test:e2e

  # Ejecutar un flujo o spec específico
  pnpm --filter web test:e2e e2e/venta-llevar.spec.ts
  ```
- **Suites y flujos críticos implementados:**
  1. `auth.spec.ts`: Login de los 3 roles (`ADMIN`, `CAJERO`, `COCINA`), redirección por rol, bloqueo de rutas no autorizadas y cierre de sesión.
  2. `venta-llevar.spec.ts`: Apertura de caja, pedido para llevar, agregar productos, cobro en efectivo con cálculo de cambio y emisión de recibo "Documento no fiscal".
  3. `venta-mesa.spec.ts`: Pedido en mesa con notas por ítem ("sin cebolla"), recepción en tiempo real en KDS (SSE) sin recargar, avance de estados de cocina, reanudación del pedido desde "Pedidos activos", cobro con propina sugerida y liberación de mesa.
  4. `stock.spec.ts`: Validación de stock insuficiente (409), modal accesible de faltantes, preservación del estado abierto del pedido y confirmación exitosa tras reabastecimiento.
  5. `caja.spec.ts`: Ciclo operativo de caja: apertura base, ingreso manual, retiro manual, arqueo y cierre cuadrado con teclado numérico, y consulta en historial de cierres.
  6. `admin.spec.ts`: Creación y desactivación de usuarios (pérdida inmediata de sesión), creación de categorías reflejadas en el catálogo del POS, consulta de reportes con exportación a CSV (validación de encabezados) y alertas de stock bajo en dashboard.
  7. `anular.spec.ts`: Anulación administrativa de pedido confirmado con comanda pendiente (reversión automática de stock y liberación de mesa) y deshacer transición de estado en KDS dentro de la ventana de 10 segundos.


---

## 5. Glosario del Dominio (MonsterBurguer POS)

- **Fecha Operativa (RN-16):** Día contable de operación del restaurante, definido por defecto desde las 05:00 AM de un día calendario hasta las 04:59 AM del día siguiente (hora Colombia). Evita que los pedidos pasados de medianoche se asignen a un día fiscal distinto.
- **Ticket:** Pedido en curso en la terminal POS en estado `ABIERTO`, al cual se le pueden agregar, editar o quitar productos y notas antes de su confirmación o cobro.
- **Comanda (RN-20):** Orden de preparación en cocina derivada 1:1 de un pedido al ser confirmado. Contiene las líneas de producción, cantidades y notas que visualiza el cocinero en la pantalla KDS.
- **KDS (Kitchen Display System):** Pantalla digital de alta legibilidad en cocina que muestra las comandas en orden FIFO (primero en entrar, primero en salir) agrupadas por estado (`PENDIENTE`, `EN_PREPARACION`, `LISTA`).
- **Snapshot de Precio (RN-05):** Copia inmutable del nombre y precio del producto almacenada en la fila `pedido_item` en el momento de agregarlo. Garantiza que modificaciones futuras en el catálogo no alteren pedidos pasados.
- **Kardex / Movimiento de Inventario (RN-34):** Registro transaccional inmutable que documenta cualquier cambio en el stock físico de un ingrediente (`CONSUMO`, `ENTRADA`, `AJUSTE`, `MERMA`, `REVERSION`), guardando el saldo resultante tras cada operación.
- **Sesión de Caja (RN-40):** Período de turno operativo asignado a un cajero específico. Inicia con un monto base de apertura en efectivo (`montoApertura`), registra las ventas y finaliza con el conteo físico y cálculo de sobrante/faltante al cierre.
- **Recibo POS (RN-45):** Comprobante impreso no fiscal emitido al liquidar un pedido, identificado por un consecutivo correlativo global (`R-XXXXXX`), desglosando productos, propinas y leyendas del régimen tributario.
- **Outbox Pattern (`evento_sistema`, ADR-005):** Patrón arquitectónico en el que los eventos de dominio se persisten en la misma transacción relacional de la base de datos que la operación de negocio, siendo leídos asíncronamente por un despachador para emitir Server-Sent Events o ejecutar tareas secundarias.
- **Unidad Base (RN-30):** Unidad de medida elemental entera utilizada para el control de inventario y recetas (`G` para gramos, `ML` para mililitros, `UND` para unidades enteras).
