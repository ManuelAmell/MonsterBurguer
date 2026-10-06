/**
 * RN-16: Fecha operativa.
 * Un día operativo va de 05:00 a 04:59 del día siguiente (hora America/Bogota),
 * para que el cierre de medianoche no parta un turno.
 *
 * @param instante Instante en el tiempo (Date) a evaluar.
 * @param horaCorte Hora de corte del día operativo en formato HH:mm (por defecto "05:00").
 * @param zona Zona horaria IANA (por defecto "America/Bogota").
 * @returns Fecha operativa en formato YYYY-MM-DD.
 */
export function fechaOperativa(
  instante: Date,
  horaCorte = '05:00',
  zona = 'America/Bogota',
): string {
  if (!(instante instanceof Date) || Number.isNaN(instante.getTime())) {
    throw new TypeError('El instante proporcionado no es una fecha válida');
  }

  const match = /^(\d{1,2}):(\d{2})$/.exec(horaCorte.trim());
  if (!match || match[1] === undefined || match[2] === undefined) {
    throw new RangeError(
      `horaCorte debe tener formato HH:mm entre 00:00 y 23:59 (recibido: "${horaCorte}")`,
    );
  }

  const corteHora = parseInt(match[1], 10);
  const corteMinuto = parseInt(match[2], 10);
  if (corteHora < 0 || corteHora > 23 || corteMinuto < 0 || corteMinuto > 59) {
    throw new RangeError(`horaCorte fuera de rango 00:00 - 23:59 (recibido: "${horaCorte}")`);
  }

  // Extraer componentes de fecha y hora en la zona horaria objetivo usando Intl
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: zona,
    hourCycle: 'h23',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });

  const parts = formatter.formatToParts(instante);
  let year = 0;
  let month = 0;
  let day = 0;
  let hour = 0;
  let minute = 0;

  for (const p of parts) {
    if (p.type === 'year') year = parseInt(p.value, 10);
    else if (p.type === 'month') month = parseInt(p.value, 10);
    else if (p.type === 'day') day = parseInt(p.value, 10);
    else if (p.type === 'hour') hour = parseInt(p.value, 10);
    else if (p.type === 'minute') minute = parseInt(p.value, 10);
  }

  const minutoActual = hour * 60 + minute;
  const minutoCorte = corteHora * 60 + corteMinuto;

  if (minutoActual < minutoCorte) {
    // Pertenece al turno iniciado el día calendario anterior
    const fechaAnterior = new Date(Date.UTC(year, month - 1, day));
    fechaAnterior.setUTCDate(fechaAnterior.getUTCDate() - 1);
    const y = fechaAnterior.getUTCFullYear();
    const m = String(fechaAnterior.getUTCMonth() + 1).padStart(2, '0');
    const d = String(fechaAnterior.getUTCDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }

  // Pertenece al mismo día calendario
  const y = year;
  const m = String(month).padStart(2, '0');
  const d = String(day).padStart(2, '0');
  return `${y}-${m}-${d}`;
}
