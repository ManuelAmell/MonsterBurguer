# ADR-004: Arquitectura de Monolito Modular

## Estado
Aceptado

## Fecha
2026-10-06

## Contexto
El alcance del sistema corresponde a la operación de un restaurante local (hamburguesería física con terminales en mostrador, cocina y gerencia conectadas por LAN). Una arquitectura de microservicios introduciría una complejidad operativa desproporcionada: múltiples procesos que desplegar y monitorear, problemas de consistencia eventual entre bases de datos separadas, latencia de red en LAN y dificultad de mantenimiento para un equipo pequeño. Por otro lado, un monolito sin fronteras claras ("gran bola de barro") degradaría el código rápidamente al acoplar modelos y tablas.

## Decisión
Implementar un **Monolito Modular** estructurado en un único desplegable backend NestJS (`apps/api`), con fronteras estrictas:
- Módulos organizados según los subsistemas del Enfoque de Sistemas: `identidad`, `catalogo`, `clientes`, `pedidos`, `cocina`, `inventario`, `caja`, `administracion`, `realtime`.
- Cada módulo es dueño exclusivo de sus tablas (`*.schema.ts`) y de sus consultas (`*.repository.ts`).
- La comunicación síncrona entre módulos se realiza **únicamente** a través de su fachada pública (`*.public.ts`).
- La comunicación asíncrona o desacoplada se realiza mediante eventos de dominio (`EventBus`).
- Validación estricta de fronteras en CI mediante `dependency-cruiser` (`.dependency-cruiser.cjs`).

## Consecuencias

### Positivas
- Despliegue único, simple y económico en un único mini-servidor o PC local mediante Docker Compose.
- Transacciones de base de datos atómicas locales entre módulos (por ejemplo, confirmar pedido, descontar inventario y crear comanda en una sola transacción ACID).
- Alta cohesión y bajo acoplamiento: un cambio interno en el esquema de un módulo no rompe otros módulos mientras se respete el contrato de `*.public.ts`.

### Negativas / Riesgos
- Si los desarrolladores o agentes importan archivos internos de otros módulos (`*.service.ts` o `*.schema.ts`), las fronteras se erosionan.
- Posible tentación de ejecutar consultas SQL directas cruzando esquemas de tablas ajenas.

### Mitigaciones
- Regla automatizada `modules-only-import-public` en `dependency-cruiser` que bloquea el build y el CI si hay imports cruzados no permitidos.
- Lecturas transversales permitidas únicamente a `administracion` a través de vistas SQL dedicadas (`v_ventas_*`, `v_tiempos_cocina`, `v_stock_alertas`).
