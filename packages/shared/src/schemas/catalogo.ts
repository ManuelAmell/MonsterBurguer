import { z } from 'zod';
import { UNIDADES } from '../enums';
import { paginacionQuerySchema, uuidSchema } from './common';

// --- Categoría ---

export const categoriaSchema = z.object({
  id: uuidSchema,
  nombre: z
    .string()
    .trim()
    .min(1, 'El nombre de la categoría es obligatorio')
    .max(100, 'El nombre de la categoría no puede superar 100 caracteres'),
  orden: z
    .number()
    .int('El orden debe ser un número entero')
    .min(0, 'El orden no puede ser negativo')
    .default(0),
  activa: z.boolean().default(true),
  createdAt: z.string().optional(),
  updatedAt: z.string().optional(),
});
export type Categoria = z.infer<typeof categoriaSchema>;

export const crearCategoriaSchema = z.object({
  nombre: z
    .string()
    .trim()
    .min(1, 'El nombre de la categoría es obligatorio')
    .max(100, 'El nombre de la categoría no puede superar 100 caracteres'),
  orden: z
    .number()
    .int('El orden debe ser un número entero')
    .min(0, 'El orden no puede ser negativo')
    .default(0)
    .optional(),
  activa: z.boolean().default(true).optional(),
});
export type CrearCategoriaInput = z.input<typeof crearCategoriaSchema>;
export type CrearCategoriaOutput = z.infer<typeof crearCategoriaSchema>;

export const editarCategoriaSchema = z.object({
  nombre: z
    .string()
    .trim()
    .min(1, 'El nombre de la categoría no puede estar vacío')
    .max(100, 'El nombre de la categoría no puede superar 100 caracteres')
    .optional(),
  orden: z
    .number()
    .int('El orden debe ser un número entero')
    .min(0, 'El orden no puede ser negativo')
    .optional(),
  activa: z.boolean().optional(),
});
export type EditarCategoriaInput = z.input<typeof editarCategoriaSchema>;
export type EditarCategoriaOutput = z.infer<typeof editarCategoriaSchema>;

// --- Receta ---

export const recetaItemSchema = z.object({
  ingredienteId: uuidSchema,
  cantidad: z
    .number()
    .int('La cantidad debe ser un número entero (RN-30)')
    .positive('La cantidad de ingrediente debe ser mayor a 0'),
});
export type RecetaItem = z.infer<typeof recetaItemSchema>;

export const actualizarRecetaSchema = z.object({
  items: z.array(recetaItemSchema).refine((items) => {
    const ids = items.map((i) => i.ingredienteId);
    return new Set(ids).size === ids.length;
  }, 'No se pueden repetir ingredientes en la misma receta'),
});
export type ActualizarRecetaInput = z.input<typeof actualizarRecetaSchema>;
export type ActualizarRecetaOutput = z.infer<typeof actualizarRecetaSchema>;

export const recetaItemDetalleSchema = z.object({
  ingredienteId: uuidSchema,
  nombre: z.string(),
  unidad: z.enum(UNIDADES),
  cantidad: z
    .number()
    .int('La cantidad debe ser un número entero (RN-30)')
    .positive('La cantidad debe ser mayor a 0'),
});
export type RecetaItemDetalle = z.infer<typeof recetaItemDetalleSchema>;

// --- Producto ---

export const productoSchema = z.object({
  id: uuidSchema,
  categoriaId: uuidSchema,
  nombre: z
    .string()
    .trim()
    .min(1, 'El nombre del producto es obligatorio')
    .max(100, 'El nombre del producto no puede superar 100 caracteres'),
  descripcion: z
    .string()
    .max(500, 'La descripción no puede superar 500 caracteres')
    .nullable()
    .optional(),
  precio: z
    .number()
    .int('El precio debe ser un número entero en pesos COP (RN-01)')
    .positive('El precio debe ser un entero mayor a 0 en COP (RN-02)'),
  imagenUrl: z
    .string()
    .url('La imagen debe ser una URL válida')
    .nullable()
    .optional()
    .or(z.literal('')),
  activo: z.boolean().default(true),
  agotado: z.boolean().default(false),
  agotadoManual: z.boolean().nullable().optional(),
  orden: z
    .number()
    .int('El orden debe ser un número entero')
    .min(0, 'El orden no puede ser negativo')
    .default(0),
  createdAt: z.string().optional(),
  updatedAt: z.string().optional(),
});
export type Producto = z.infer<typeof productoSchema>;

export const crearProductoSchema = z.object({
  categoriaId: uuidSchema,
  nombre: z
    .string()
    .trim()
    .min(1, 'El nombre del producto es obligatorio')
    .max(100, 'El nombre del producto no puede superar 100 caracteres'),
  descripcion: z
    .string()
    .max(500, 'La descripción no puede superar 500 caracteres')
    .nullable()
    .optional(),
  precio: z
    .number()
    .int('El precio debe ser un número entero en pesos COP (RN-01)')
    .positive('El precio debe ser un entero mayor a 0 en COP (RN-02)'),
  imagenUrl: z
    .string()
    .url('La imagen debe ser una URL válida')
    .nullable()
    .optional()
    .or(z.literal('')),
  activo: z.boolean().default(true).optional(),
  orden: z
    .number()
    .int('El orden debe ser un número entero')
    .min(0, 'El orden no puede ser negativo')
    .default(0)
    .optional(),
});
export type CrearProductoInput = z.input<typeof crearProductoSchema>;
export type CrearProductoOutput = z.infer<typeof crearProductoSchema>;

export const editarProductoSchema = z.object({
  categoriaId: uuidSchema.optional(),
  nombre: z
    .string()
    .trim()
    .min(1, 'El nombre del producto no puede estar vacío')
    .max(100, 'El nombre del producto no puede superar 100 caracteres')
    .optional(),
  descripcion: z
    .string()
    .max(500, 'La descripción no puede superar 500 caracteres')
    .nullable()
    .optional(),
  precio: z
    .number()
    .int('El precio debe ser un número entero en pesos COP (RN-01)')
    .positive('El precio debe ser un entero mayor a 0 en COP (RN-02)')
    .optional(),
  imagenUrl: z
    .string()
    .url('La imagen debe ser una URL válida')
    .nullable()
    .optional()
    .or(z.literal('')),
  activo: z.boolean().optional(),
  orden: z
    .number()
    .int('El orden debe ser un número entero')
    .min(0, 'El orden no puede ser negativo')
    .optional(),
});
export type EditarProductoInput = z.input<typeof editarProductoSchema>;
export type EditarProductoOutput = z.infer<typeof editarProductoSchema>;

export const actualizarAgotadoManualSchema = z.object({
  agotadoManual: z.boolean().nullable(),
});
export type ActualizarAgotadoManualInput = z.input<typeof actualizarAgotadoManualSchema>;
export type ActualizarAgotadoManualOutput = z.infer<typeof actualizarAgotadoManualSchema>;

export const productoDetalleSchema = productoSchema.extend({
  receta: z.array(recetaItemDetalleSchema),
});
export type ProductoDetalle = z.infer<typeof productoDetalleSchema>;

// --- Menú del POS (GET /catalogo/menu) ---

export const productoMenuSchema = z.object({
  id: uuidSchema,
  nombre: z.string(),
  descripcion: z.string().nullable().optional(),
  precio: z.number().int().positive(),
  imagenUrl: z.string().nullable().optional(),
  agotado: z.boolean(),
  orden: z.number().int(),
});
export type ProductoMenu = z.infer<typeof productoMenuSchema>;

export const categoriaMenuSchema = z.object({
  id: uuidSchema,
  nombre: z.string(),
  orden: z.number().int(),
  productos: z.array(productoMenuSchema),
});
export type CategoriaMenu = z.infer<typeof categoriaMenuSchema>;

export const menuPosSchema = z.array(categoriaMenuSchema);
export type MenuPos = z.infer<typeof menuPosSchema>;

// --- Consultas (GET /productos) ---

export const listarProductosQuerySchema = paginacionQuerySchema.extend({
  categoriaId: uuidSchema.optional(),
  activo: z.preprocess((val) => {
    if (typeof val === 'string') {
      if (val.toLowerCase() === 'true') return true;
      if (val.toLowerCase() === 'false') return false;
    }
    return val;
  }, z.boolean().optional()),
  sinReceta: z.preprocess((val) => {
    if (typeof val === 'string') {
      if (val.toLowerCase() === 'true') return true;
      if (val.toLowerCase() === 'false') return false;
    }
    return val;
  }, z.boolean().optional()),
});
export type ListarProductosQuery = z.infer<typeof listarProductosQuerySchema>;
