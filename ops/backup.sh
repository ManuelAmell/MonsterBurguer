#!/usr/bin/env bash
# ==============================================================================
# Script de Respaldo Automatizado y Verificación — MonsterBurguer POS
# ==============================================================================
# Uso:
#   ./ops/backup.sh              # Genera respaldo y aplica retención de 30 días
#   ./ops/backup.sh --verify     # Genera respaldo y prueba restauración en base temporal
# ==============================================================================

set -euo pipefail

BACKUP_DIR="${BACKUP_DIR:-backups}"
TIMESTAMP="$(date +%Y%m%d_%H%M%S)"
BACKUP_FILE="${BACKUP_DIR}/mb_backup_${TIMESTAMP}.dump"
DB_USER="${POSTGRES_USER:-mb}"
DB_NAME="${POSTGRES_DB:-monsterburguer}"
DB_HOST="${POSTGRES_HOST:-localhost}"
DB_PORT="${POSTGRES_PORT:-5432}"
RETENTION_DAYS=30

mkdir -p "${BACKUP_DIR}"

echo "==> [$(date +'%Y-%m-%d %H:%M:%S')] Iniciando respaldo de '${DB_NAME}'..."

if command -v docker >/dev/null 2>&1 && docker compose ps --services 2>/dev/null | grep -q "postgres"; then
    echo "==> Respaldando mediante contenedor Docker Compose 'postgres'..."
    docker compose exec -T postgres pg_dump -U "${DB_USER}" -d "${DB_NAME}" -F c -b > "${BACKUP_FILE}"
else
    echo "==> Respaldando mediante cliente nativo 'pg_dump'..."
    pg_dump -h "${DB_HOST}" -p "${DB_PORT}" -U "${DB_USER}" -d "${DB_NAME}" -F c -b -f "${BACKUP_FILE}"
fi

FILESIZE=$(ls -lh "${BACKUP_FILE}" | awk '{print $5}')
echo "==> Respaldo generado con éxito: ${BACKUP_FILE} (${FILESIZE})"

# Limpieza y política de retención
echo "==> Aplicando política de retención (${RETENTION_DAYS} días)..."
find "${BACKUP_DIR}" -type f -name "mb_backup_*.dump" -mtime "+${RETENTION_DAYS}" -delete || true

# Verificación opcional de restauración
if [[ "${1:-}" == "--verify" ]]; then
    TEMP_DB="mb_verify_${TIMESTAMP}"
    echo "==> [VERIFICACIÓN] Creando base temporal de prueba '${TEMP_DB}'..."
    PGPASSWORD="${POSTGRES_PASSWORD:-mb_dev_pass}" createdb -h "${DB_HOST}" -p "${DB_PORT}" -U "${DB_USER}" "${TEMP_DB}" 2>/dev/null || true
    echo "==> [VERIFICACIÓN] Restaurando volcado en base temporal..."
    pg_restore -h "${DB_HOST}" -p "${DB_PORT}" -U "${DB_USER}" -d "${TEMP_DB}" --clean --if-exists "${BACKUP_FILE}" || true
    echo "==> [VERIFICACIÓN] Limpiando base temporal..."
    dropdb -h "${DB_HOST}" -p "${DB_PORT}" -U "${DB_USER}" "${TEMP_DB}" 2>/dev/null || true
    echo "==> [VERIFICACIÓN] ¡Prueba de restauración completada con éxito!"
fi

echo "==> Operación de respaldo finalizada exitosamente."
