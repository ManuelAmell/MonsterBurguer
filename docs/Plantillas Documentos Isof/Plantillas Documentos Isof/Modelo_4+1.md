# Modelo 4+1 Vista y artefactos asociados.

## Vista de Escenarios (El "+1")
Esta es la vista que une a todas las demás. Se centra en la funcionalidad del sistema desde el punto de vista de los usuarios externos (actores).

* **Diagrama de Casos de Uso:** Es el rey de esta vista. Muestra los actores, los casos de uso (qué quiere hacer el usuario) y las relaciones entre ellos. Ayuda a validar que el diseño de las otras 4 vistas realmente cumpla con los requisitos del negocio.

## Vista Lógica (Logical View)
Se enfoca en los requisitos funcionales del sistema. Es decir, qué debe hacer el sistema y cómo se organiza internamente a nivel de abstracción (clases, objetos y sus interacciones).

* **Diagrama de Clases:** El más común. Muestra las clases del sistema, sus atributos, métodos y cómo se relacionan entre sí (herencia, asociación, agregación).

* **Diagrama de Objetos:** Es una "foto" instantánea de los objetos del sistema en un momento específico del tiempo. Útil para explicar estructuras complejas de datos.

* **Diagramas de Interacción (Secuencia y Colaboración/Comunicación):** Muestran cómo los objetos interactúan entre sí a lo largo del tiempo para cumplir con un escenario.

* **Diagrama de Paquetes (Arquitectura):** Para organizar las clases en módulos o capas lógicas (por ejemplo: Capa de Datos, Capa de Negocio, Capa de Presentación).

## Vista de Desarrollo / Componentes (Development View)
Muestra cómo se organiza el software en módulos físicos de desarrollo (código fuente, librerías, binarios, ejecutables). Es la vista para los programadores y gestores de configuración.

* **Diagrama de Componentes:** Muestra los componentes de software (archivos .jar, .dll, ejecutables, base de datos) y sus dependencias o interfaces (quién consume a quién).

* **Diagrama de Paquetes (a nivel de código):** Se usa aquí también para agrupar los componentes en subsistemas físicos o directorios del proyecto.

## Vista de Procesos (Process View)
Se enfoca en los aspectos dinámicos y de rendimiento del sistema. Trata sobre la concurrencia, la distribución, el rendimiento, la escalabilidad y los hilos de ejecución (threads). Es clave para sistemas complejos, paralelos o de tiempo real.

* **Diagrama de Actividades:** Muestra el flujo de trabajo (workflow) o los procesos paralelos dentro del sistema. Es ideal para ver cómo se bifurcan y sincronizan los hilos de ejecución.

* **Diagrama de Estados:** Muestra el ciclo de vida de un objeto o proceso reactivo y cómo cambia de estado ante ciertos eventos.

* **Diagramas de Secuencia:** También se asoman aquí si los configuras para mostrar la interacción entre procesos o hilos de ejecución concurrentes (usando mensajes asíncronos y barras de activación).

## Vista de Despliegue / Física (Physical View)
Define cómo se distribuye el software (los componentes de la vista de desarrollo) en el hardware físico o la infraestructura de red. Es la vista para los ingenieros de sistemas o DevOps.

* **Diagrama de Despliegue:** Muestra los nodos de hardware (servidores, PCs, dispositivos móviles, balanceadores de carga), las conexiones físicas o protocolos de red entre ellos (HTTP, TCP/IP, etc.), y qué componentes de software se ejecutan en cada nodo.