# ADR-0012: Puerto de Emisión para Documento Equivalente Electrónico POS (DEE POS) y Proveedor Simulado

## Estado
Propuesto

## Fecha
2026-11-09

## Contexto
En el ADR-0011 se estableció que MonsterBurguer operaría inicialmente bajo el régimen `NO_RESPONSABLE` del Impuesto Nacional al Consumo (art. 512-13 del Estatuto Tributario), emitiendo recibos internos rotulados como "Documento no fiscal" (RN-45) y difiriendo la integración con un Proveedor Tecnológico autorizado por la DIAN para la versión 2.0 (v2).

La Resolución 000165 de 2023 de la DIAN reglamenta la adopción del **Documento Equivalente Electrónico tiquete de máquina registradora con sistema POS (DEE POS)**, exigiendo generación de Código Único de Documento Equivalente (CUDE), código bidimensional QR con URL de consulta ante el catálogo de la DIAN, firma digital y transmisión electrónica.

Para dar inicio a la preparación de la versión 2.0 sin generar acoplamiento prematuro ni costos operativos de contratación o consumo de APIs externas durante el desarrollo del restaurante:
1. Se requiere desacoplar el dominio del punto de venta de cualquier proveedor tecnológico específico (e.g. Siigo, Factus, The Factory HKA, Carvajal, Alegra) mediante un puerto de Arquitectura Hexagonal (*Ports & Adapters*).
2. Se necesita un adaptador simulado en memoria que retorne valores representativos (CUDE y QR simulados), permitiendo validar flujos de punta a punta en tests unitarios, de integración y ambientes de desarrollo sin llamadas a red ni dependencias de sandboxes de terceros.
3. Se requiere un flag de configuración (`dee_pos_habilitado`) desactivado por defecto, de modo que el comportamiento actual del sistema permanezca 100 % idéntico mientras no se decida activar explícitamente la emisión electrónica.

## Decisión

1. **Definición del Puerto:**  
   Definir en el módulo `caja` (subsistema de Facturación) el puerto e interfaz `EmisorDocumentoElectronico` con el token de inyección `EMISOR_DOCUMENTO_ELECTRONICO`. El contrato recibe la información canónica de la venta (`reciboId`, `numero`, `fecha`, `total`, `base`, `impuesto`, `impuestoTasaBp`, `regimenTributario`, `propina`, `items`, `pagos`, datos del negocio) y devuelve `ResultadoEmisionDocumento` (`cude`, `qr`, `proveedor`, `fechaEmision`).

2. **Adaptador Simulado (`ProveedorSimulado`):**  
   Implementar el adaptador `ProveedorSimulado` registrado por defecto en `CajaModule`. Este adaptador genera un CUDE simulado derivado de un hash determinista con prefijo expreso `SIMULADO-CUDE-`, una URL de consulta simulada con prefijo `SIMULADO-`, y marca el proveedor como `SIMULADO`. No implementa el algoritmo criptográfico SHA-384 real de la DIAN ni la generación de XML con estándar UBL 2.1, dejando dicha responsabilidad exclusivamente al proveedor real.

3. **Flag de Configuración (`dee_pos_habilitado`):**  
   Incorporar la clave `dee_pos_habilitado` en la tabla `configuracion` (y compatible con variable de entorno `DEE_POS_HABILITADO`), configurada en `false` por defecto:
   - **Flag apagado (`false`):** El comportamiento del cobro y recibo es exactamente el actual; el recibo se rotula como "Documento no fiscal" (RN-45), la leyenda fiscal es "No responsable de INC" y **el puerto no es invocado**.
   - **Flag encendido (`true`):** Al procesar el cobro atómico, se invoca el puerto `EmisorDocumentoElectronico`, se persiste el resultado en la tabla `documento_electronico` y se expone el CUDE y QR en la consulta del recibo (`GET /api/v1/recibos/:id`), ajustando las leyendas a "Documento Equivalente Electrónico POS".

4. **Persistencia Dedicada (`documento_electronico`):**  
   Crear una tabla relacional independiente `documento_electronico` asociada 1:1 con `recibo` mediante clave foránea en cascada, almacenando `recibo_id`, `cude`, `qr`, `proveedor`, `estado` (`EMITIDO`, `RECHAZADO`, `CONTINGENCIA`) y `created_at`. Esta separación evita contaminar la entidad base `recibo` y permite en v2 añadir trazabilidad técnica (XML firmado, respuestas SOAP/REST, UUIDs de transacción DIAN).

5. **Pendientes para un Proveedor Tecnológico Real:**  
   Para completar la integración en v2 se requerirá:
   - Contratación de un Proveedor Tecnológico (PT) avalado por la DIAN o proceso de habilitación como emisor directo.
   - Parámetros y credenciales DIAN: TestSetId, ID de software, PIN de software, clave técnica de control DIAN y certificado de firma digital X.509 vigente.
   - Implementación de un adaptador real (ej. `ProveedorFactusAdaptador` o `ProveedorSiigoAdaptador`) que traduzca el contrato `DatosEmisionDocumento` a la API HTTP del proveedor.
   - Definición de política de tolerancia a fallos: emisión síncrona con timeout estricto o emisión asíncrona mediante outbox/worker para evitar que caídas del servicio del PT bloqueen la cola de mostrador.
   - Captura y validación de datos de cliente para Factura Electrónica de Venta (FEV) cuando el comensal solicite expresamente factura formal (requiere NIT/cédula, razón social, correo para entrega del XML/PDF y responsabilidades fiscales).

## Consecuencias

### Positivas
- **Desacoplamiento arquitectónico:** Cero acoplamiento a SDKs o formatos propietarios de un proveedor externo específico.
- **Cero regresión:** Con el flag apagado, las pruebas automáticas y la operación diaria del restaurante mantienen un comportamiento idéntico al régimen actual.
- **Testabilidad total:** Pruebas unitarias y de integración completas sin dependencias de red, certificados digitales ni costos por tiquete en sandboxes externos.
- **Fácil transición a producción:** La adopción del proveedor real solo exigirá agregar una nueva clase adaptadora e inyectarla en lugar de la simulada, sin modificar la lógica de cobro de `caja.service.ts`.

### Negativas / Riesgos
- Los documentos emitidos en modo simulado no tienen validez legal ni fiscal ante la DIAN.

### Mitigaciones
- El flag permanece desactivado por defecto en todos los entornos excepto donde se active conscientemente para pruebas.
- Todos los CUDEs y URLs simulados llevan obligatoriamente el prefijo `SIMULADO-`, garantizando que nunca se confundan con una emisión real.
