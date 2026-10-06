import { describe, expect, it } from 'vitest';
import { BuferCircularEventos } from '../src/modules/realtime/bufer-circular';

describe('BuferCircularEventos (ALTA-02)', () => {
  it('agrega eventos y respeta la capacidad máxima descartando los más antiguos', () => {
    const bufer = new BuferCircularEventos(3);

    bufer.agregar({ id: 1, tipo: 'comanda.nueva', datos: { n: 1 }, ts: '2026-10-06T00:00:00.000Z' }, ['cocina']);
    bufer.agregar({ id: 2, tipo: 'comanda.nueva', datos: { n: 2 }, ts: '2026-10-06T00:00:01.000Z' }, ['cocina']);
    bufer.agregar({ id: 3, tipo: 'comanda.nueva', datos: { n: 3 }, ts: '2026-10-06T00:00:02.000Z' }, ['cocina']);

    expect(bufer.tamano()).toBe(3);

    // Al agregar un 4to evento, el id: 1 se descarta
    bufer.agregar({ id: 4, tipo: 'comanda.nueva', datos: { n: 4 }, ts: '2026-10-06T00:00:03.000Z' }, ['cocina']);
    expect(bufer.tamano()).toBe(3);

    // Obtener desde id: 2 debe retornar eventos 3 y 4
    const recuperados = bufer.obtenerDesde(2, ['cocina']);
    expect(recuperados).not.toBeNull();
    expect(recuperados?.map((m) => m.id)).toEqual([3, 4]);

    // Obtener desde id: 0 es anterior al más viejo en el búfer (que es 2) -> retorna null (fallback a BD)
    const fallback = bufer.obtenerDesde(0, ['cocina']);
    expect(fallback).toBeNull();
  });

  it('filtra eventos según los canales solicitados', () => {
    const bufer = new BuferCircularEventos(5);

    bufer.agregar({ id: 1, tipo: 'comanda.nueva', datos: {}, ts: 'ts' }, ['cocina']);
    bufer.agregar({ id: 2, tipo: 'pedido.cobrado', datos: {}, ts: 'ts' }, ['pos']);
    bufer.agregar({ id: 3, tipo: 'inventario.alerta', datos: {}, ts: 'ts' }, ['admin']);

    const cocina = bufer.obtenerDesde(0, ['cocina']);
    expect(cocina?.map((m) => m.id)).toEqual([1]);

    const pos = bufer.obtenerDesde(0, ['pos']);
    expect(pos?.map((m) => m.id)).toEqual([2]);

    const admin = bufer.obtenerDesde(0, ['cocina', 'pos', 'admin']);
    expect(admin?.map((m) => m.id)).toEqual([1, 2, 3]);
  });

  it('retorna null cuando el búfer está vacío para consultar la BD', () => {
    const bufer = new BuferCircularEventos(10);
    expect(bufer.obtenerDesde(5, ['cocina'])).toBeNull();
  });
});
