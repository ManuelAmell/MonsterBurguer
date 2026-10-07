# Arreglos de frontend del POS — 2026-10-07

Los implementó un agente agy, que agotó su cuota antes de terminar la verificación. El orquestador (Claude) cerró la verificación y simplificó el arreglo de OBS-01.

## Cambios

| Hallazgo | Arreglo | Archivos |
|---|---|---|
| MAY-01: no se podía cobrar una mesa ya enviada a cocina | Nueva ruta `/pos/pedido/:id`; `pedidoId` sale de la URL. Diálogo "Pedidos activos" con dos pestañas, pedidos y mesas. El selector de mesa marca las mesas ocupadas y, al elegir una, abre su pedido. Si el pedido está CONFIRMADO, el ticket queda en solo lectura con "Cobrar". | `features/pos/pos-page.tsx`, `routes.tsx`, `pedidos-activos-dialog.tsx` (nuevo) |
| MEN-01: no había nota por ítem | Diálogo accesible con contador /140; Enter guarda y Escape cancela. La nota se ve en el ticket de solo lectura. | `nota-item-dialog.tsx` (nuevo), `pos-page.tsx`, `components/pos/ticket-line.tsx` (textos a `es.ts`) |
| OBS-01: "Mesa Mesa 2" | El recibo usa `mesa.nombre` tal cual. En el KDS, el prefijo "Mesa" solo se agrega cuando llega un número. | `features/pos/recibo.tsx`, `components/kds/kds-ticket-card.tsx` |
| OBS-03: "Sin conexión" al conectar | Estado inicial `conectando` en `useEventStream` y badge "Conectando…" con icono animado. | `lib/sse.ts`, `features/cocina/cocina-page.tsx`, `i18n/es.ts` |

## Verificación (orquestador)

- `pnpm typecheck`, `pnpm lint`, `pnpm depcruise` (0 violaciones) y `pnpm --filter web build`: OK.
- Recorrido en Chrome real (chrome-devtools) contra la API de prueba (BD `mb_qa_web`):
  1. `/pos/pedido/:id` carga el pedido de Mesa 1 con 2 ítems.
  2. MEN-01: la nota "sin cebolla" se guarda con Enter (comprobado en la API).
  3. "Enviar a cocina" deja el pedido CONFIRMADO y la app vuelve a `/pos`. El selector muestra "Mesa 1 • Ocupada".
  4. MAY-01: en "Pedidos activos", el pedido #6 aparece "En cocina" con el botón "Cobrar", que abre `/pos/pedido/:id` en solo lectura con la nota visible. Al recargar, el pedido se restaura.
  5. Cobro: propina sugerida de $5.300 (10 % de $53.800 redondeado hacia abajo, RN-06) sin preselección. Con $100.000 recibidos el cambio es $40.900.
  6. OBS-01: el recibo R-000005 dice "Pedido #6 · Mesa 1" y trae "Documento no fiscal" y "No responsable de INC". El pedido queda CERRADO y la Mesa 1 libre.
- **OBS-03, no verificado:** `/cocina` se queda en "Conectando…" porque el SSE no abre a través del proxy de Vite. En Node, la API directa responde 200 `text/event-stream` en 13 ms, pero por el proxy `:5192` responde **502 a los ~7,5 s**. Ni `realtime` ni `vite.config.ts` cambiaron en estos arreglos. Hay que investigarlo aparte (ver "Pendientes").

## Pendientes

- **SSE detrás del proxy de Vite (502).** Reproducir con la API recién compilada; no se pudo hoy por falta de RAM. Hay que revisar si el proxy de Vite 8 necesita una configuración específica para SSE o si la API debe enviar un primer comentario (`: ok\n\n` o `retry:`) al conectar, en vez de esperar al heartbeat.
- **Observaciones de accesibilidad menores:**
  - En "Pedidos activos", los botones "Cobrar" y "Abrir pedido" se repiten sin contexto en su nombre accesible. Se recomienda `aria-label` con el número del pedido.
  - Con el ticket vacío hay dos encabezados "Pedido nuevo".
