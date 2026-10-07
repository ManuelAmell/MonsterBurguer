# ADR-011: Régimen NO_RESPONSABLE Parametrizable y Recibo Interno No Fiscal (DEE POS Diferido)

## Estado
Aceptado

## Fecha
2026-10-06

## Contexto
El restaurante MonsterBurguer se encuentra en etapa de validación operativa inicial y cumple las condiciones del artículo 512-13 del Estatuto Tributario colombiano para ser catalogado como **No responsable del Impuesto Nacional al Consumo (INC)** (persona natural, ingresos brutos menores a 3.500 UVT y un único establecimiento de comercio).
Bajo esta condición legal, el establecimiento no debe cobrar ni discriminar impuesto al consumidor final.
Por otra parte, la Resolución 000165 de 2023 de la DIAN reglamenta el Documento Equivalente Electrónico POS (DEE POS con código CUDE y código QR) y la Factura Electrónica de Venta obligatoria para contribuyentes formales o ante solicitud del cliente. Integrar un Proveedor Tecnológico autorizado por la DIAN durante la fase MVP aumentaría el costo y la complejidad inicial sin aportar valor a las pruebas de flujo del negocio en cocina y caja.

## Decisión
1. **Régimen tributario por defecto:** Configurar el régimen inicial como `NO_RESPONSABLE`:
   - Tasa de impuesto en cero (`impuesto_tasa_bp = 0`).
   - El precio exhibido es el precio final completo (RN-02).
   - En la interfaz y en los recibos impresos no se desglosa línea de impuesto ni se añade cobro extra.
2. **Parametrización flexible:** La tabla `configuracion` y la lógica de `@mb/shared/money.ts` soportan el cambio a regímenes fiscales (`INC_8` al 8 % o `IVA_19` al 19 %) sin requerir cambios de código fuente, simplemente actualizando la clave `regimen_tributario`.
3. **Recibo interno rotulado:** El sistema emite un recibo POS con consecutivo global (`R-XXXXXX`), rotulado obligatoriamente como **"Documento no fiscal"** y con la leyenda **"No responsable de INC"** (RN-45).
4. **Diferimiento legal formal:** La integración con un Proveedor Tecnológico DIAN para la emisión de DEE POS y Factura Electrónica se difiere para la versión 2.0 (v2), siendo requisito previo indispensable antes de la apertura comercial formal abierta al público.

## Consecuencias

### Positivas
- Cumplimiento estricto del régimen fiscal real del negocio sin inventar cobros de impuestos ficticios a los clientes.
- Cero dependencias de APIs externas de facturación electrónica durante el desarrollo y pruebas del MVP.
- Preparación arquitectónica total para adoptar INC (8 %) o IVA (19 %) mediante un simple cambio de configuración.

### Negativas / Riesgos
- El recibo emitido no tiene valor tributario para deducciones fiscales del cliente ni para reporte directo a la DIAN.

### Mitigaciones
- Rotulación expresa en el ticket físico e informativo en el local comercial.
- Roadmap formal (v2) que contempla la integración con un proveedor tecnológico avalado por la DIAN para emisión electrónica.
