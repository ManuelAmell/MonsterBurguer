import { z } from 'zod';

export const configuracionNegocioSchema = z.object({
  nombre: z
    .string()
    .trim()
    .min(1, 'El nombre del negocio es obligatorio')
    .max(100, 'El nombre del negocio no puede superar 100 caracteres'),
  nit: z.string().trim().max(30, 'El NIT no puede superar 30 caracteres').default(''),
  direccion: z.string().trim().max(200, 'La dirección no puede superar 200 caracteres').default(''),
  telefono: z.string().trim().max(50, 'El teléfono no puede superar 50 caracteres').default(''),
  pieRecibo: z.string().trim().max(300, 'El pie de recibo no puede superar 300 caracteres').default(''),
  propinaSugeridaPorcentaje: z
    .number()
    .min(0, 'El porcentaje de propina no puede ser negativo')
    .max(10, 'La propina sugerida no puede superar el 10 % (Ley 1935 de 2018)'),
  horaCorte: z
    .string()
    .trim()
    .regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'La hora de corte debe tener formato HH:mm (ej. 05:00)'),
});

export type ConfiguracionNegocioInput = z.input<typeof configuracionNegocioSchema>;
export type ConfiguracionNegocio = z.infer<typeof configuracionNegocioSchema>;
