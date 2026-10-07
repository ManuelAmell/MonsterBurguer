# ADR-010: Frontend SPA con React 19, Vite 8 y React Router

## Estado
Aceptado

## Fecha
2026-10-06

## Contexto
El frontend de MonsterBurguer opera en terminales locales de punto de venta (tablets táctiles, monitores de cocina, PCs de mostrador y administración) conectados por la red de área local (LAN) del restaurante.
No existe necesidad de indexación por motores de búsqueda (SEO) ni de renderizado en servidor (SSR) estilo Next.js, lo cual añadiría complejidad de servidores Node.js adicionales en el frontend, dificultades de manejo de WebSockets/SSE y sobrecarga de memoria en el servidor local del restaurante.

## Decisión
Desarrollar el frontend como una **Single Page Application (SPA)** estática construida con:
- **Librería y Bundler:** React 19 con Vite 8.
- **Enrutador:** React Router (enrutamiento declarativo del lado del cliente).
- **Gestión de datos remotos:** TanStack Query (caché, reintentos, deduplicación e invalidación reactiva por SSE).
- **Estilos y UI:** Tailwind CSS v4, shadcn/ui (componentes accesibles y estilizados con Radix UI) e iconos Lucide.
- **Servidor web de producción:** Nginx ligero sirviendo los archivos estáticos generados y actuando como reverse proxy hacia la API NestJS (`/api/v1`).

## Consecuencias

### Positivas
- Cero sobrecarga de SSR en el servidor del restaurante; los assets estáticos son servidos de manera instantánea por Nginx.
- Experiencia de usuario ultra-rápida y fluida en terminales táctiles (cero recargas completas de página).
- Desacoplamiento total entre la lógica visual y el backend NestJS.

### Negativas / Riesgos
- Carga inicial del paquete JavaScript (bundle).
- Dependencia del correcto manejo del ciclo de vida de la sesión y errores HTTP 401 para evitar estados desincronizados en la SPA.

### Mitigaciones
- Vite compila con code-splitting por rutas y bundles optimizados.
- Guardias de autenticación (`RequiereSesion`, `RequiereRol`, `RedirigirPorRol`) en el cliente sincronizadas con el estado de sesión del backend.
