DROP VIEW IF EXISTS "v_reporte_ventas_metodo";--> statement-breakpoint
CREATE VIEW "v_reporte_ventas_metodo" AS
WITH pagos_con_base AS (
  SELECT p.id AS pedido_id,
         p.fecha_operativa,
         r.id AS recibo_id,
         r.total AS recibo_total,
         r.propina AS recibo_propina,
         pg.id AS pago_id,
         pg.metodo,
         pg.monto,
         (CASE
           WHEN (r.total + r.propina) > 0 THEN floor((pg.monto::numeric * r.propina::numeric) / (r.total + r.propina)::numeric)::bigint
           ELSE 0::bigint
         END) AS propina_base
  FROM pedido p
  JOIN recibo r ON r.pedido_id = p.id
  JOIN pago pg ON pg.recibo_id = r.id
  WHERE p.estado = 'CERRADO'
),
pagos_con_residuo AS (
  SELECT pedido_id,
         fecha_operativa,
         recibo_id,
         pago_id,
         metodo,
         monto,
         propina_base,
         (recibo_propina - sum(propina_base) OVER (PARTITION BY recibo_id))::bigint AS residuo,
         row_number() OVER (PARTITION BY recibo_id ORDER BY monto DESC, pago_id ASC) AS rn
  FROM pagos_con_base
),
pagos_ajustados AS (
  SELECT pedido_id,
         fecha_operativa,
         metodo,
         monto,
         (propina_base + CASE WHEN rn = 1 THEN residuo ELSE 0::bigint END)::bigint AS propina_asignada,
         (monto - (propina_base + CASE WHEN rn = 1 THEN residuo ELSE 0::bigint END))::bigint AS monto_venta
  FROM pagos_con_residuo
)
SELECT fecha_operativa,
       metodo AS clave,
       metodo AS etiqueta,
       count(distinct pedido_id)::int AS pedidos,
       sum(monto_venta)::bigint AS ventas,
       sum(propina_asignada)::bigint AS propinas,
       sum(monto)::bigint AS cobrado,
       (CASE WHEN count(distinct pedido_id) = 0 THEN 0 ELSE round(sum(monto_venta)::numeric / count(distinct pedido_id)) END)::bigint AS ticket_promedio
FROM pagos_ajustados
GROUP BY fecha_operativa, metodo;
