import { z } from 'zod';
import { TIPOS_MOVIMIENTO_INVENTARIO, UNIDADES } from '../enums';
import { paginacionQuerySchema, paginacionRespuestaSchema, uuidSchema } from './common';

// --- Ingrediente (RN-30) ---

export const ingredienteSchema = z.object({
  id: uuidSchema,
  nombre: z
    .string()
    .trim()
    .min(1, 'El nombre del ingrediente es obligatorio')
    .max(100, 'El nombre del ingrediente no puede superar 100 caracteres'),
  unidad: z.enum(UNIDADES, {
    message: 'La unidad debe ser una de las permitidas: G, ML o UND (RN-30)',
  }),
  stockActual: z.number().int('El stock actual debe ser un número entero en unidad base (RN-30)'),
  stockMinimo: z
    .number()
    .int('El stock mínimo debe ser un número entero en unidad base (RN-30)')
    .min(0, 'El stock mínimo no puede ser negativo'),
  costoUnitario: z
    .number()
    .int('El costo unitario debe ser un entero en milésimas de peso COP')
    .min(0, 'El costo unitario no puede ser negativo'),
  activo: z.boolean().default(true),
  createdAt: z.string().optional(),
  updatedAt: z.string().optional(),
});
export type Ingrediente = z.infer<typeof ingredienteSchema>;

export const crearIngredienteSchema = z.object({
  nombre: z
    .string()
    .trim()
    .min(1, 'El nombre del ingrediente es obligatorio')
    .max(100, 'El nombre del ingrediente no puede superar 100 caracteres'),
  unidad: z.enum(UNIDADES, {
    message: 'La unidad debe ser una de las permitidas: G, ML o UND (RN-30)',
  }),
  stockMinimo: z
    .number()
    .int('El stock mínimo debe ser un número entero en unidad base (RN-30)')
    .min(0, 'El stock mínimo no puede ser negativo')
    .default(0)
    .optional(),
  costoUnitario: z
    .number()
    .int('El costo unitario debe ser un entero en milésimas de peso COP')
    .min(0, 'El costo unitario no puede ser negativo')
    .default(0)
    .optional(),
  activo: z.boolean().default(true).optional(),
});
export type CrearIngredienteInput = z.input<typeof crearIngredienteSchema>;
export type CrearIngredienteOutput = z.infer<typeof crearIngredienteSchema>;

export const editarIngredienteSchema = z.object({
  nombre: z
    .string()
    .trim()
    .min(1, 'El nombre del ingrediente no puede estar vacío')
    .max(100, 'El nombre del ingrediente no puede superar 100 caracteres')
    .optional(),
  stockMinimo: z
    .number()
    .int('El stock mínimo debe ser un número entero en unidad base (RN-30)')
    .min(0, 'El stock mínimo no puede ser negativo')
    .optional(),
  costoUnitario: z
    .number()
    .int('El costo unitario debe ser un entero en milésimas de peso COP')
    .min(0, 'El costo unitario no puede ser negativo')
    .optional(),
  activo: z.boolean().optional(),
});
export type EditarIngredienteInput = z.input<typeof editarIngredienteSchema>;
export type EditarIngredienteOutput = z.infer<typeof editarIngredienteSchema>;

// --- Entrada de inventario ---

export const itemEntradaInventarioSchema = z.object({
  ingredienteId: uuidSchema,
  cantidad: z
    .number()
    .int('La cantidad debe ser un número entero en unidad base (RN-30)')
    .positive('La cantidad de entrada debe ser mayor a 0'),
  costoUnitario: z
    .number()
    .int('El costo unitario debe ser un entero en milésimas de peso COP')
    .min(0, 'El costo unitario no puede ser negativo')
    .optional(),
});
export type ItemEntradaInventario = z.infer<typeof itemEntradaInventarioSchema>;

export const crearEntradaInventarioSchema = z.object({
  items: z
    .array(itemEntradaInventarioSchema)
    .min(1, 'Debe registrar al menos un ingrediente en la entrada de inventario'),
  nota: z.string().max(500, 'La nota no puede superar 500 caracteres').nullable().optional(),
});
export type CrearEntradaInventarioInput = z.input<typeof crearEntradaInventarioSchema>;
export type CrearEntradaInventarioOutput = z.infer<typeof crearEntradaInventarioSchema>;

// --- Ajuste de inventario ---

export const crearAjusteInventarioSchema = z.object({
  ingredienteId: uuidSchema,
  stockContado: z
    .number()
    .int('El stock contado debe ser un número entero en unidad base (RN-30)')
    .min(0, 'El stock contado no puede ser negativo'),
  motivo: z
    .string()
    .trim()
    .min(3, 'El motivo del ajuste es obligatorio y debe tener al menos 3 caracteres')
    .max(500, 'El motivo no puede superar 500 caracteres'),
});
export type CrearAjusteInventarioInput = z.input<typeof crearAjusteInventarioSchema>;
export type CrearAjusteInventarioOutput = z.infer<typeof crearAjusteInventarioSchema>;

// --- Merma de inventario ---

export const crearMermaInventarioSchema = z.object({
  ingredienteId: uuidSchema,
  cantidad: z
    .number()
    .int('La cantidad debe ser un número entero en unidad base (RN-30)')
    .positive('La cantidad de merma debe ser mayor a 0'),
  motivo: z
    .string()
    .trim()
    .min(3, 'El motivo de la merma es obligatorio y debe tener al menos 3 caracteres')
    .max(500, 'El motivo no puede superar 500 caracteres'),
});
export type CrearMermaInventarioInput = z.input<typeof crearMermaInventarioSchema>;
export type CrearMermaInventarioOutput = z.infer<typeof crearMermaInventarioSchema>;

// --- Movimiento de inventario / Kardex (RN-34) ---

export const movimientoInventarioSchema = z.object({
  id: uuidSchema,
  ingredienteId: uuidSchema,
  tipo: z.enum(TIPOS_MOVIMIENTO_INVENTARIO),
  cantidad: z
    .number()
    .int('La cantidad debe ser un número entero en unidad base (RN-30)')
    .refine((val) => val !== 0, 'La cantidad del movimiento no puede ser 0'),
  stockResultante: z
    .number()
    .int('El stock resultante debe ser un número entero en unidad base (RN-30)'),
  referenciaTipo: z.string().nullable().optional(),
  referenciaId: uuidSchema.nullable().optional(),
  usuarioId: uuidSchema,
  motivo: z.string().nullable().optional(),
  createdAt: z.string().optional(),
});
export type MovimientoInventario = z.infer<typeof movimientoInventarioSchema>;

export const kardexRespuestaSchema = paginacionRespuestaSchema(movimientoInventarioSchema);
export type KardexRespuesta = z.infer<typeof kardexRespuestaSchema>;

// --- Consultas (GET /ingredientes) ---

export const listarIngredientesQuerySchema = paginacionQuerySchema.extend({
  stockBajo: z.preprocess((val) => {
    if (typeof val === 'string') {
      if (val.toLowerCase() === 'true') return true;
      if (val.toLowerCase() === 'false') return false;
    }
    return val;
  }, z.boolean().optional()),
});
export type ListarIngredientesQuery = z.infer<typeof listarIngredientesQuerySchema>;
