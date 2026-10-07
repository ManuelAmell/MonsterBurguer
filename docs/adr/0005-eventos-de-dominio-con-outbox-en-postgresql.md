# ADR-005: Eventos de Dominio con Patrón Outbox en PostgreSQL (`evento_sistema`)

## Estado
Aceptado

## Fecha
2026-10-06

## Contexto
Cuando ocurren acciones de negocio (por ejemplo, `PedidoConfirmado`, `ComandaLista`, `PedidoCobrado`), otros subsistemas y pantallas deben enterarse (pantalla de cocina, bitácora de interacciones, alertas administrativas, actualización en tiempo real).
Si el sistema utiliza un broker de mensajería externo (como RabbitMQ, Kafka o Redis Streams), se introduce infraestructura adicional que mantener en el restaurante y se corre el riesgo del problema de la doble escritura (*dual write*): si la base de datos comitea pero el broker falla, o viceversa, el sistema queda en un estado inconsistente.

## Decisión
Implementar un **EventBus con Outbox Pattern** respaldado directamente por la tabla `evento_sistema` en PostgreSQL:
1. **Registro atómico:** El método `EventBus.publicarEnTx(tx, evento)` inserta el evento en `evento_sistema` dentro de la **misma transacción** que la mutación de negocio, y ejecuta `pg_notify('evento_sistema', id)`.
2. **Handlers transaccionales (`alPublicarEnTx`):** Handlers síncronos que corren con el mismo `tx`. Si fallan, la transacción completa hace rollback.
3. **Despacho post-commit (`OutboxDispatcher`):** Un worker en segundo plano que escucha vía `LISTEN evento_sistema` y sondea cada 5 segundos buscando filas con `procesado_at IS NULL`. Ejecuta los handlers post-commit registrados (`despuesDeCommit`) y marca `procesado_at = now()`. En caso de fallo incrementa `intentos` y registra `ultimo_error`.

## Consecuencias

### Positivas
- Cero infraestructura adicional: cero procesos de Redis o brokers externos que monitorear en la máquina local del restaurante.
- Consistencia garantizada: un evento jamás se emite si la transacción de negocio hace rollback, y un cambio de negocio nunca se pierde sin su correspondiente registro de evento.
- Auditoría natural: `evento_sistema` actúa a la vez como outbox y como bitácora inmutable de interacciones entre subsistemas (utilizada por `GET /api/v1/admin/eventos`).

### Negativas / Riesgos
- Entrega de tipo *at-least-once*: si el proceso colapsa entre la ejecución del handler y la actualización de `procesado_at`, el handler puede re-ejecutarse en el siguiente arranque.
- Una conexión persistente del connection pool se reserva para el comando `LISTEN`.

### Mitigaciones
- Handlers post-commit idempotentes (como la invalidación de caché SSE en frontend y recálculo de métricas).
- Conexión `LISTEN` dedicada con escucha de errores para reconexión automática sin tirar el proceso (`OutboxDispatcher.conectarListener()`).
- Pool de conexiones dimensionado (`DB_POOL_MAX = 20`) para prevenir inanición de clientes HTTP.
