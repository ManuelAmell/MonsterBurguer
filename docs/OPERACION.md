# Guía de Operación y Despliegue — MonsterBurguer POS

> **Manual de infraestructura, despliegue, configuración y mantenimiento para el entorno de producción local del restaurante.**

---

## 1. Arquitectura de Despliegue

MonsterBurguer POS está diseñado para operar en un servidor local (PC dedicado o mini-PC) conectado a la red de área local (LAN) del restaurante. Todos los componentes se orquestan mediante **Docker Compose**:

```
                       ┌──────────────────────────────────────────────┐
                       │           Terminales en LAN (Wi-Fi/Ethernet) │
                       │    POS Mostrador · KDS Cocina · Admin PC     │
                       └──────────────────────┬───────────────────────┘
                                              │ HTTP / HTTPS (puerto 80 / 443)
                       ┌──────────────────────▼───────────────────────┐
                       │               monsterburguer-nginx            │
                       │    (Sirve estáticos SPA web y proxy /api)    │
                       └──────────────┬───────────────────────────────┘
                                      │ Proxy HTTP :3000
                       ┌──────────────▼───────────────────────────────┐
                       │                monsterburguer-api            │
                       │     (Node.js 24 + NestJS 12 + Drizzle ORM)   │
                       └──────────────┬───────────────────────────────┘
                                      │ Conexión PostgreSQL :5432
                       ┌──────────────▼───────────────────────────────┐
                       │              monsterburguer-postgres          │
                       │      (PostgreSQL 17 / 18 + volumen data)     │
                       └──────────────────────────────────────────────┘
```

---

## 2. Despliegue con Docker Compose

### 2.1. Requisitos Previos en el Servidor
- Sistema operativo Linux (Ubuntu Server / Debian recomendado) o Windows Server con Docker Desktop.
- Docker Engine v24+ y Docker Compose v2.20+.
- Al menos 4 GB de memoria RAM y 20 GB de espacio libre en disco.

### 2.2. Configuración Inicial del Archivo `.env`
En la raíz del proyecto, crear el archivo `.env` a partir de `.env.example`:

```bash
cp .env.example .env
```

Editar `.env` y establecer contraseñas y parámetros seguros:

```ini
# Configuración de base de datos
POSTGRES_USER=mb
POSTGRES_PASSWORD=UnaClaveMuySeguraYAleatoria2026!   # OBLIGATORIO: define una clave fuerte
POSTGRES_DB=monsterburguer

# Configuración de red y seguridad
APP_ORIGIN=http://192.168.1.100                     # Dirección IP o nombre de host del servidor en la LAN
COOKIE_SECURE=false                                 # true solo si se despliega bajo HTTPS (ej. con Caddy)
TRUST_PROXY=true                                    # Habilitado para confiar en las cabeceras X-Forwarded-* de Nginx
```

> [!CAUTION]
> La variable `POSTGRES_PASSWORD` es obligatoria. El archivo `docker-compose.yml` emitirá un error y no levantará los contenedores si esta variable no está definida en `.env`.

### 2.3. Puesta en Marcha de los Servicios
Construir las imágenes y levantar los contenedores en segundo plano:

```bash
# Construcción y arranque
docker compose up -d --build

# Verificar que los 3 contenedores estén saludables (healthy / running)
docker compose ps
```

### 2.4. Inicialización de la Base de Datos (Migraciones y Semilla)
Tras iniciar los contenedores por primera vez, ejecutar las migraciones de Drizzle y cargar los datos semilla dentro del contenedor de la API:

```bash
# Aplicar migraciones SQL
docker compose exec api pnpm --filter api db:migrate

# Cargar usuarios demo, catálogo e inventario inicial
docker compose exec api pnpm --filter api db:seed
```

---

## 3. Matriz de Variables de Entorno

Todas las variables de entorno son validadas en el arranque por Zod mediante `apps/api/src/config/env.ts`. Si alguna variable requerida falta o tiene un formato inválido, el proceso se detiene de inmediato informando el error.

| Variable | Tipo / Valores permitidos | Por defecto | Descripción |
|---|---|:---:|---|
| `NODE_ENV` | `development` \| `test` \| `production` | `development` | Entorno de ejecución de Node.js. |
| `PORT` | Entero positivo | `3000` | Puerto TCP en el que escucha la API HTTP. |
| `DATABASE_URL` | URL de conexión PostgreSQL válida | *Requerido* | Cadena de conexión principal (`postgresql://mb:clave@postgres:5432/monsterburguer`). |
| `DATABASE_URL_TEST` | URL de conexión PostgreSQL | *Solo tests* | Base de datos aislada para pruebas de integración automatizadas. |
| `APP_ORIGIN` | URL válida (HTTP o HTTPS) | *Requerido* | Origen público del frontend. Utilizado por `OrigenGuard` para prevención de ataques CSRF. |
| `SESSION_TTL_HORAS` | Entero positivo | `12` | Tiempo de vida de la sesión opaca en horas antes de expirar. |
| `LOG_LEVEL` | `fatal` \| `error` \| `warn` \| `info` \| `debug` \| `trace` \| `silent` | `info` | Nivel mínimo de severidad para emisión de logs estructurados con Pino. |
| `DB_POOL_MAX` | Entero positivo | `20` | Número máximo de conexiones simultáneas en el pool de `pg`. |
| `COOKIE_SECURE` | Booleano (`true` \| `false`) | Automático | Flag `Secure` de la cookie `mb_session`. Por defecto es `true` si `APP_ORIGIN` inicia con `https://`, o `false` en caso contrario. |
| `TRUST_PROXY` | Booleano o expresión IP de proxy | `false` | Indica a Express que confíe en `X-Forwarded-For`. Esencial detrás de Nginx para capturar la IP real en rate limiting. |
| `MIGRAR_AL_ARRANCAR`| Booleano (`true` \| `false`) | `false` | Si es `true`, ejecuta automáticamente las migraciones pendientes al iniciar la API. |
| `TZ` | Cadena IANA de zona horaria | `America/Bogota` | Zona horaria del proceso para cálculos de fecha operativa y timestamps. |

---

## 4. Ciclo de Vida de Migraciones de Base de Datos

Las migraciones de MonsterBurguer POS son generadas como archivos SQL estándar e inmutables mediante Drizzle Kit en `apps/api/drizzle/`:

```
apps/api/drizzle/
├── 0000_inicial.sql                    # Identidad, sesiones, configuración y outbox
├── 0001_hito1_catalogo_inventario.sql  # Categorías, productos, recetas, ingredientes y kardex
├── 0002_mesas_clientes.sql             # Mesas y clientes
└── 0003_hito2_4_pedidos_cocina_caja.sql# Pedidos, comandas, caja, recibos y vistas SQL
```

### Comandos de Gestión de Base de Datos
- **Generar una nueva migración (en desarrollo):**
  ```bash
  pnpm --filter api db:generate
  ```
- **Aplicar migraciones pendientes:**
  ```bash
  pnpm --filter api db:migrate
  ```
- **Ejecutar seed de desarrollo/demostración (idempotente):**
  ```bash
  pnpm --filter api db:seed
  ```

---

## 5. Estrategia de Respaldos (Backups) y Restauración

La base de datos contiene todo el historial de pedidos, recibos de caja, auditoría de eventos y stock físico. Debe respaldarse diariamente al terminar el turno operativo.

### 5.1. Generar Respaldo Manual con `pg_dump`
Desde el host que ejecuta Docker Compose:

```bash
# Crear directorio de backups
mkdir -p backups

# Ejecutar volcado en formato custom comprimido
docker compose exec postgres pg_dump -U mb -d monsterburguer -F c -b -v > backups/mb_backup_$(date +%Y%m%d_%H%M%S).dump
```

### 5.2. Automatización con Cron (Linux)
Agregar una tarea en el crontab del sistema (`crontab -e`) para respaldar automáticamente a las 05:00 AM (corte de fecha operativa):

```cron
0 5 * * * cd /opt/MonsterBurguer && docker compose exec -T postgres pg_dump -U mb -d monsterburguer -F c > /opt/MonsterBurguer/backups/mb_$(date +\%Y\%m\%d).dump
# Retención: eliminar respaldos con más de 30 días
0 6 * * * find /opt/MonsterBurguer/backups/ -type f -name "*.dump" -mtime +30 -delete
```

### 5.3. Restauración de Base de Datos con `pg_restore`
En caso de fallo de disco o desastre:

```bash
# 1. Detener contenedores de API para liberar conexiones
docker compose stop api

# 2. Restaurar el volcado sobre la base de datos limpia
docker compose exec -T postgres pg_restore -U mb -d monsterburguer -v --clean --if-exists < backups/mb_backup_20261006.dump

# 3. Reiniciar la API
docker compose start api
```

---

## 6. Guía de Solución de Problemas (Troubleshooting)

### 6.1. La API no inicia o `/health` responde `503 DB_NO_DISPONIBLE`
- **Síntoma:** `curl http://localhost:3000/api/v1/health` devuelve error 503 o el contenedor `monsterburguer-api` se reinicia continuamente.
- **Causa común:** El contenedor de PostgreSQL no ha completado su inicialización, las credenciales en `DATABASE_URL` no coinciden con `POSTGRES_USER`/`POSTGRES_PASSWORD`, o el puerto 5432 ya está ocupado por un servicio nativo del host.
- **Solución:**
  1. Revisar logs de la base de datos: `docker compose logs postgres`.
  2. Verificar que `pg_isready -U mb -d monsterburguer` responda exitosamente dentro del contenedor.
  3. Comprobar que la URL en `.env` use el host del servicio Docker `postgres` (y no `localhost`).

### 6.2. Error HTTP 403 `ORIGEN_NO_PERMITIDO` al hacer mutaciones
- **Síntoma:** Al intentar iniciar sesión, agregar ítems o cobrar, la API responde `{"codigo":"ORIGEN_NO_PERMITIDO","mensaje":"Origen no permitido."}`.
- **Causa:** El guardia `OrigenGuard` verifica que la cabecera `Origin` enviada por el navegador coincida exactamente con la variable de entorno `APP_ORIGIN`. Si el usuario ingresa por `http://192.168.1.100` pero `APP_ORIGIN` está configurado como `http://localhost`, la petición es bloqueada por protección CSRF.
- **Solución:** Ajustar `APP_ORIGIN` en el archivo `.env` del servidor con la IP o dominio exacto que utilizan las terminales del restaurante.

### 6.3. La sesión no se guarda y el usuario es devuelto al Login
- **Síntoma:** El login responde 200 OK pero cualquier navegación posterior arroja 401 `NO_AUTENTICADO`.
- **Causa:** La variable `COOKIE_SECURE` está configurada en `true`, pero el restaurante accede al sistema mediante HTTP plano (sin certificado SSL/TLS). Los navegadores modernos descartan silenciosamente cookies con el flag `Secure` bajo conexiones HTTP no cifradas.
- **Solución:** En redes locales sin HTTPS, establecer explícitamente `COOKIE_SECURE=false` en el `.env`. Si se implementa HTTPS mediante Caddy o Nginx con TLS local, configurar `COOKIE_SECURE=true`.

### 6.4. Bloqueo masivo por Rate Limiting (Error 429 en todas las terminales)
- **Síntoma:** Varios cajeros reciben HTTP 429 `DEMASIADOS_INTENTOS` tras intentos fallidos en una sola terminal.
- **Causa:** El reverse proxy (Nginx) reenvía las peticiones a NestJS, pero la variable `TRUST_PROXY` está en `false`. Como resultado, NestJS ve la dirección `127.0.0.1` como la IP de todos los clientes, agrupando a todo el restaurante bajo el mismo contador de throttling.
- **Solución:** Asegurar que `TRUST_PROXY=true` esté activo en el `.env` para que `ThrottlerGuard` evalúe la cabecera `X-Forwarded-For`.

### 6.5. Desconexión frecuente o pantallas congeladas en el KDS (SSE)
- **Síntoma:** Las comandas tardan en aparecer en cocina o el indicador muestra "Reconectando..." constantemente.
- **Causa:** Nginx o un proxy intermedio está aplicando almacenamiento en búfer (`proxy_buffering on`), reteniendo los paquetes de `text/event-stream` hasta acumular varios kilobytes.
- **Solución:** Verificar que `apps/web/Dockerfile` o el bloque de configuración de Nginx incluya `proxy_buffering off;` y `proxy_read_timeout 3600s;`. El backend envía periódicamente un comentario heartbeat cada 25 segundos para evitar cierres por inactividad.
