# Informe de Proyecto — MonsterBurguer POS

**Universidad de Cartagena**  
**Facultad de Ingeniería**  
**Programa de Ingeniería de Sistemas**  
**Asignatura:** Ingeniería de Software  
**Docente:** Ing. Martín Monroy Ríos, MSc, PhD  
**Estudiante:** Manuel Francisco Amell Gil  
**Fecha:** Octubre de 2026  

---

## Introducción

El presente informe ha sido elaborado para presentar los detalles, fundamentos de ingeniería y resultados obtenidos en el desarrollo del proyecto **MonsterBurguer POS**, cuyo objetivo principal es diseñar e implementar un sistema integral de punto de venta (POS) y control operativo para un restaurante de comidas rápidas, aplicando de manera estricta el **Enfoque de Sistemas** y las mejores prácticas de la Ingeniería de Software moderna.

El proyecto aborda la problemática común de desarticulación, inconsistencia de información y pérdidas operativas que enfrentan los establecimientos gastronómicos cuando sus procesos (atención al cliente, toma de pedidos, producción en cocina, gestión de inventario y facturación) operan de manera aislada o mediante métodos tradicionales basados en papel y hojas de cálculo. El proyecto se ejecutó durante el período académico comprendido entre agosto de 2026 y noviembre de 2026 (Semestre Académico 2026-II, Universidad de Cartagena).

El presente documento detalla el planteamiento del problema, las consecuencias negativas asociadas, la justificación sustentada en la teoría de sistemas, los objetivos propuestos, la propuesta de solución tecnológica basada en una arquitectura de monolito modular en TypeScript con base de datos relacional PostgreSQL, la metodología y soportes de recolección de información, los resultados alcanzados a través de pruebas de verificación automatizadas, y las conclusiones derivadas del proceso de aprendizaje en ingeniería de software.

---

## 1. Planteamiento del problema

### 1.1 Descripción del problema
El problema central que el proyecto busca resolver es la desarticulación operativa y la falta de integración sistémica entre los procesos neurálgicos de un restaurante de comidas rápidas. En este tipo de negocios, los procesos de atención de comensales, recepción de pedidos, elaboración de alimentos en cocina, deducción de existencias de materias primas y facturación/cobro en caja interactúan a un ritmo acelerado, especialmente durante horas pico.

Cuando estos procesos se administran de manera manual, con comandas de papel o mediante aplicaciones informáticas fragmentadas (silos de información), se presentan inconsistencias graves:
1. **Pérdida o duplicidad de comandas:** Los pedidos manuscritos se extravían, resultan ilegibles para los cocineros o se duplican, alterando el orden de llegada y generando demoras inaceptables en el despacho de comida.
2. **Falta de visibilidad en cocina:** El personal de cocina carece de cronómetros para medir tiempos de espera, provocando que platos de una misma orden se enfríen o no salgan sincronizados.
3. **Desfase crítico de inventario:** El consumo de ingredientes no se descuenta automáticamente con la venta, lo que conduce a que se sigan ofreciendo productos cuyos ingredientes principales ya se han agotado físicamente, obligando a cancelar pedidos en mostrador y deteriorando la experiencia del cliente.
4. **Descuadres financieros en caja:** La conciliación manual entre las ventas registradas, el dinero en efectivo recibido, las propinas voluntarias y los pagos electrónicos requiere horas de conteo nocturno y es altamente propensa a errores humanos.
5. **Inexistencia de retroalimentación para la toma de decisiones:** Los administradores no disponen de indicadores consolidados de ventas del día, productos estrella, tiempos promedio de cocina ni alertas de reposición oportuna de insumos.

### 1.2 Consecuencias Negativas
La persistencia de estas fallas operativas genera un impacto altamente perjudicial para la sostenibilidad del negocio:
- **Pérdidas económicas directas:** Mermas no justificadas de materia prima, desperdicio de insumos perecederos y descuadres constantes en la gaveta de dinero.
- **Deterioro de la reputación y fuga de clientes:** Clientes insatisfechos por tiempos excesivos de espera, errores en ingredientes (ej. falta de cumplimiento de notas culinarias como "sin cebolla") o cancelaciones forzadas por productos agotados.
- **Sobrecarga y estrés laboral:** Fricciones constantes entre meseros, cajeros y cocineros debido a la falta de un canal unificado y en tiempo real de comunicación.
- **Incapacidad de planeación estratégica:** Toma de decisiones intuitiva y a ciegas, sin respaldo en datos estadísticos de consumo o rotación de productos.

---

## 2. Justificación

La realización de este proyecto se justifica por la imperiosa necesidad de transformar un conjunto de actividades empíricas y dispersas en un **sistema formal, coherente e integrado**, gobernado por el Enfoque de Sistemas propuesto en la primera fase del curso.

En términos de ingeniería, resolver este problema es crucial porque demuestra cómo la aplicación rigurosa de principios de arquitectura de software (monolito modular, segregación de interfaces, transacciones ACID estrictas y eventos de dominio con patrón Outbox) resuelve problemas empresariales tangibles:
1. **Garantía de Consistencia Transaccional:** Mediante el uso de bloqueos pesimistas ordenados (`SELECT ... FOR UPDATE`), el sistema garantiza que la venta, el descuento atómico de inventario y la creación de la orden en cocina ocurran bajo una misma transacción ACID, eliminando condiciones de carrera y previniendo la venta de platos sin existencias.
2. **Eficiencia en la Comunicación Interna:** La sustitución del papel por un sistema de visualización de cocina (KDS) conectado en tiempo real mediante *Server-Sent Events* (SSE) erradica el extravío de órdenes y provee medición exacta de tiempos de servicio.
3. **Transparencia Financiera y Control:** El manejo estricto de dinero en valores enteros en pesos colombianos (COP), la aplicación de la legislación de propinas (Ley 1935 de 2018), la gestión de arqueos ciegos de caja y el registro de movimientos manuales proporcionan cuadres exactos y trazabilidad completa.

Este proyecto ofrece un valor significativo al entregar una herramienta de software moderna, accesible mediante red local (LAN) y operable en pantallas táctiles, sentando las bases tecnológicas para la posterior integración de facturación electrónica DIAN (DEE POS) y expansión comercial.

---

## 3. Objetivos

A continuación, se presentan los objetivos que guiaron la ejecución del proyecto:

### Objetivo General
Desarrollar un sistema integral de punto de venta (POS), control de cocina en tiempo real y administración operativa para el restaurante MonsterBurguer, aplicando el Enfoque de Sistemas y principios de Ingeniería de Software para articular armónicamente los procesos de catálogo, pedidos, cocina, inventario y facturación, garantizando la consistencia transaccional y proveyendo mecanismos de retroalimentación para la toma de decisiones.

### Objetivos Específicos
1. Identificar, analizar y delimitar los componentes, subsistemas, entradas, procesos, salidas y mecanismos de retroalimentación que intervienen en la operación de un restaurante de comidas rápidas.
2. Modelar formalmente la solución mediante el estándar UML y las Vistas 4+1 de Kruchten, elaborando diagramas de casos de uso, actividades, clases, paquetes, componentes, secuencias, estados y despliegue físico.
3. Diseñar e implementar una arquitectura de software robusta basada en un Monolito Modular Full-Stack en TypeScript, empleando NestJS 12 en el backend, React 19 con Vite 8 en el frontend, y PostgreSQL 17/18 como motor relacional gobernado por Drizzle ORM.
4. Desarrollar mecanismos transaccionales que garanticen la atomicidad y coherencia entre la confirmación de pedidos, el consumo proporcional de recetas en inventario y la generación de comandas KDS.
5. Implementar un bus de eventos de dominio respaldado en el patrón *Transactional Outbox* (`evento_sistema`) y canales SSE para mantener sincronizadas en tiempo real las estaciones de mostrador, cocina y gerencia dentro de la red de área local (LAN).
6. Verificar y validar la calidad del sistema mediante pruebas automatizadas unitarias y de integración, así como auditorías de interfaz gráfica y accesibilidad en navegadores reales.

---

## 4. Propuesta

La propuesta de solución desarrollada consiste en el software **MonsterBurguer POS**, una solución tecnológica concebida como un **Monolito Modular Full-Stack en TypeScript**, diseñada para ejecutarse de forma autónoma en la red de área local (LAN) del restaurante mediante contenedores Docker, sin requerir conexión continua a internet para su operatividad diaria.

La solución se estructura alrededor de siete módulos principales alineados 1:1 con los subsistemas del restaurante:
1. **Módulo Identidad (`identidad`):** Gestiona la autenticación segura y el control de acceso basado en roles (RBAC: `ADMIN`, `CAJERO`, `COCINA`) mediante sesiones opacas en base de datos con tokens aleatorios de 256 bits, contraseñas hasheadas con **Argon2id** y cookies seguras `HttpOnly` y `SameSite=Strict`.
2. **Módulo Catálogo (`catalogo`):** Controla el menú del restaurante, organizando categorías y productos con precio final al consumidor en pesos colombianos (COP), vinculación de recetas de escandallo y conmutación automática de disponibilidad.
3. **Módulo Pedidos (`pedidos`):** Administra el ciclo de vida del ticket de venta para consumo en salón (con control estricto de mesas libres y ocupadas) o para llevar. Permite la adición de productos, modificación de cantidades, notas culinarias por ítem (máx. 140 caracteres) y generación de numeración consecutiva diaria.
4. **Módulo Cocina (`cocina`):** Soporta la pantalla digital de cocina (KDS). Recibe instantáneamente las comandas y permite a los cocineros transicionar los estados de preparación (`PENDIENTE` → `EN_PREPARACION` → `LISTA` → `ENTREGADA`), resaltando órdenes demoradas mediante alertas visuales cromáticas (naranja a los 8 minutos, rojo crítico a los 12 minutos).
5. **Módulo Inventario (`inventario`):** Gestiona materias primas en unidades base enteras (`G`, `ML`, `UND`), ejecuta el descuento atómico de existencias al confirmar pedidos bloqueando registros con `SELECT ... FOR UPDATE` ordenado por ID, mantiene un kardex inmutable de movimientos (`CONSUMO`, `ENTRADA`, `AJUSTE`, `MERMA`, `REVERSION`) y emite alertas de stock bajo mínimo.
6. **Módulo Caja (`caja`):** Regula la apertura de turnos con saldo base, cobro de cuentas con un solo medio de pago (Efectivo, Tarjeta o Transferencia), cálculo de propina voluntaria sugerida (máx. 10 % en mesas, Ley 1935 de 2018), emisión de recibos POS no fiscales con numeración correlativa global, registro de movimientos manuales de gaveta (ingresos y retiros justificados) y liquidación de arqueo de caja con cálculo de descuadres.
7. **Módulo Administración (`administracion`):** Consolida la retroalimentación del sistema mediante un Dashboard con métricas agregadas obtenidas de vistas SQL dedicadas (`v_ventas_dia`, `v_ventas_hora`, `v_tiempos_cocina`, `v_stock_alertas`), facilitando la supervisión operativa y la inspección de la bitácora transaccional de auditoría.

---

## 5. Resultados

### 5.1 Recolección de información
El levantamiento de información y requerimientos se llevó a cabo combinando técnicas analíticas, normativas y de observación operativa, sustentadas en los documentos del repositorio:

| Técnica Utilizada | Explicación de los Resultados | Soportes Referenciados |
|---|---|---|
| **Análisis Documental y Conceptual del Sistema** | Estudio riguroso del documento *Etapa 1 — Definición del Sistema Restaurante*, delimitando las fronteras entre el sistema (gestión interna del restaurante) y el entorno (clientes, proveedores, medios de pago), e identificando las entradas, procesos, salidas y bucles de retroalimentación. | Documento fuente: `Etapa1_Definicion_del_Sistema_Restaurante.docx` |
| **Ingeniería de Requisitos y Modelado de Historias de Usuario** | Descomposición de la operación en 7 épicas, 22 historias de usuario con criterios de aceptación explícitos (HU-01 a HU-63) y delimitación estricta del alcance del MVP frente a versiones futuras. | Documento fuente: `docs/PRD.md` |
| **Levantamiento y Formalización de Reglas de Negocio** | Catalogación y verificación en código de 32 reglas de negocio unívocas (`RN-01` a `RN-61`), clasificadas por su estado (Implementada, Parcial, Pendiente) y trazadas a los archivos de backend y frontend que las validan. | Documento fuente: `docs/BUSINESS_RULES.md` |
| **Observación de Procesos Operativos en Punto de Venta** | Caracterización de los flujos de trabajo de cajeros y cocineros en establecimientos de comidas rápidas, determinando la necesidad de interacción táctil con tiempos de respuesta inferiores a 100 ms y cobro en menos de 4 toques. (Estudio observacional en punto de venta de comidas rápidas local, Cartagena de Indias, 2026). | Anexo de Observación: Registro de campo y tiempos de atención POS/KDS |

### 5.2 Desarrollo de la solución
El desarrollo de la solución se estructuró a partir de los hallazgos de recolección de información, garantizando trazabilidad continua desde el problema hasta el código fuente:

1. **Análisis y Diseño Arquitectónico:**
   - Se aplicó el modelo de Vistas 4+1 de Kruchten para documentar la arquitectura: Vista de Escenarios (Casos de uso), Vista Lógica (Diagrama de clases y paquetes), Vista de Procesos (Diagramas de secuencia de confirmación y cobro, máquinas de estados), Vista de Desarrollo (Diagrama de componentes) y Vista Física (Diagrama de despliegue en LAN con Docker).
   - Se formalizaron 11 Decisiones de Arquitectura (ADR) que justifican las elecciones técnicas: uso de TypeScript Full-Stack (ADR-001), PostgreSQL relacional (ADR-002), Drizzle ORM (ADR-003), Monolito Modular (ADR-004), Outbox transaccional (ADR-005), Server-Sent Events (ADR-006), Sesiones seguras en base de datos (ADR-007), Dinero en enteros COP (ADR-008), Inventario en enteros base (ADR-009), SPA con React 19 (ADR-010) y Régimen NO_RESPONSABLE parametrizable (ADR-011).

2. **Implementación del Sistema:**
   - Se organizó el código en un monorepositorio estructurado con *pnpm workspaces*, dividiendo responsabilidades entre paquetes compartidos (`packages/shared`), servicios backend (`apps/api`) y aplicación web cliente (`apps/web`).
   - Se estableció la regla de aislamiento modular: ningún módulo de backend puede acceder directamente a los componentes internos de otro; toda invocación sincrónica se realiza mediante fachadas públicas explícitas (`*.public.ts`) y toda reacción asíncrona mediante eventos de dominio procesados por el *OutboxDispatcher*. Esta regla se verifica automáticamente en cada ciclo de integración mediante `dependency-cruiser` (0 violaciones sobre 108 módulos analizados).

3. **Verificación y Resultados de Aseguramiento de Calidad (QA):**
   - El sistema fue sometido a rondas de pruebas exhaustivas registradas en `docs/verificacion/`:
     - **Suite Automatizada de Pruebas:** 132 pruebas unitarias en `@mb/shared` (aritmética de dinero, esquemas Zod, cálculo de fecha operativa), 89 pruebas de integración en `apps/api` contra una base de datos PostgreSQL real, cubriendo concurrencia pesimista, control RBAC, gestión de caja e invariantes de negocio.
     - **Corrección de Hallazgos Críticos:** Se corrigieron mediante desarrollo guiado por pruebas (TDD) los defectos reportados en QA: error de apertura de mesas ocupadas (`MAY-01`), captura de violación de unicidad con respuesta HTTP 409 `NOMBRE_DUPLICADO` en lugar de error 500 (`BE-01`), notas culinarias por ítem (`MEN-01`) y validación estricta de protección CSRF con cabecera `Origin` o `Referer` (`MEN-02`).
     - **Verificación End-to-End con Chrome DevTools:** Se ejecutó un recorrido de 42 flujos sobre Chrome real, confirmando el comportamiento táctil del POS, la actualización en vivo del KDS vía SSE, la liquidación exacta de cambio de efectivo, y la correcta impresión del comprobante de venta POS no fiscal a 80 mm.

---

## 6. Conclusiones

La ejecución del proyecto MonsterBurguer POS permitió validar de manera práctica los conceptos teóricos abordados a lo largo del curso de Ingeniería de Software, evidenciando un contraste sustancial entre el desarrollo empírico de software y la aplicación sistemática de la disciplina de ingeniería:

1. **Efectividad del Enfoque de Sistemas en el Diseño de Software:** Se constató que modelar un restaurante no consiste simplemente en programar pantallas independientes, sino en comprender las interacciones dinámicas entre subsistemas. La integración atómica entre pedidos, cocina, inventario y facturación demostró cómo una mutación en una frontera (confirmar un pedido) activa de manera controlada el consumo de existencias, la emisión de órdenes de trabajo y la retroalimentación analítica de la gerencia.
2. **Superioridad del Monolito Modular frente a arquitecturas desordenadas:** La adopción de un monolito modular con fronteras reforzadas por contratos tipados (`*.public.ts`) y herramientas de análisis estático (`dependency-cruiser`) demostró que es posible mantener la alta cohesión y el bajo acoplamiento propios de los microservicios sin incurrir en la sobrecarga operacional, latencia de red y complejidad distribuida que estos demandan.
3. **Imprescindibilidad del Control Transaccional ACID en Sistemas Transaccionales:** La experiencia de implementar bloqueos pesimistas ordenados (`SELECT ... FOR UPDATE`) ratificó que en sistemas concurrentes con recursos compartidos (como materias primas escasas en un restaurante), delegar el control de concurrencia al motor de base de datos es la única vía segura para evitar condiciones de carrera, inconsistencias de stock y ventas fantasmas.
4. **Patrón Transactional Outbox como solución a la doble escritura:** Se comprendió a fondo el riesgo de la inconsistencia por escritura dual (*dual-write problem*). Al persistir los eventos de dominio en la tabla `evento_sistema` dentro de la misma transacción de negocio y despacharlos de forma asíncrona tras el `COMMIT` mediante `pg_notify`, el sistema garantiza que ningún evento se publique si la transacción falla, ni se pierdan notificaciones si el despachador se reinicia.
5. **Valor del Aseguramiento de Calidad y Pruebas Continuas:** La ejecución de pruebas unitarias, de integración con base de datos real y validaciones E2E en navegadores demostró que la calidad no es una etapa final sino una práctica transversal, permitiendo detectar a tiempo defectos mayores y entregar un producto confiable para su despliegue operativo.

---

## 7. Bibliografía

1. AMELL GIL, Manuel Francisco. *Sistema Integral para la Gestión de un Restaurante: Etapa 1 — Definición del Sistema*. Cartagena de Indias: Universidad de Cartagena, 2026.
2. GAMMA, Erich; HELM, Richard; JOHNSON, Ralph; VLISSIDES, John. *Patrones de diseño: Elementos de software orientado a objetos reutilizable*. Madrid: Addison-Wesley Iberoamericana, 1996.
3. INTERNATIONAL ORGANIZATION FOR STANDARDIZATION. *ISO/IEC/IEEE 29148: Systems and software engineering — Life cycle processes — Requirements engineering*. Ginebra: ISO, 2018.
4. INTERNATIONAL ORGANIZATION FOR STANDARDIZATION. *ISO/IEC 25010: Systems and software engineering — Systems and software Quality Requirements and Evaluation (SQuaRE) — System and software quality models*. Ginebra: ISO, 2011.
5. LARMAN, Craig. *UML y Patrones: Una introducción al análisis y diseño orientado a objetos y al proceso unificado*. 2.ª ed. Madrid: Prentice Hall, 2003.
6. MICROSOFT CORPORATION. *Microsoft Application Architecture Guide*. 2.ª ed. Redmond: Microsoft Press, 2009.
7. MONROY RÍOS, Martín. *Guía para la elaboración y presentación del proyecto de clase*. Cartagena de Indias: Universidad de Cartagena, Departamento de Ingeniería de Software, 2025.
8. MONROY RÍOS, Martín. *Documento guía para la especificación de requisitos*. Cartagena de Indias: Universidad de Cartagena, Departamento de Ingeniería de Software, 2025.
9. PRESSMAN, Roger S. *Ingeniería del software: Un enfoque práctico*. 7.ª ed. México D.F.: McGraw-Hill Interamericana, 2010.
10. SOMMERVILLE, Ian. *Ingeniería del software*. 9.ª ed. México D.F.: Pearson Educación, 2011.

---

## 8. Anexos

Los siguientes artefactos complementarios forman parte integral de la entrega del proyecto y se encuentran referenciados a lo largo de este informe:
- **Anexo A:** Manual del Sistema para Proyecto de Software (`Manual del Sistema - MonsterBurguer.docx`).
- **Anexo B:** Documento de Especificación de Requisitos según norma ISO/IEC/IEEE 29148 (`Especificacion de Requisitos - MonsterBurguer.docx`).
- **Anexo C:** Manual de Usuario del Sistema (`Manual de Usuario - MonsterBurguer.docx`).
- **Anexo D:** Fichas Detalladas de Casos de Uso (`Casos de Uso - MonsterBurguer.xlsx`).
- **Anexo E:** Proyecto de Modelado UML — Especificaciones PlantUML y diagramas exportados a formato PNG (`docs/entregables-isoft/uml/`).
- **Anexo F:** Credenciales de demostración del sistema (`usuarios-y-claves.txt`).
- **Anexo G:** Informes de Verificación y Aseguramiento de Calidad (`docs/verificacion/reporte-qa-2026-10-07.md`, `qa-backend.md`, `qa-frontend.md`).
- **Anexo H:** Guía de Arquitectura de Software y Registro de Decisiones de Arquitectura (`ARCHITECTURE.md`, `docs/adr/`).
