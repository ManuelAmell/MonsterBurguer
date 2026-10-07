# ADR-002: PostgreSQL 17 (Dev Local) / Compatible PG 18 como Base de Datos

## Estado
Aceptado

## Fecha
2026-10-06

## Contexto
Un sistema POS transaccional maneja operaciones concurrentes críticas: descuento de stock en tiempo real, bloqueos de mesas, aperturas y cierres de caja con cuadre exacto de dinero, y serialización de números consecutivos de pedidos y recibos. Bases de datos embebidas (SQLite) no soportan adecuadamente múltiples clientes concurrentes en LAN sin bloqueos globales de escritura, y MySQL ofrece soporte inferior para índices parciales expresivos, tipos JSONB avanzados y mecanismos nativos de mensajería asíncrona transaccional.

## Decisión
Elegir **PostgreSQL** como motor relacional primario del sistema:
- Entorno de desarrollo local: PostgreSQL 17 nativo con base de datos principal (`monsterburguer`) y base de datos de test dedicada (`monsterburguer_test` en `DATABASE_URL_TEST`).
- Entorno de producción / contenedor: imagen PostgreSQL 18-alpine (o PostgreSQL 17-alpine en caso de retraso en tags oficiales).
- Generación de claves primarias UUID v7 en la capa de aplicación, asegurando ordenamiento temporal natural sin depender de extensiones del motor.

## Consecuencias

### Positivas
- Soporte robusto de transacciones ACID con `SELECT ... FOR UPDATE` (crítico para bloquear ingredientes durante la confirmación de pedidos).
- Índices parciales únicos para validar invariantes de negocio en el motor (`WHERE estado = 'ABIERTA'`, `WHERE estado IN ('ABIERTO', 'CONFIRMADO')`).
- Disponibilidad del canal pub/sub `LISTEN / NOTIFY` para reactividad inmediata del outbox sin saturar la red con polling ineficiente.
- Vistas relacionales y funciones de agregación/ventana para cálculos de KPIs y reportes diarios.

### Negativas / Riesgos
- Requiere un servidor de base de datos en ejecución (mayor consumo de memoria que una base embebida).
- Necesidad de gestionar backups programados con `pg_dump` y conexiones de pool de manera disciplinada.

### Mitigaciones
- Despliegue empaquetado mediante Docker Compose para producción en la LAN del restaurante.
- Configuración de pool de conexiones (`DB_POOL_MAX`) en `env.ts` con manejo de reconexión automática en el despachador de outbox.
