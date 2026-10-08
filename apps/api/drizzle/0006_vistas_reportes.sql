CREATE OR REPLACE VIEW "v_reporte_ventas_dia" AS
SELECT p.fecha_operativa,
       p.fecha_operativa::text AS clave,
       p.fecha_operativa::text AS etiqueta,
       count(distinct p.id)::int AS pedidos,
       sum(r.total)::bigint AS ventas,
       sum(r.propina)::bigint AS propinas,
       (CASE WHEN count(distinct p.id) = 0 THEN 0 ELSE round(sum(r.total)::numeric / count(distinct p.id)) END)::bigint AS ticket_promedio
FROM pedido p
JOIN recibo r ON r.pedido_id = p.id
WHERE p.estado = 'CERRADO'
GROUP BY p.fecha_operativa;--> statement-breakpoint
CREATE OR REPLACE VIEW "v_reporte_ventas_producto" AS
SELECT p.fecha_operativa,
       i.producto_id::text AS clave,
       i.nombre_producto AS etiqueta,
       count(distinct p.id)::int AS pedidos,
       sum(i.total_linea)::bigint AS ventas,
       0::bigint AS propinas,
       sum(i.cantidad)::bigint AS unidades,
       (CASE WHEN count(distinct p.id) = 0 THEN 0 ELSE round(sum(i.total_linea)::numeric / count(distinct p.id)) END)::bigint AS ticket_promedio
FROM pedido_item i
JOIN pedido p ON p.id = i.pedido_id
WHERE p.estado = 'CERRADO'
GROUP BY p.fecha_operativa, i.producto_id, i.nombre_producto;--> statement-breakpoint
CREATE OR REPLACE VIEW "v_reporte_ventas_metodo" AS
SELECT p.fecha_operativa,
       pg.metodo AS clave,
       pg.metodo AS etiqueta,
       count(distinct p.id)::int AS pedidos,
       sum(r.total)::bigint AS ventas,
       sum(r.propina)::bigint AS propinas,
       (CASE WHEN count(distinct p.id) = 0 THEN 0 ELSE round(sum(r.total)::numeric / count(distinct p.id)) END)::bigint AS ticket_promedio
FROM pedido p
JOIN recibo r ON r.pedido_id = p.id
JOIN pago pg ON pg.recibo_id = r.id
WHERE p.estado = 'CERRADO'
GROUP BY p.fecha_operativa, pg.metodo;--> statement-breakpoint
CREATE OR REPLACE VIEW "v_reporte_ventas_cajero" AS
SELECT p.fecha_operativa,
       r.usuario_id::text AS clave,
       u.nombre AS etiqueta,
       count(distinct p.id)::int AS pedidos,
       sum(r.total)::bigint AS ventas,
       sum(r.propina)::bigint AS propinas,
       (CASE WHEN count(distinct p.id) = 0 THEN 0 ELSE round(sum(r.total)::numeric / count(distinct p.id)) END)::bigint AS ticket_promedio
FROM pedido p
JOIN recibo r ON r.pedido_id = p.id
JOIN usuario u ON u.id = r.usuario_id
WHERE p.estado = 'CERRADO'
GROUP BY p.fecha_operativa, r.usuario_id, u.nombre;--> statement-breakpoint
CREATE OR REPLACE VIEW "v_reporte_pedidos_anulados" AS
SELECT p.fecha_operativa,
       count(*)::int AS pedidos,
       coalesce(sum(p.total), 0)::bigint AS monto
FROM pedido p
WHERE p.estado = 'ANULADO'
GROUP BY p.fecha_operativa;--> statement-breakpoint
CREATE OR REPLACE VIEW "v_pedidos_olvidados" AS
SELECT p.id AS pedido_id,
       p.numero_dia,
       m.nombre AS mesa_nombre,
       p.created_at AS abierto_desde,
       p.updated_at
FROM pedido p
LEFT JOIN mesa m ON m.id = p.mesa_id
WHERE p.estado = 'ABIERTO'
  AND p.updated_at < now() - interval '12 hours';
