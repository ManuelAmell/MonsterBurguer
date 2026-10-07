# ADR-006: Server-Sent Events (SSE) para Tiempo Real

## Estado
Aceptado

## Fecha
2026-10-06

## Contexto
Las pantallas operativas de la hamburguesería (Pantalla de Cocina / KDS, Terminal POS de Caja, Dashboard de Administración) requieren reflejar cambios instantáneamente: la comanda debe aparecer en cocina en ≤ 2 segundos tras ser confirmada, el POS debe enterarse cuando cocina marca un pedido listo, y el dashboard debe actualizarse al cobrar pedidos.
Alternativas como WebSockets o Socket.IO introducen complejidad de handshake bidireccional, protocolo independiente sobre TCP, dificultades de compatibilidad con cookies de sesión `HttpOnly` y proxies HTTP sencillos.

## Decisión
Utilizar **Server-Sent Events (SSE)** mediante el endpoint `GET /api/v1/stream`:
- Comunicación unidireccional servidor → cliente sobre HTTP estándar (`text/event-stream`).
- Filtrado por canales según el rol del usuario autenticado (`cocina`, `pos`, `admin`).
- Transmisión de eventos como invalidadores de caché: el frontend recibe la notificación SSE e invalida las queries de TanStack Query correspondientes (en lugar de parchar estado en memoria local).
- Reconexión automática nativa del navegador con cabecera `Last-Event-ID`, sirviendo eventos perdidos desde un búfer circular en memoria y respaldo de base de datos.
- Envío periódico de heartbeats (`: ping`) cada 25 segundos para mantener vivas las conexiones a través de proxies y firewalls locales.

## Consecuencias

### Positivas
- Funciona directamente sobre HTTP/1.1 y HTTP/2 estándar sin túneles especiales.
- Autenticación transparente mediante la cookie de sesión `mb_session` enviada en la solicitud HTTP inicial.
- Reconexión y reanudación automática nativa proporcionada por la API `EventSource` del navegador.
- Modelo mental simple en frontend: recibir evento → invalidar query → TanStack Query refresca datos frescos y consistentes.

### Negativas / Riesgos
- Canales HTTP unidireccionales: las acciones del cliente (avanzar comanda, cobrar) deben viajar por peticiones POST/PATCH REST tradicionales.
- En HTTP/1.1 hay un límite de 6 conexiones concurrentes por dominio en el navegador (no es limitante en la arquitectura de restaurante, donde cada pantalla corre en una pestaña única).

### Mitigaciones
- Todas las mutaciones del cliente se realizan mediante endpoints REST estándar con validación Zod y códigos de error unificados.
- Despliegue con Nginx configurado con `proxy_buffering off` y `X-Accel-Buffering: no` para entrega en tiempo real sin latencia de buffer.
