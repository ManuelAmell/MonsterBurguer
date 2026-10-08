# Reporte de Entrega — Documentación Académica MonsterBurguer POS
**Curso:** Ingeniería de Software | **Programa:** Ingeniería de Sistemas — Universidad de Cartagena  
**Docente:** Ing. Martín Monroy Ríos, MSc, PhD  
**Rol del Agente:** DOCUMENTADOR  
**Fecha de Generación:** Octubre de 2026  

---

## 1. Resumen Ejecutivo
Se generó de forma completa, rigurosa y verificable la suite de documentación académica y artefactos de modelado para el proyecto **MonsterBurguer POS**, siguiendo estrictamente las plantillas y lineamientos de la Universidad de Cartagena (normas ICONTEC, redacción impersonal, estructura ISO/IEC/IEEE 29148 y Vistas 4+1 de Kruchten).

Todos los documentos fueron elaborados sobre las plantillas originales de Word `.docx` preservando estilos, encabezados y tablas, e incorporando los diagramas PlantUML exportados a PNG con proporciones optimizadas tras la revisión del orquestador. Las fichas de casos de uso fueron generadas en un libro Excel `.xlsx` copiando fidedignamente la plantilla original celda por celda.

---

## 2. Archivos Generados y Métricas de Contenido

### 2.1 Documentos Principales (.docx y .xlsx)
Ubicación: `docs/entregables-isoft/`

| Archivo | Tamaño | Secciones / Párrafos | Tablas | Figuras PNG | Estado de Integridad |
|---|---|---|:---:|:---:|---|
| **`Informe de Proyecto - MonsterBurguer.docx`** | 1.66 MB | 8 secciones principales, 108 párrafos | 1 | N/A | Verificado OK (abierto y validado con python-docx) |
| **`Manual del Sistema - MonsterBurguer.docx`** | 4.47 MB | 5 capítulos, Vistas 4+1, 187 párrafos | 9 | 17 | Verificado OK (17 diagramas PNG insertados con pie de figura) |
| **`Manual de Usuario - MonsterBurguer.docx`** | 2.70 MB | 4 capítulos por rol, 159 párrafos | 1 | 13 marcadores | Verificado OK (estructura por rol con marcadores de captura) |
| **`Especificacion de Requisitos - MonsterBurguer.docx`** | 2.71 MB | Estructura ISO/IEC/IEEE 29148, 260 párrafos | 1 | N/A | Verificado OK (18 RF detallados y 8 RNF categorizados) |
| **`Casos de Uso - MonsterBurguer.xlsx`** | 57.7 KB | 18 hojas (`CU-01` a `CU-18`) | 18 fichas | N/A | Verificado OK (conserva formatos, bordes y celdas combinadas) |
| **`usuarios-y-claves.txt`** | 1.4 KB | Cuentas demo: admin, caja1, cocina1 | N/A | N/A | Verificado OK |

### 2.2 Textos Fuente Versionables (.md)
Ubicación: `docs/entregables-isoft/fuentes/`

1. `Informe_de_Proyecto_MonsterBurguer.md` (21.8 KB)
2. `Manual_del_Sistema_MonsterBurguer.md` (41.3 KB)
3. `Manual_de_Usuario_MonsterBurguer.md` (19.0 KB)
4. `Especificacion_de_Requisitos_MonsterBurguer.md` (34.5 KB)

---

## 3. Diagramas UML Generados y Dimensiones (PIL)
Ubicación: `docs/entregables-isoft/uml/` (fuentes `.puml`) y `docs/entregables-isoft/uml/png/` (imágenes PNG).

Se generaron 17 diagramas PlantUML compilados con `java -jar plantuml.jar -tpng` (usando `!pragma layout smetana`). Atendiendo las instrucciones de revisión del orquestador, los diagramas de casos de uso y arquitectura fueron reestructurados con `left to right direction` y agrupaciones en paquetes para mantener anchos equilibrados (< 1800 px) y proporciones aptas para páginas verticales a 16 cm de ancho en Word:

| # | Archivo PNG | Vista / Tipo de Diagrama | Dimensiones (WxH px) | Aspect Ratio | Observación de Diseño |
|:---:|---|---|:---:|:---:|---|
| 1 | `cu_general.png` | Escenarios: Casos de Uso General | 713 × 1277 | 0.56 | Optimizado: vertical, 5 paquetes, relación «precede» eliminada. |
| 2 | `cu_cajero.png` | Escenarios: Casos de Uso Cajero | 619 × 607 | 1.02 | Optimizado: cuadrado, paquetes de Pedidos y Caja. |
| 3 | `cu_cocina.png` | Escenarios: Casos de Uso Cocina | 633 × 332 | 1.91 | Optimizado: compacto, transiciones KDS. |
| 4 | `cu_admin.png` | Escenarios: Casos de Uso Administrador | 723 × 673 | 1.07 | Optimizado: equilibrado, paquetes Menú/Inventario y Analítica. |
| 5 | `actividad_proceso_general.png` | Procesos: Proceso General de Venta | 1533 × 2013 | 0.76 | Calles: Cliente, Cajero, Cocina y Sistema POS. |
| 6 | `actividad_tomar_pedido.png` | Procesos: Toma de Pedidos POS | 1297 × 1726 | 0.75 | Calles: Cajero, Módulo Pedidos y Módulo Inventario. |
| 7 | `actividad_preparacion_cocina.png` | Procesos: Preparación KDS | 1652 × 1880 | 0.88 | Calles: Cocinero, Pantalla KDS, Módulo Cocina y Realtime. |
| 8 | `actividad_cobro_cierre_caja.png` | Procesos: Cobro y Arqueo Caja | 1445 × 2228 | 0.65 | Calles: Cajero, Módulo Caja y Módulo Pedidos. |
| 9 | `modelo_dominio.png` | Lógica: Modelo Conceptual de Dominio | 1280 × 1291 | 0.99 | 16 clases de negocio con multiplicidades y enums. |
| 10 | `clases_diseno.png` | Lógica: Clases de Diseño NestJS | 1670 × 1007 | 1.66 | Controladores, Servicios, Repositorios y Shared Kernel. |
| 11 | `paquetes.png` | Lógica: Paquetes y Fronteras | 1736 × 752 | 2.31 | Modular Monolith, contratos shared y reglas *.public.ts. |
| 12 | `estados_pedido.png` | Procesos: Máquina de Estados Pedido | 653 × 654 | 1.00 | Estados ABIERTO, CONFIRMADO, CERRADO y ANULADO. |
| 13 | `estados_comanda.png` | Procesos: Máquina de Estados Comanda | 773 × 801 | 0.97 | Estados PENDIENTE, EN_PREPARACION, LISTA, ENTREGADA. |
| 14 | `secuencia_confirmar_pedido.png`| Procesos: Confirmación Atómica | 4096 × 1536 | 2.67 | Transacción ACID con SELECT FOR UPDATE y outbox. (Mantenido). |
| 15 | `secuencia_cobro.png` | Procesos: Cobro y Emisión Recibo | 1748 × 1062 | 1.65 | Liquidación atómica, propina y cierre de cuenta. |
| 16 | `componentes.png` | Desarrollo: Componentes del Sistema | 1613 × 793 | 2.03 | SPA React 19, Nginx, NestJS 12 y PostgreSQL 18. |
| 17 | `despliegue.png` | Física: Despliegue en Red Local LAN | 1432 × 946 | 1.51 | Nodos LAN, contenedores Docker Compose y periféricos. |

---

## 4. Trazabilidad Requisito → Caso de Uso → Regla de Negocio

Se estableció una matriz de trazabilidad 1:1 rigurosa entre las especificaciones del sistema:

| Requisito Funcional | Historia PRD | Caso de Uso (.xlsx y Manual) | Reglas de Negocio Trazadas |
|---|---|---|---|
| **RF-01** (Autenticación y Sesiones) | HU-01 | CU-01 (Iniciar Sesión) | RN-51, RN-60 |
| **RF-02** (Gestión de Usuarios RBAC) | HU-02 | CU-02 (Gestionar Usuarios) | RN-51 |
| **RF-03** (Creación de Pedidos) | HU-20 | CU-03 (Crear Pedido) | RN-10, RN-11, RN-15, RN-16 |
| **RF-04** (Composición de Ticket) | HU-21, HU-22 | CU-04 (Agregar Ítems y Nota) | RN-02, RN-04, RN-05, RN-12, RN-13, RN-14 |
| **RF-05** (Confirmación Atómica) | HU-23 | CU-05 (Enviar Pedido a Cocina) | RN-20, RN-31, RN-32, RN-33, RN-34, RN-36 |
| **RF-06** (Monitor Pedidos Activos) | HU-24 | CU-06 (Consultar Pedidos Activos) | RN-11, RN-21 |
| **RF-07** (Avance Comandas KDS) | HU-30, HU-31, HU-32 | CU-07 (Preparar Comanda en Cocina) | RN-21, RN-23 |
| **RF-08** (Apertura de Caja) | HU-50 | CU-08 (Abrir Sesión de Caja) | RN-40, RN-41 |
| **RF-09** (Cobro y Recibo POS) | HU-51, HU-52 | CU-09 (Cobrar Pedido y Emitir Recibo) | RN-01, RN-03, RN-04, RN-06, RN-40, RN-42, RN-43, RN-44, RN-45 |
| **RF-10** (Movimientos Manuales) | HU-53 | CU-10 (Registrar Movimiento de Caja) | RN-46 |
| **RF-11** (Cierre de Caja y Arqueo) | HU-54 | CU-11 (Cerrar Sesión de Caja) | RN-47, RN-48 |
| **RF-12** (Gestión de Menú) | HU-10, HU-11 | CU-12 (Gestionar Productos y Categorías) | RN-02, RN-05 |
| **RF-13** (Recetas y Disponibilidad) | HU-12, HU-13 | CU-13 (Gestionar Recetas y Disponibilidad)| RN-30, RN-31, RN-36 |
| **RF-14** (Entrada de Mercancía) | HU-41 | CU-14 (Registrar Entrada de Mercancía) | RN-34, RN-36 |
| **RF-15** (Mermas y Ajustes) | HU-42 | CU-15 (Registrar Ajuste o Merma) | RN-34, RN-35 |
| **RF-16** (Kardex de Inventario) | HU-40, HU-43 | CU-16 (Consultar Kardex de Inventario) | RN-30, RN-34 |
| **RF-17** (Dashboard y Analítica) | HU-60, HU-61, HU-62 | CU-17 (Consultar Dashboard y Métricas) | RN-16, RN-23, RN-36 |
| **RF-18** (Auditoría de Eventos) | HU-63 | CU-18 (Consultar Bitácora y Auditoría) | RN-60, RN-61 |

---

## 5. Lista Completa de Marcadores

Conforme a la instrucción de no inventar datos personales, fechas de eventos externos ni resultados de encuestas no documentadas, se dejaron marcadores estandarizados explícitos:

### 5.1 Marcadores `[COMPLETAR]` (8 apariciones)
1. `Informe de Proyecto - MonsterBurguer.docx` (párrafo Portada): `[COMPLETAR: Integrantes adicionales del grupo si aplica]`
2. `Informe de Proyecto - MonsterBurguer.docx` (sección Introducción): `[COMPLETAR: Fechas exactas del calendario académico]`
3. `Informe de Proyecto - MonsterBurguer.docx` (sección 5.1): `[COMPLETAR: Registro de visitas u observación en campo si hubo local de prueba]`
4. `Informe de Proyecto - MonsterBurguer.docx` (sección 5.1): `[COMPLETAR: Formato o registro de visita operativa]`
5. `Manual del Sistema - MonsterBurguer.docx` (párrafo Portada): `[COMPLETAR: Integrantes adicionales del grupo si aplica]`
6. `Manual del Sistema - MonsterBurguer.docx` (sección 1): `[COMPLETAR: Establecimiento observado y fecha de visita]`
7. `Manual de Usuario - MonsterBurguer.docx` (párrafo Portada): `[COMPLETAR: Integrantes adicionales del grupo si aplica]`
8. `Especificacion de Requisitos - MonsterBurguer.docx` (párrafo Portada): `[COMPLETAR: Integrantes adicionales del grupo si aplica]`

### 5.2 Marcadores `[CAPTURA]` (13 apariciones en Manual de Usuario)
Reservados para que el orquestador inserte las capturas de pantalla reales de la interfaz web:
1. `[CAPTURA: pantalla de inicio de sesión /login]`
2. `[CAPTURA: modal de apertura de caja]`
3. `[CAPTURA: pantalla principal del POS con selector de tipo de pedido y categorías]`
4. `[CAPTURA: cuadrícula de productos del POS con producto agotado y ticket lateral]`
5. `[CAPTURA: diálogo de pedidos activos y monitor de mesas ocupadas]`
6. `[CAPTURA: diálogo de cobro con propina y teclado numérico de efectivo]`
7. `[CAPTURA: recibo POS impreso a 80 mm con leyendas legales]`
8. `[CAPTURA: formulario de registro de movimiento manual de caja]`
9. `[CAPTURA: pantalla de cierre de caja y arqueo ciego]`
10. `[CAPTURA: pantalla KDS de cocina con tarjetas en columnas Pendiente, Preparación y Lista]`
11. `[CAPTURA: panel de control Dashboard del Administrador con KPIs del día]`
12. `[CAPTURA: formulario de administración de productos y recetas]`
13. `[CAPTURA: tabla del Kardex de inventario con movimientos de consumo y entrada]`

---

## 6. Supuestos Adoptados
1. **Fidelidad Estricta a `main`:** Únicamente se documentó como funcional lo implementado y probado en el código real (`feat/caja-completa` con movimientos manuales RN-46, corrección `BE-01`, `MAY-01`, `MEN-01` y `MEN-02`). Funcionalidades no implementadas (pagos mixtos, anulación de pedidos con reversión, facturación electrónica DIAN DEE POS) fueron explícitamente clasificadas como *Backlog / Trabajo Futuro / Out of MVP*.
2. **Entorno Académico:** Las credenciales de demostración (`admin/admin123`, `caja1/caja1234`, `cocina1/cocina1234`) corresponden a los datos semilla del monorepositorio (`pnpm --filter api seed`).

---

## 7. Verificaciones Realizadas
- **Lectura y Validación DOCX:** Los 4 archivos `.docx` fueron recargados e inspeccionados exitosamente con `python-docx`, comprobando la presencia intacta de estilos (`Title`, `Heading 1`, `Heading 2`, `Heading 3`, `normal`), tablas con bordes y sombreados, e inserción centrada de imágenes.
- **Validación del Bug de Márgenes XML:** Se resolvió de raíz la anomalía presente en las plantillas originales de Word (`ValueError: invalid literal for int() with base 10: '1133.8582677165355'`) mediante saneamiento de valores twips a enteros en el script de compilación.
- **Validación XLSX:** El archivo `Casos de Uso - MonsterBurguer.xlsx` se inspeccionó con `openpyxl`, verificando la existencia de sus 18 hojas y la conservación de sus 56 rangos de celdas combinadas por hoja.
- **Inspección de Imágenes con PIL:** Se midieron con Pillow las dimensiones y relaciones de aspecto de todos los PNG, garantizando legibilidad nítida en Word a 16 cm de ancho.
