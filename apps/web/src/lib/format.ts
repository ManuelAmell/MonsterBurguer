const ZONA = 'America/Bogota';

const fechaHora = new Intl.DateTimeFormat('es-CO', {
  dateStyle: 'short',
  timeStyle: 'short',
  timeZone: ZONA,
});

/** Fecha y hora en `es-CO`, zona `America/Bogota` (DESIGN §8). Acepta ISO-8601 UTC. */
export function formatearFechaHora(iso: string): string {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? iso : fechaHora.format(d);
}

/** Minúsculas y sin tildes, para búsquedas insensibles a acentos. */
export function normalizarTexto(texto: string): string {
  return texto.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase().trim();
}

/** Solo dígitos → entero de pesos (teclado numérico). Tope de seguridad de 9 dígitos. */
export function digitosAPesos(digitos: string): number {
  const n = Number(digitos.slice(0, 9));
  return Number.isFinite(n) ? n : 0;
}
