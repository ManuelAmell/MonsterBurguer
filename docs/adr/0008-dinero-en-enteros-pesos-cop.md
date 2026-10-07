# ADR-008: Manejo de Dinero en Enteros (Pesos Colombianos - COP)

## Estado
Aceptado

## Fecha
2026-10-06

## Contexto
El cálculo de precios, bases imponibles, impuestos, propinas y totales en sistemas POS es propenso a errores de precisión si se utilizan tipos de coma flotante (`float`, `double` o números IEEE 754 de JavaScript), tales como `0.1 + 0.2 = 0.30000000000000004`.
En Colombia, la moneda oficial es el Peso Colombiano (COP), el cual no utiliza centavos ni fracciones en transacciones comerciales físicas corrientes.

## Decisión
Representar y operar todo valor monetario estrictamente como **enteros en pesos COP**:
- **Base de datos:** Columnas de tipo `bigint` con chequeos `CHECK (valor >= 0)`.
- **Backend y Frontend:** Tipo primitivo `number` (o `bigint` cuando sea requerido) tratado siempre como enteros exactos.
- **Cálculos centralizados:** Toda la aritmética de totales, base imponible e impuestos vive en una única función pura y testeada: `@mb/shared/money.ts` (`calcularTotales`, `propinaSugerida`, `formatearCOP`).
- **Redondeo:** Regla RN-04 con redondeo estándar *half-up* al peso entero para la base imponible (`round(total * 10000 / (10000 + tasaBp))`). La propina sugerida (RN-06) se redondea hacia abajo a la centena para garantizar que nunca exceda el 10 % del valor base.

## Consecuencias

### Positivas
- Precisión matemática absoluta: cero errores de redondeo de punto flotante en cálculos de recibos, pedidos y balances de caja.
- Aritmética nativa rápida sin necesidad de librerías externas de alta precisión (`decimal.js`, `bignumber.js`).
- Coincidencia exacta entre el total cobrado, el recibo impreso y el registro contable en la base de datos.

### Negativas / Riesgos
- Si en el futuro el sistema expande operaciones a monedas con decimales (USD, EUR) o maneja fracciones de centavo para costos unitarios muy pequeños, el modelo requeriría adaptación.

### Mitigaciones
- Para costos de inventario por unidad muy pequeña (por ejemplo, el costo de 1 gramo de carne o 1 ml de salsa), se utiliza una convención específica de milésimas de peso (`costo_unitario` en enteros multiplicado por 1.000, ver ADR-009).
