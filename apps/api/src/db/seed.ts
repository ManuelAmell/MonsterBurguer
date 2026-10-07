// Datos semilla de desarrollo: usuarios de prueba, categorías, productos, recetas e inventario. Idempotente.
// Uso: pnpm --filter api db:seed
import * as argon2 from 'argon2';
import { eq } from 'drizzle-orm';
import type { Rol, Unidad } from '@mb/shared';
import { crearDb, crearPool } from '../shared-kernel/db/db';
import { configuracion, CONFIGURACION_INICIAL } from '../shared-kernel/configuracion/configuracion.schema';
import { nuevoId } from '../shared-kernel/ids';
import { usuario } from '../modules/identidad/identidad.schema';
import { categoria, producto, recetaItem } from '../modules/catalogo/catalogo.schema';
import { ingrediente, movimientoInventario } from '../modules/inventario/inventario.schema';

const USUARIOS_DEMO: { nombre: string; username: string; password: string; rol: Rol }[] = [
  { nombre: 'Administrador', username: 'admin', password: 'admin123', rol: 'ADMIN' },
  { nombre: 'Caja 1', username: 'caja1', password: 'caja1234', rol: 'CAJERO' },
  { nombre: 'Cocina 1', username: 'cocina1', password: 'cocina1234', rol: 'COCINA' },
];

const CATEGORIAS_DEMO = [
  { nombre: 'Hamburguesas', orden: 1 },
  { nombre: 'Acompañamientos', orden: 2 },
  { nombre: 'Bebidas', orden: 3 },
  { nombre: 'Postres', orden: 4 },
  { nombre: 'Salsas y Adicionales', orden: 5 },
];

const INGREDIENTES_DEMO: Array<{
  nombre: string;
  unidad: Unidad;
  stockActual: number;
  stockMinimo: number;
  costoUnitario: number;
}> = [
  { nombre: 'Pan de Hamburguesa', unidad: 'UND', stockActual: 200, stockMinimo: 50, costoUnitario: 1200000 },
  { nombre: 'Pan Brioche', unidad: 'UND', stockActual: 150, stockMinimo: 40, costoUnitario: 1500000 },
  { nombre: 'Carne de Res 150g', unidad: 'G', stockActual: 30000, stockMinimo: 5000, costoUnitario: 35000 },
  { nombre: 'Carne Doble Res', unidad: 'G', stockActual: 20000, stockMinimo: 4000, costoUnitario: 35000 },
  { nombre: 'Pechuga de Pollo', unidad: 'G', stockActual: 15000, stockMinimo: 3000, costoUnitario: 25000 },
  { nombre: 'Queso Cheddar', unidad: 'G', stockActual: 8000, stockMinimo: 1500, costoUnitario: 40000 },
  { nombre: 'Queso Mozzarella', unidad: 'G', stockActual: 8000, stockMinimo: 1500, costoUnitario: 38000 },
  { nombre: 'Tocineta Ahumada', unidad: 'G', stockActual: 6000, stockMinimo: 1000, costoUnitario: 50000 },
  { nombre: 'Cebolla Caramelizada', unidad: 'G', stockActual: 5000, stockMinimo: 1000, costoUnitario: 15000 },
  { nombre: 'Cebolla Crispy', unidad: 'G', stockActual: 4000, stockMinimo: 800, costoUnitario: 20000 },
  { nombre: 'Lechuga Fresca', unidad: 'G', stockActual: 5000, stockMinimo: 1000, costoUnitario: 8000 },
  { nombre: 'Tomate Rojo', unidad: 'G', stockActual: 6000, stockMinimo: 1000, costoUnitario: 10000 },
  { nombre: 'Papa Francesa Congelada', unidad: 'G', stockActual: 40000, stockMinimo: 8000, costoUnitario: 12000 },
  { nombre: 'Papa Criolla', unidad: 'G', stockActual: 20000, stockMinimo: 4000, costoUnitario: 10000 },
  { nombre: 'Salsa Monster de la Casa', unidad: 'ML', stockActual: 10000, stockMinimo: 2000, costoUnitario: 18000 },
  { nombre: 'Salsa BBQ Artesanal', unidad: 'ML', stockActual: 8000, stockMinimo: 1500, costoUnitario: 16000 },
  { nombre: 'Mayonesa Ajo', unidad: 'ML', stockActual: 8000, stockMinimo: 1500, costoUnitario: 15000 },
  { nombre: 'Coca-Cola 400ml', unidad: 'UND', stockActual: 100, stockMinimo: 24, costoUnitario: 2800000 },
  { nombre: 'Coca-Cola Zero 400ml', unidad: 'UND', stockActual: 80, stockMinimo: 20, costoUnitario: 2800000 },
  { nombre: 'Agua Cristal 500ml', unidad: 'UND', stockActual: 60, stockMinimo: 15, costoUnitario: 1500000 },
  { nombre: 'Cerveza Corona 330ml', unidad: 'UND', stockActual: 50, stockMinimo: 12, costoUnitario: 5000000 },
  { nombre: 'Helado Vainilla', unidad: 'G', stockActual: 10000, stockMinimo: 2000, costoUnitario: 22000 },
  { nombre: 'Brownie de Chocolate', unidad: 'UND', stockActual: 40, stockMinimo: 10, costoUnitario: 3500000 },
];

interface RecetaDef {
  ingrediente: string;
  cantidad: number;
}

const PRODUCTOS_DEMO: Array<{
  categoria: string;
  nombre: string;
  descripcion: string;
  precio: number;
  orden: number;
  receta: RecetaDef[];
}> = [
  {
    categoria: 'Hamburguesas',
    nombre: 'Monster Clásica',
    descripcion: '150g carne de res, queso cheddar, lechuga, tomate y salsa monster en pan clásico',
    precio: 24900,
    orden: 1,
    receta: [
      { ingrediente: 'Pan de Hamburguesa', cantidad: 1 },
      { ingrediente: 'Carne de Res 150g', cantidad: 150 },
      { ingrediente: 'Queso Cheddar', cantidad: 30 },
      { ingrediente: 'Lechuga Fresca', cantidad: 20 },
      { ingrediente: 'Tomate Rojo', cantidad: 30 },
      { ingrediente: 'Salsa Monster de la Casa', cantidad: 25 },
    ],
  },
  {
    categoria: 'Hamburguesas',
    nombre: 'Monster Bacon',
    descripcion: '150g carne, doble tocineta ahumada, queso cheddar y cebolla caramelizada en pan brioche',
    precio: 28900,
    orden: 2,
    receta: [
      { ingrediente: 'Pan Brioche', cantidad: 1 },
      { ingrediente: 'Carne de Res 150g', cantidad: 150 },
      { ingrediente: 'Queso Cheddar', cantidad: 40 },
      { ingrediente: 'Tocineta Ahumada', cantidad: 50 },
      { ingrediente: 'Cebolla Caramelizada', cantidad: 30 },
      { ingrediente: 'Salsa BBQ Artesanal', cantidad: 25 },
    ],
  },
  {
    categoria: 'Hamburguesas',
    nombre: 'Monster Doble Poder',
    descripcion: '300g carne de res doble, doble cheddar, tocineta y salsa monster',
    precio: 34900,
    orden: 3,
    receta: [
      { ingrediente: 'Pan Brioche', cantidad: 1 },
      { ingrediente: 'Carne Doble Res', cantidad: 300 },
      { ingrediente: 'Queso Cheddar', cantidad: 60 },
      { ingrediente: 'Tocineta Ahumada', cantidad: 60 },
      { ingrediente: 'Salsa Monster de la Casa', cantidad: 30 },
    ],
  },
  {
    categoria: 'Hamburguesas',
    nombre: 'Crispy Chicken Burger',
    descripcion: 'Pechuga de pollo crujiente 150g, queso mozzarella, lechuga y mayonesa ajo',
    precio: 23900,
    orden: 4,
    receta: [
      { ingrediente: 'Pan de Hamburguesa', cantidad: 1 },
      { ingrediente: 'Pechuga de Pollo', cantidad: 150 },
      { ingrediente: 'Queso Mozzarella', cantidad: 30 },
      { ingrediente: 'Lechuga Fresca', cantidad: 20 },
      { ingrediente: 'Mayonesa Ajo', cantidad: 25 },
    ],
  },
  {
    categoria: 'Hamburguesas',
    nombre: 'Monster BBQ Onion',
    descripcion: '150g carne, cheddar, cebolla crispy y salsa BBQ en pan clásico',
    precio: 27900,
    orden: 5,
    receta: [
      { ingrediente: 'Pan de Hamburguesa', cantidad: 1 },
      { ingrediente: 'Carne de Res 150g', cantidad: 150 },
      { ingrediente: 'Queso Cheddar', cantidad: 30 },
      { ingrediente: 'Cebolla Crispy', cantidad: 30 },
      { ingrediente: 'Salsa BBQ Artesanal', cantidad: 30 },
    ],
  },
  {
    categoria: 'Acompañamientos',
    nombre: 'Papas Francesas Clásicas',
    descripcion: '200g de papas fritas crujientes con sal marina',
    precio: 8900,
    orden: 1,
    receta: [{ ingrediente: 'Papa Francesa Congelada', cantidad: 200 }],
  },
  {
    categoria: 'Acompañamientos',
    nombre: 'Papas Monster Cheddar & Bacon',
    descripcion: '250g de papas con abundante queso cheddar fundido y trozos de tocineta',
    precio: 14900,
    orden: 2,
    receta: [
      { ingrediente: 'Papa Francesa Congelada', cantidad: 250 },
      { ingrediente: 'Queso Cheddar', cantidad: 50 },
      { ingrediente: 'Tocineta Ahumada', cantidad: 40 },
      { ingrediente: 'Salsa Monster de la Casa', cantidad: 30 },
    ],
  },
  {
    categoria: 'Acompañamientos',
    nombre: 'Papas Criollas Rústicas',
    descripcion: '250g de papas criollas doradas acompañadas de mayonesa de ajo',
    precio: 9900,
    orden: 3,
    receta: [
      { ingrediente: 'Papa Criolla', cantidad: 250 },
      { ingrediente: 'Mayonesa Ajo', cantidad: 30 },
    ],
  },
  {
    categoria: 'Bebidas',
    nombre: 'Coca-Cola Original 400ml',
    descripcion: 'Botella de vidrio 400ml helada',
    precio: 5500,
    orden: 1,
    receta: [{ ingrediente: 'Coca-Cola 400ml', cantidad: 1 }],
  },
  {
    categoria: 'Bebidas',
    nombre: 'Coca-Cola Sin Azúcar 400ml',
    descripcion: 'Botella 400ml sin azúcar',
    precio: 5500,
    orden: 2,
    receta: [{ ingrediente: 'Coca-Cola Zero 400ml', cantidad: 1 }],
  },
  {
    categoria: 'Bebidas',
    nombre: 'Agua Mineral 500ml',
    descripcion: 'Agua purificada sin gas',
    precio: 4000,
    orden: 3,
    receta: [{ ingrediente: 'Agua Cristal 500ml', cantidad: 1 }],
  },
  {
    categoria: 'Bebidas',
    nombre: 'Cerveza Corona 330ml',
    descripcion: 'Cerveza importada 330ml',
    precio: 9500,
    orden: 4,
    receta: [{ ingrediente: 'Cerveza Corona 330ml', cantidad: 1 }],
  },
  {
    categoria: 'Postres',
    nombre: 'Brownie Melcochudo con Helado',
    descripcion: 'Brownie caliente de chocolate con bola de helado de vainilla',
    precio: 12900,
    orden: 1,
    receta: [
      { ingrediente: 'Brownie de Chocolate', cantidad: 1 },
      { ingrediente: 'Helado Vainilla', cantidad: 80 },
    ],
  },
  {
    categoria: 'Postres',
    nombre: 'Malteada de Vainilla 16oz',
    descripcion: 'Cremosa malteada preparada con helado artesanal de vainilla',
    precio: 11900,
    orden: 2,
    receta: [{ ingrediente: 'Helado Vainilla', cantidad: 200 }],
  },
  {
    categoria: 'Salsas y Adicionales',
    nombre: 'Porción Salsa Monster Extra',
    descripcion: 'Copa de salsa secreta de la casa 50ml',
    precio: 3000,
    orden: 1,
    receta: [{ ingrediente: 'Salsa Monster de la Casa', cantidad: 50 }],
  },
  {
    categoria: 'Salsas y Adicionales',
    nombre: 'Porción Salsa BBQ Extra',
    descripcion: 'Copa de salsa BBQ artesanal 50ml',
    precio: 3000,
    orden: 2,
    receta: [{ ingrediente: 'Salsa BBQ Artesanal', cantidad: 50 }],
  },
];

async function main(): Promise<void> {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error('Falta DATABASE_URL');
  if (process.env.NODE_ENV === 'production') {
    throw new Error('El seed de demo no se ejecuta en producción');
  }

  const pool = crearPool(url);
  const db = crearDb(pool);
  try {
    // 1. Usuarios demo
    let adminId = '';
    for (const u of USUARIOS_DEMO) {
      const [usr] = await db
        .insert(usuario)
        .values({
          id: nuevoId(),
          nombre: u.nombre,
          username: u.username,
          passwordHash: await argon2.hash(u.password, { type: argon2.argon2id }),
          rol: u.rol,
        })
        .onConflictDoNothing({ target: usuario.username })
        .returning({ id: usuario.id });
      if (u.username === 'admin') {
        if (usr) {
          adminId = usr.id;
        } else {
          const [existente] = await db.select({ id: usuario.id }).from(usuario).where(eq(usuario.username, 'admin'));
          adminId = existente?.id ?? '';
        }
      }
    }

    // 2. Configuración inicial
    await db
      .insert(configuracion)
      .values(Object.entries(CONFIGURACION_INICIAL).map(([clave, valor]) => ({ clave, valor })))
      .onConflictDoNothing({ target: configuracion.clave });

    // 3. Categorías
    const mapaCategorias = new Map<string, string>();
    for (const cat of CATEGORIAS_DEMO) {
      const [insertada] = await db
        .insert(categoria)
        .values({
          id: nuevoId(),
          nombre: cat.nombre,
          orden: cat.orden,
          activa: true,
        })
        .onConflictDoNothing({ target: categoria.nombre })
        .returning({ id: categoria.id, nombre: categoria.nombre });

      if (insertada) {
        mapaCategorias.set(insertada.nombre, insertada.id);
      } else {
        const [existente] = await db.select().from(categoria).where(eq(categoria.nombre, cat.nombre));
        if (existente) mapaCategorias.set(existente.nombre, existente.id);
      }
    }

    // 4. Ingredientes + Movimiento inicial (RN-34)
    const mapaIngredientes = new Map<string, string>();
    for (const ing of INGREDIENTES_DEMO) {
      const [insertado] = await db
        .insert(ingrediente)
        .values({
          id: nuevoId(),
          nombre: ing.nombre,
          unidad: ing.unidad,
          stockActual: ing.stockActual,
          stockMinimo: ing.stockMinimo,
          costoUnitario: ing.costoUnitario,
          activo: true,
        })
        .onConflictDoNothing({ target: ingrediente.nombre })
        .returning({ id: ingrediente.id, nombre: ingrediente.nombre, stockActual: ingrediente.stockActual });

      if (insertado) {
        mapaIngredientes.set(insertado.nombre, insertado.id);
        // Movimiento inicial de entrada para consistencia del kardex (RN-34)
        if (ing.stockActual > 0 && adminId) {
          await db.insert(movimientoInventario).values({
            id: nuevoId(),
            ingredienteId: insertado.id,
            tipo: 'ENTRADA',
            cantidad: ing.stockActual,
            stockResultante: ing.stockActual,
            referenciaTipo: 'INVENTARIO_INICIAL',
            usuarioId: adminId,
            motivo: 'Inventario inicial de apertura',
          });
        }
      } else {
        const [existente] = await db.select().from(ingrediente).where(eq(ingrediente.nombre, ing.nombre));
        if (existente) mapaIngredientes.set(existente.nombre, existente.id);
      }
    }

    // 5. Productos y Recetas
    for (const prod of PRODUCTOS_DEMO) {
      const categoriaId = mapaCategorias.get(prod.categoria);
      if (!categoriaId) continue;

      const [existente] = await db.select().from(producto).where(eq(producto.nombre, prod.nombre));
      let productoId = existente?.id;

      if (!productoId) {
        const [insertado] = await db
          .insert(producto)
          .values({
            id: nuevoId(),
            categoriaId,
            nombre: prod.nombre,
            descripcion: prod.descripcion,
            precio: prod.precio,
            orden: prod.orden,
            activo: true,
            agotado: false,
          })
          .returning({ id: producto.id });
        productoId = insertado?.id;
      }

      if (productoId && prod.receta.length > 0) {
        for (const item of prod.receta) {
          const ingredienteId = mapaIngredientes.get(item.ingrediente);
          if (ingredienteId) {
            await db
              .insert(recetaItem)
              .values({
                productoId,
                ingredienteId,
                cantidad: item.cantidad,
              })
              .onConflictDoNothing();
          }
        }
      }
    }

    console.info(
      `Seed listo: 3 usuarios, ${mapaCategorias.size} categorías, ${mapaIngredientes.size} ingredientes, ${PRODUCTOS_DEMO.length} productos con receta.`,
    );
  } finally {
    await pool.end();
  }
}

main().catch((err: unknown) => {
  console.error(err);
  process.exit(1);
});
