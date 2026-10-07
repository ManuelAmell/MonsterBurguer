# ADR-007: Sesiones Opacas en Base de Datos con Cookies HttpOnly y Hashes Argon2id

## Estado
Aceptado

## Fecha
2026-10-06

## Contexto
En un entorno operativo de restaurante físico, los dispositivos son compartidos por el personal y los turnos rotan continuamente. Se requiere:
1. Posibilidad de revocar accesos inmediatamente (por ejemplo, si se despide a un empleado o se retira un dispositivo).
2. Seguridad contra filtraciones XSS de tokens de autenticación.
3. Almacenamiento seguro de contraseñas de empleados.
El uso de JWTs autocontenidos sin estado en el cliente dificulta la revocación inmediata sin listas negras complejas en memoria y expone el token si se almacena en `localStorage`.

## Decisión
Implementar un sistema de **sesiones opacas almacenadas en PostgreSQL** con cookies seguras:
- **Contraseñas:** Hasheadas con **argon2id** (`$argon2id$v=19$m=65536,p=4,t=3$`). Se incluye hash ficticio en el login para mitigar ataques de tiempo (*timing attacks*) ante usuarios inexistentes.
- **Tokens de sesión:** Tokens criptográficamente aleatorios de 256 bits (32 bytes generados con `crypto.randomBytes`).
- **Almacenamiento en BD:** La tabla `sesion_usuario` almacena únicamente el hash SHA-256 en formato hex del token (`token_hash`), impidiendo que un volcado de base de datos comprometa sesiones activas.
- **Transporte:** Cookie de sesión `mb_session` configurada con `HttpOnly`, `SameSite=Strict`, `Path=/`, y `Secure` según el esquema de conexión (`COOKIE_SECURE`).
- **Expiración:** TTL de 12 horas con expiración deslizante (*sliding expiration*): si han pasado más de 5 minutos desde el último uso, se actualiza `ultimo_uso_at` y se reemite la cookie con nueva vigencia.
- **Revocación:** El endpoint `POST /api/v1/auth/logout` borra el registro en la base de datos de inmediato.

## Consecuencias

### Positivas
- Revocación instantánea en caso de desvinculación o cierre de sesión.
- Inmune al robo de credenciales mediante scripts maliciosos (XSS) al utilizar cookies `HttpOnly`.
- Compatible de forma nativa con peticiones regulares `fetch` y conexiones `EventSource` (SSE).

### Negativas / Riesgos
- Cada petición autenticada requiere una consulta a la tabla `sesion_usuario` para validar la sesión y recuperar el rol del usuario.
- En despliegues locales sin HTTPS (solo HTTP en IP local), la bandera `Secure` debe configurarse en `false` para que los navegadores admitan la cookie.

### Mitigaciones
- Índice en `sesion_usuario.token_hash` e índice en `expira_at` para búsquedas en sub-milisegundos.
- Variable de entorno `COOKIE_SECURE` configurable en `env.ts` (por defecto false en HTTP local, true bajo HTTPS / Caddy).
