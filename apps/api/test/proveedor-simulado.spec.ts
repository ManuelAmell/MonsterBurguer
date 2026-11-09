import { describe, expect, it } from 'vitest';
import type { DatosEmisionDocumento } from '../src/modules/caja/emisor-documento-electronico.puerto';
import { ProveedorSimulado } from '../src/modules/caja/proveedor-simulado.adaptador';

describe('ProveedorSimulado (adaptador de emisión de DEE POS)', () => {
  const proveedor = new ProveedorSimulado();

  const crearDatosEjemplo = (overrides?: Partial<DatosEmisionDocumento>): DatosEmisionDocumento => ({
    reciboId: '019313ea-1111-7000-8000-000000000001',
    numero: 'R-000001',
    fecha: new Date('2026-11-09T14:00:00.000Z'),
    total: 25000,
    base: 25000,
    impuesto: 0,
    impuestoTasaBp: 0,
    regimenTributario: 'NO_RESPONSABLE',
    propina: 2000,
    items: [
      {
        nombre: 'Monster Clásica',
        cantidad: 1,
        precioUnitario: 25000,
        totalLinea: 25000,
      },
    ],
    pagos: [
      {
        metodo: 'EFECTIVO',
        monto: 27000,
      },
    ],
    negocio: {
      razonSocial: 'MonsterBurguer',
      documento: '900123456-7',
      direccion: 'Calle 10 # 40-20',
      telefono: '3001234567',
    },
    ...overrides,
  });

  it('genera un CUDE falso con prefijo claro "SIMULADO-CUDE-"', async () => {
    const datos = crearDatosEjemplo();
    const resultado = await proveedor.emitir(datos);

    expect(resultado.cude).toBeDefined();
    expect(resultado.cude).toMatch(/^SIMULADO-CUDE-[a-f0-9]{64}$/);
  });

  it('genera una URL/QR falsa claramente marcada como simulada', async () => {
    const datos = crearDatosEjemplo();
    const resultado = await proveedor.emitir(datos);

    expect(resultado.qr).toBeDefined();
    expect(resultado.qr).toContain('documentkey=SIMULADO-');
    // Un QR simulado no puede apuntar al catálogo real de la DIAN
    expect(resultado.qr).not.toContain('dian.gov.co');
    expect(new URL(resultado.qr).hostname.endsWith('.invalid')).toBe(true);
  });

  it('indica "SIMULADO" como nombre de proveedor y fecha de emisión válida', async () => {
    const datos = crearDatosEjemplo();
    const resultado = await proveedor.emitir(datos);

    expect(resultado.proveedor).toBe('SIMULADO');
    expect(new Date(resultado.fechaEmision).getTime()).not.toBeNaN();
  });

  it('produce un CUDE determinista para los mismos datos de entrada', async () => {
    const datos1 = crearDatosEjemplo();
    const datos2 = crearDatosEjemplo();

    const res1 = await proveedor.emitir(datos1);
    const res2 = await proveedor.emitir(datos2);

    expect(res1.cude).toBe(res2.cude);
    expect(res1.qr).toBe(res2.qr);
  });

  it('produce un CUDE distinto para recibos con identificador o total diferente', async () => {
    const datos1 = crearDatosEjemplo({ reciboId: '019313ea-1111-7000-8000-000000000001', total: 25000 });
    const datos2 = crearDatosEjemplo({ reciboId: '019313ea-2222-7000-8000-000000000002', total: 35000 });

    const res1 = await proveedor.emitir(datos1);
    const res2 = await proveedor.emitir(datos2);

    expect(res1.cude).not.toBe(res2.cude);
    expect(res1.qr).not.toBe(res2.qr);
  });
});
