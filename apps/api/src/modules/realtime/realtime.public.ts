// API pública del módulo realtime: lo único que otros módulos pueden importar de aquí.
export { RealtimeModule } from './realtime.module';
export { RealtimeService, difundir } from './realtime.service';
export { RealtimeHub, type ClienteSse } from './realtime.hub';
export { BuferCircularEventos, type EntradaBuferRealtime } from './bufer-circular';
export { type ReglaMapeoEvento, MAPA_EVENTOS_SSE_DEFECTO } from './realtime-mapa';

