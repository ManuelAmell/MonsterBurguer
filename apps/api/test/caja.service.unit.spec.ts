import { describe, expect, it, vi } from 'vitest';
import type { Db } from '../src/shared-kernel/db/db';
import type { EventBus } from '../src/shared-kernel/events/event-bus';
import type { IdentidadPublicService } from '../src/modules/identidad/identidad.public';
import type { PedidosService } from '../src/modules/pedidos/pedidos.public';
import type { EmisorDocumentoElectronico } from '../src/modules/caja/emisor-documento-electronico.puerto';
import { CajaService } from '../src/modules/caja/caja.service';

describe('CajaService (pruebas unitarias con puerto mockeado)', () => {
  const crearMocks = () => {
    const mockDb = {
      select: vi.fn(),
      insert: vi.fn(),
      transaction: vi.fn(),
    } as unknown as Db;

    const mockEventBus = {
      publicarEnTx: vi.fn(),
    } as unknown as EventBus;

    const mockPedidos = {
      prepararCobro: vi.fn(),
      cerrar: vi.fn(),
      obtenerPedido: vi.fn(),
    } as unknown as PedidosService;

    const mockIdentidad = {
      nombresPorIds: vi.fn(),
    } as unknown as IdentidadPublicService;

    const mockEmisor: EmisorDocumentoElectronico = {
      emitir: vi.fn().mockResolvedValue({
        cude: 'SIMULADO-CUDE-UNIT-TEST',
        qr: 'https://catalogo-vpfe.dian.gov.co/document/searchqr?documentkey=SIMULADO-TEST',
        proveedor: 'SIMULADO',
        fechaEmision: '2026-11-09T14:00:00.000Z',
      }),
    };

    const service = new CajaService(
      mockDb,
      mockEventBus,
      mockPedidos,
      mockIdentidad,
      mockEmisor,
    );

    return { service, mockDb, mockEventBus, mockPedidos, mockIdentidad, mockEmisor };
  };

  it('obtenerRecibo: incluye DEE POS y leyendas correspondientes cuando existe documento_electronico', async () => {
    const { service, mockDb, mockPedidos } = crearMocks();

    const mockRecibo = {
      id: 'recibo-1',
      numero: 42,
      pedidoId: 'pedido-1',
      sesionCajaId: 'sesion-1',
      usuarioId: 'usuario-1',
      total: 30000,
      base: 30000,
      impuesto: 0,
      impuestoTasaBp: 0,
      regimenTributario: 'NO_RESPONSABLE',
      propina: 0,
      createdAt: new Date('2026-11-09T14:00:00.000Z'),
    };

    const mockDoc = {
      id: 'doc-1',
      reciboId: 'recibo-1',
      cude: 'SIMULADO-CUDE-XYZ',
      qr: 'https://catalogo-vpfe.dian.gov.co/document/searchqr?documentkey=SIMULADO-XYZ',
      proveedor: 'SIMULADO',
      estado: 'EMITIDO',
      createdAt: new Date('2026-11-09T14:00:00.000Z'),
    };

    let callCount = 0;
    (mockDb.select as unknown as ReturnType<typeof vi.fn>).mockImplementation(() => ({
      from: (table: unknown) => {
        const queryBuilder = {
          where: () => queryBuilder,
          limit: () => queryBuilder,
          then: (resolve: (val: unknown) => void) => {
            // Distinguir por tabla o por orden de llamadas
            if (table === mockRecibo || callCount === 0) {
              callCount++;
              return resolve([mockRecibo]);
            }
            if (callCount === 1) {
              callCount++;
              return resolve([]); // pagos
            }
            if (callCount === 2) {
              callCount++;
              return resolve([mockDoc]); // documentoElectronico
            }
            return resolve([]);
          },
        };
        return queryBuilder;
      },
    }));

    (mockPedidos.obtenerPedido as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: 'pedido-1',
      numeroDia: 5,
      tipo: 'LLEVAR',
      mesa: null,
      items: [
        {
          nombre: 'Monster Clásica',
          cantidad: 1,
          precioUnitario: 30000,
          totalLinea: 30000,
          nota: null,
        },
      ],
    });

    const resultado = await service.obtenerRecibo('recibo-1');

    expect(resultado.id).toBe('recibo-1');
    expect(resultado.numero).toBe('R-000042');
    expect(resultado.leyendas).toContain('Documento Equivalente Electrónico POS');
    expect(resultado.leyendas).toContain('No responsable de INC');
    expect(resultado.leyendas).not.toContain('Documento no fiscal');
    expect(resultado.documentoElectronico).toEqual({
      cude: 'SIMULADO-CUDE-XYZ',
      qr: 'https://catalogo-vpfe.dian.gov.co/document/searchqr?documentkey=SIMULADO-XYZ',
      proveedor: 'SIMULADO',
      estado: 'EMITIDO',
      fechaEmision: '2026-11-09T14:00:00.000Z',
    });
  });

  it('obtenerRecibo: mantiene "Documento no fiscal" cuando NO existe documento_electronico', async () => {
    const { service, mockDb, mockPedidos } = crearMocks();

    const mockRecibo = {
      id: 'recibo-2',
      numero: 43,
      pedidoId: 'pedido-2',
      sesionCajaId: 'sesion-1',
      usuarioId: 'usuario-1',
      total: 20000,
      base: 20000,
      impuesto: 0,
      impuestoTasaBp: 0,
      regimenTributario: 'NO_RESPONSABLE',
      propina: 0,
      createdAt: new Date('2026-11-09T14:00:00.000Z'),
    };

    let callCount = 0;
    (mockDb.select as unknown as ReturnType<typeof vi.fn>).mockImplementation(() => ({
      from: () => {
        const queryBuilder = {
          where: () => queryBuilder,
          limit: () => queryBuilder,
          then: (resolve: (val: unknown) => void) => {
            if (callCount === 0) {
              callCount++;
              return resolve([mockRecibo]);
            }
            if (callCount === 1) {
              callCount++;
              return resolve([]); // pagos
            }
            if (callCount === 2) {
              callCount++;
              return resolve([]); // documentoElectronico (null)
            }
            return resolve([]);
          },
        };
        return queryBuilder;
      },
    }));

    (mockPedidos.obtenerPedido as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: 'pedido-2',
      numeroDia: 6,
      tipo: 'LLEVAR',
      mesa: null,
      items: [],
    });

    const resultado = await service.obtenerRecibo('recibo-2');

    expect(resultado.leyendas).toContain('Documento no fiscal');
    expect(resultado.leyendas).toContain('No responsable de INC');
    expect(resultado.leyendas).not.toContain('Documento Equivalente Electrónico POS');
    expect(resultado.documentoElectronico).toBeNull();
  });
});
