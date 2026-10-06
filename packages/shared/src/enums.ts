// Valores de dominio compartidos. La BD los valida con CHECK; aquí viven como fuente de verdad del código.

export const ROLES = ['ADMIN', 'CAJERO', 'COCINA'] as const;
export type Rol = (typeof ROLES)[number];

export const TIPOS_PEDIDO = ['MESA', 'LLEVAR'] as const;
export type TipoPedido = (typeof TIPOS_PEDIDO)[number];

export const ESTADOS_PEDIDO = ['ABIERTO', 'CONFIRMADO', 'CERRADO', 'ANULADO'] as const;
export type EstadoPedido = (typeof ESTADOS_PEDIDO)[number];

export const ESTADOS_COMANDA = [
  'PENDIENTE',
  'EN_PREPARACION',
  'LISTA',
  'ENTREGADA',
  'ANULADA',
] as const;
export type EstadoComanda = (typeof ESTADOS_COMANDA)[number];

export const METODOS_PAGO = ['EFECTIVO', 'TARJETA', 'TRANSFERENCIA'] as const;
export type MetodoPago = (typeof METODOS_PAGO)[number];

export const UNIDADES = ['G', 'ML', 'UND'] as const;
export type Unidad = (typeof UNIDADES)[number];

export const TIPOS_MOVIMIENTO_INVENTARIO = [
  'CONSUMO',
  'ENTRADA',
  'AJUSTE',
  'MERMA',
  'REVERSION',
] as const;
export type TipoMovimientoInventario = (typeof TIPOS_MOVIMIENTO_INVENTARIO)[number];

export const REGIMENES_TRIBUTARIOS = ['NO_RESPONSABLE', 'INC_8', 'IVA_19'] as const;
export type RegimenTributario = (typeof REGIMENES_TRIBUTARIOS)[number];

export const ESTADOS_SESION_CAJA = ['ABIERTA', 'CERRADA'] as const;
export type EstadoSesionCaja = (typeof ESTADOS_SESION_CAJA)[number];

export const TIPOS_MOVIMIENTO_CAJA = ['INGRESO', 'RETIRO'] as const;
export type TipoMovimientoCaja = (typeof TIPOS_MOVIMIENTO_CAJA)[number];
