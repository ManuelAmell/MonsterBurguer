// Textos de la interfaz en español (Colombia). Centralizados desde el inicio (DESIGN.md §8).
import type { Rol } from '@mb/shared';

export const t = {
  app: {
    nombre: 'MonsterBurguer',
    subtitulo: 'Punto de venta',
    saltarAlContenido: 'Saltar al contenido',
  },
  roles: {
    ADMIN: 'Administrador',
    CAJERO: 'Cajero',
    COCINA: 'Cocina',
  } satisfies Record<Rol, string>,
  nav: {
    principal: 'Navegación principal',
    pos: 'Ventas',
    caja: 'Caja',
    cocina: 'Cocina',
    admin: 'Administración',
    cerrarSesion: 'Cerrar sesión',
  },
  login: {
    titulo: 'Inicia sesión',
    descripcion: 'Usa el usuario y la contraseña que te asignó el administrador.',
    usuario: 'Usuario',
    contrasena: 'Contraseña',
    mostrarContrasena: 'Mostrar contraseña',
    ocultarContrasena: 'Ocultar contraseña',
    ingresar: 'Ingresar',
    ingresando: 'Ingresando…',
  },
  errores: {
    sinConexion: 'No hay conexión con el servidor. Revisa la red e inténtalo de nuevo.',
    inesperado: 'Ocurrió un error inesperado. Inténtalo de nuevo.',
    sinPermiso: 'Tu rol no tiene acceso a esta pantalla.',
    noEncontrado: 'Esta página no existe.',
    volverAlInicio: 'Volver al inicio',
  },
  pendiente: {
    titulo: (pantalla: string) => `${pantalla} está en construcción`,
    descripcion: (hito: number) => `Esta pantalla llega en el Hito ${hito} del roadmap.`,
  },
  cocina: {
    sinComandas: 'Sin comandas por ahora',
    sinComandasDescripcion: 'Cuando caja envíe un pedido aparecerá aquí al instante.',
  },
} as const;
