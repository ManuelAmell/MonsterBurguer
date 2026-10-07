CREATE SEQUENCE "public"."recibo_numero_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1;--> statement-breakpoint
CREATE TABLE "pago" (
	"id" uuid PRIMARY KEY NOT NULL,
	"recibo_id" uuid NOT NULL,
	"metodo" text NOT NULL,
	"monto" bigint NOT NULL,
	"recibido" bigint,
	"cambio" bigint,
	"referencia" text,
	CONSTRAINT "pago_metodo_check" CHECK ("pago"."metodo" in ('EFECTIVO', 'TARJETA', 'TRANSFERENCIA')),
	CONSTRAINT "pago_monto_check" CHECK ("pago"."monto" > 0),
	CONSTRAINT "pago_recibido_check" CHECK ("pago"."recibido" is null or "pago"."recibido" >= "pago"."monto")
);
--> statement-breakpoint
CREATE TABLE "recibo" (
	"id" uuid PRIMARY KEY NOT NULL,
	"numero" bigint DEFAULT nextval('recibo_numero_seq') NOT NULL,
	"pedido_id" uuid NOT NULL,
	"sesion_caja_id" uuid NOT NULL,
	"usuario_id" uuid NOT NULL,
	"total" bigint NOT NULL,
	"base" bigint NOT NULL,
	"impuesto" bigint NOT NULL,
	"impuesto_tasa_bp" integer DEFAULT 0 NOT NULL,
	"regimen_tributario" text NOT NULL,
	"propina" bigint DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "recibo_numero_unique" UNIQUE("numero"),
	CONSTRAINT "recibo_pedidoId_unique" UNIQUE("pedido_id")
);
--> statement-breakpoint
CREATE TABLE "sesion_caja" (
	"id" uuid PRIMARY KEY NOT NULL,
	"usuario_id" uuid NOT NULL,
	"estado" text DEFAULT 'ABIERTA' NOT NULL,
	"monto_apertura" bigint NOT NULL,
	"efectivo_esperado" bigint,
	"efectivo_contado" bigint,
	"diferencia" bigint,
	"abierta_at" timestamp with time zone DEFAULT now() NOT NULL,
	"cerrada_at" timestamp with time zone,
	"version" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "sesion_caja_estado_check" CHECK ("sesion_caja"."estado" in ('ABIERTA', 'CERRADA')),
	CONSTRAINT "sesion_caja_monto_apertura_check" CHECK ("sesion_caja"."monto_apertura" >= 0)
);
--> statement-breakpoint
CREATE TABLE "comanda" (
	"id" uuid PRIMARY KEY NOT NULL,
	"pedido_id" uuid NOT NULL,
	"numero_dia" integer NOT NULL,
	"tipo_pedido" text NOT NULL,
	"mesa_nombre" text,
	"estado" text DEFAULT 'PENDIENTE' NOT NULL,
	"iniciada_at" timestamp with time zone,
	"lista_at" timestamp with time zone,
	"entregada_at" timestamp with time zone,
	"anulada_at" timestamp with time zone,
	"version" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "comanda_pedidoId_unique" UNIQUE("pedido_id"),
	CONSTRAINT "comanda_tipo_pedido_check" CHECK ("comanda"."tipo_pedido" in ('MESA', 'LLEVAR')),
	CONSTRAINT "comanda_estado_check" CHECK ("comanda"."estado" in ('PENDIENTE', 'EN_PREPARACION', 'LISTA', 'ENTREGADA', 'ANULADA'))
);
--> statement-breakpoint
CREATE TABLE "comanda_item" (
	"id" uuid PRIMARY KEY NOT NULL,
	"comanda_id" uuid NOT NULL,
	"nombre" text NOT NULL,
	"cantidad" integer NOT NULL,
	"nota" text,
	"orden" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "contador_dia" (
	"fecha_operativa" date PRIMARY KEY NOT NULL,
	"ultimo_numero" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "pedido" (
	"id" uuid PRIMARY KEY NOT NULL,
	"fecha_operativa" date NOT NULL,
	"numero_dia" integer NOT NULL,
	"tipo" text NOT NULL,
	"mesa_id" uuid,
	"cliente_id" uuid,
	"usuario_id" uuid NOT NULL,
	"estado" text DEFAULT 'ABIERTO' NOT NULL,
	"total" bigint DEFAULT 0 NOT NULL,
	"base" bigint DEFAULT 0 NOT NULL,
	"impuesto" bigint DEFAULT 0 NOT NULL,
	"nota" text,
	"confirmado_at" timestamp with time zone,
	"cerrado_at" timestamp with time zone,
	"anulado_at" timestamp with time zone,
	"anulado_por" uuid,
	"motivo_anulacion" text,
	"version" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "pedido_fecha_numero_uq" UNIQUE("fecha_operativa","numero_dia"),
	CONSTRAINT "pedido_tipo_check" CHECK ("pedido"."tipo" in ('MESA', 'LLEVAR')),
	CONSTRAINT "pedido_estado_check" CHECK ("pedido"."estado" in ('ABIERTO', 'CONFIRMADO', 'CERRADO', 'ANULADO')),
	CONSTRAINT "pedido_total_check" CHECK ("pedido"."total" >= 0),
	CONSTRAINT "pedido_mesa_tipo_check" CHECK (("pedido"."tipo" = 'MESA') = ("pedido"."mesa_id" is not null))
);
--> statement-breakpoint
CREATE TABLE "pedido_item" (
	"id" uuid PRIMARY KEY NOT NULL,
	"pedido_id" uuid NOT NULL,
	"producto_id" uuid NOT NULL,
	"nombre_producto" text NOT NULL,
	"precio_unitario" bigint NOT NULL,
	"cantidad" integer NOT NULL,
	"nota" text,
	"total_linea" bigint NOT NULL,
	"orden" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "pedido_item_cantidad_check" CHECK ("pedido_item"."cantidad" between 1 and 99),
	CONSTRAINT "pedido_item_nota_check" CHECK ("pedido_item"."nota" is null or length("pedido_item"."nota") <= 140)
);
--> statement-breakpoint
ALTER TABLE "pago" ADD CONSTRAINT "pago_recibo_id_recibo_id_fk" FOREIGN KEY ("recibo_id") REFERENCES "public"."recibo"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recibo" ADD CONSTRAINT "recibo_sesion_caja_id_sesion_caja_id_fk" FOREIGN KEY ("sesion_caja_id") REFERENCES "public"."sesion_caja"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "comanda_item" ADD CONSTRAINT "comanda_item_comanda_id_comanda_id_fk" FOREIGN KEY ("comanda_id") REFERENCES "public"."comanda"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pedido" ADD CONSTRAINT "pedido_mesa_id_mesa_id_fk" FOREIGN KEY ("mesa_id") REFERENCES "public"."mesa"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pedido_item" ADD CONSTRAINT "pedido_item_pedido_id_pedido_id_fk" FOREIGN KEY ("pedido_id") REFERENCES "public"."pedido"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "pago_efectivo_por_recibo_uq" ON "pago" USING btree ("recibo_id") WHERE "pago"."metodo" = 'EFECTIVO';--> statement-breakpoint
CREATE INDEX "recibo_sesion_idx" ON "recibo" USING btree ("sesion_caja_id");--> statement-breakpoint
CREATE UNIQUE INDEX "sesion_caja_abierta_usuario_uq" ON "sesion_caja" USING btree ("usuario_id") WHERE "sesion_caja"."estado" = 'ABIERTA';--> statement-breakpoint
CREATE INDEX "comanda_activas_idx" ON "comanda" USING btree ("estado","created_at") WHERE "comanda"."estado" in ('PENDIENTE', 'EN_PREPARACION', 'LISTA');--> statement-breakpoint
CREATE INDEX "comanda_item_comanda_idx" ON "comanda_item" USING btree ("comanda_id");--> statement-breakpoint
CREATE UNIQUE INDEX "pedido_mesa_activa_uq" ON "pedido" USING btree ("mesa_id") WHERE "pedido"."estado" in ('ABIERTO', 'CONFIRMADO');--> statement-breakpoint
CREATE INDEX "pedido_estado_fecha_idx" ON "pedido" USING btree ("estado","fecha_operativa");--> statement-breakpoint
CREATE INDEX "pedido_item_pedido_idx" ON "pedido_item" USING btree ("pedido_id");
--> statement-breakpoint
-- FKs entre módulos (en el esquema TS son columnas uuid simples: fronteras de módulo).
ALTER TABLE "pedido" ADD CONSTRAINT "pedido_cliente_id_cliente_id_fk" FOREIGN KEY ("cliente_id") REFERENCES "public"."cliente"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pedido" ADD CONSTRAINT "pedido_usuario_id_usuario_id_fk" FOREIGN KEY ("usuario_id") REFERENCES "public"."usuario"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pedido" ADD CONSTRAINT "pedido_anulado_por_usuario_id_fk" FOREIGN KEY ("anulado_por") REFERENCES "public"."usuario"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pedido_item" ADD CONSTRAINT "pedido_item_producto_id_producto_id_fk" FOREIGN KEY ("producto_id") REFERENCES "public"."producto"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "comanda" ADD CONSTRAINT "comanda_pedido_id_pedido_id_fk" FOREIGN KEY ("pedido_id") REFERENCES "public"."pedido"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sesion_caja" ADD CONSTRAINT "sesion_caja_usuario_id_usuario_id_fk" FOREIGN KEY ("usuario_id") REFERENCES "public"."usuario"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recibo" ADD CONSTRAINT "recibo_pedido_id_pedido_id_fk" FOREIGN KEY ("pedido_id") REFERENCES "public"."pedido"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recibo" ADD CONSTRAINT "recibo_usuario_id_usuario_id_fk" FOREIGN KEY ("usuario_id") REFERENCES "public"."usuario"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint

-- Vistas de solo lectura para el módulo administracion (docs/DATA_MODEL.md "Vistas para reportes").
CREATE VIEW "v_ventas_dia" AS
SELECT p.fecha_operativa,
       sum(r.total)::bigint AS total,
       sum(r.base)::bigint AS base,
       sum(r.impuesto)::bigint AS impuesto,
       sum(r.propina)::bigint AS propinas,
       count(*)::int AS pedidos,
       (CASE WHEN count(*) = 0 THEN 0 ELSE round(sum(r.total)::numeric / count(*)) END)::bigint AS ticket_promedio
FROM pedido p
JOIN recibo r ON r.pedido_id = p.id
WHERE p.estado = 'CERRADO'
GROUP BY p.fecha_operativa;--> statement-breakpoint
CREATE VIEW "v_ventas_producto" AS
SELECT p.fecha_operativa,
       i.producto_id,
       i.nombre_producto AS nombre,
       sum(i.cantidad)::bigint AS unidades,
       sum(i.total_linea)::bigint AS monto
FROM pedido_item i
JOIN pedido p ON p.id = i.pedido_id
WHERE p.estado = 'CERRADO'
GROUP BY p.fecha_operativa, i.producto_id, i.nombre_producto;--> statement-breakpoint
CREATE VIEW "v_ventas_hora" AS
SELECT p.fecha_operativa,
       extract(hour FROM r.created_at AT TIME ZONE 'America/Bogota')::int AS hora,
       sum(r.total)::bigint AS total,
       count(*)::int AS pedidos
FROM pedido p
JOIN recibo r ON r.pedido_id = p.id
WHERE p.estado = 'CERRADO'
GROUP BY p.fecha_operativa, extract(hour FROM r.created_at AT TIME ZONE 'America/Bogota');--> statement-breakpoint
CREATE VIEW "v_tiempos_cocina" AS
SELECT p.fecha_operativa,
       avg(extract(epoch FROM (c.lista_at - c.created_at)))::float8 AS promedio_seg,
       (percentile_cont(0.9) WITHIN GROUP (ORDER BY extract(epoch FROM (c.lista_at - c.created_at))))::float8 AS p90_seg,
       count(*)::int AS comandas
FROM comanda c
JOIN pedido p ON p.id = c.pedido_id
WHERE c.lista_at IS NOT NULL AND c.estado <> 'ANULADA'
GROUP BY p.fecha_operativa;--> statement-breakpoint
CREATE VIEW "v_stock_alertas" AS
SELECT id AS ingrediente_id, nombre, unidad, stock_actual, stock_minimo, (stock_actual <= 0) AS agotado
FROM ingrediente
WHERE activo AND stock_actual <= stock_minimo;--> statement-breakpoint
CREATE VIEW "v_productos_agotados" AS
SELECT id AS producto_id, nombre, agotado_manual
FROM producto
WHERE activo AND agotado;
