# ADR-009: Cantidades de Inventario en Enteros de Unidad Base (`G`, `ML`, `UND`)

## Estado
Aceptado

## Fecha
2026-10-06

## Contexto
El cálculo de inventario por recetas de cocina requiere descontar ingredientes en diferentes magnitudes físicas: gramos de carne o queso, mililitros de salsa o aceite, y unidades de pan, bebidas o brownies.
El uso de unidades compuestas con decimales (por ejemplo, registrar `0.150 kg` de carne o `0.025 L` de salsa en columnas `numeric(12,3)`) suele introducir inconsistencias de conversión, errores de entrada en formularios y complicaciones en operaciones de suma y resta directa.

## Decisión
Expresar todo el inventario, recetas y movimientos exclusivamente en **unidades base enteras**:
- **Unidades admitidas:** `G` (gramos), `ML` (mililitros) y `UND` (unidades discretas).
- **Tipos en BD:** Columnas `stock_actual`, `stock_minimo`, `cantidad` en `bigint` / `integer`.
- **Regla de stock:** Las recetas especifican enteros en la unidad base del ingrediente (por ejemplo, 150 gramos de carne = `150 G`, 25 mililitros de salsa = `25 ML`, 1 pan brioche = `1 UND`).
- **Costos unitarios:** Para mantener precisión sin decimales, la columna `ingrediente.costo_unitario` se almacena en milésimas de peso COP por unidad base (valor × 1.000).

## Consecuencias

### Positivas
- Operaciones de suma, resta y validación de stock ejecutadas con aritmética entera atómica y exacta en TypeScript y PostgreSQL.
- Regla de negocio RN-32 (consumo atómico con `SELECT ... FOR UPDATE` ordenado por ID) sin discrepancias por conversiones de unidades.
- Facilidad de lectura para cocina e inventario: el personal pesa y mide en gramos y mililitros directamente.

### Negativas / Riesgos
- Al presentar datos a proveedores en compras al por mayor (bultos de 25 kg, canecas de 20 L), se requiere convertir a la unidad base al registrar la entrada.

### Mitigaciones
- En los formularios de entradas de inventario o en futuras vistas de compras, la interfaz puede ofrecer convertidores automáticos que traduzcan kilos a gramos antes de enviar la petición a la API.
