CREATE TABLE "categoria" (
	"id" uuid PRIMARY KEY NOT NULL,
	"nombre" text NOT NULL,
	"orden" integer DEFAULT 0 NOT NULL,
	"activa" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "categoria_nombre_unique" UNIQUE("nombre")
);
--> statement-breakpoint
CREATE TABLE "producto" (
	"id" uuid PRIMARY KEY NOT NULL,
	"categoria_id" uuid NOT NULL,
	"nombre" text NOT NULL,
	"descripcion" text,
	"precio" bigint NOT NULL,
	"imagen_url" text,
	"activo" boolean DEFAULT true NOT NULL,
	"agotado" boolean DEFAULT false NOT NULL,
	"agotado_manual" boolean,
	"orden" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "producto_precio_positivo_check" CHECK ("producto"."precio" > 0)
);
--> statement-breakpoint
CREATE TABLE "receta_item" (
	"producto_id" uuid NOT NULL,
	"ingrediente_id" uuid NOT NULL,
	"cantidad" integer NOT NULL,
	CONSTRAINT "receta_item_producto_id_ingrediente_id_pk" PRIMARY KEY("producto_id","ingrediente_id"),
	CONSTRAINT "receta_item_cantidad_positiva_check" CHECK ("receta_item"."cantidad" > 0)
);
--> statement-breakpoint
CREATE TABLE "ingrediente" (
	"id" uuid PRIMARY KEY NOT NULL,
	"nombre" text NOT NULL,
	"unidad" text NOT NULL,
	"stock_actual" bigint DEFAULT 0 NOT NULL,
	"stock_minimo" bigint DEFAULT 0 NOT NULL,
	"costo_unitario" bigint DEFAULT 0 NOT NULL,
	"activo" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "ingrediente_nombre_unique" UNIQUE("nombre"),
	CONSTRAINT "ingrediente_unidad_check" CHECK ("ingrediente"."unidad" in ('G', 'ML', 'UND')),
	CONSTRAINT "ingrediente_stock_minimo_check" CHECK ("ingrediente"."stock_minimo" >= 0),
	CONSTRAINT "ingrediente_costo_unitario_check" CHECK ("ingrediente"."costo_unitario" >= 0)
);
--> statement-breakpoint
CREATE TABLE "movimiento_inventario" (
	"id" uuid PRIMARY KEY NOT NULL,
	"ingrediente_id" uuid NOT NULL,
	"tipo" text NOT NULL,
	"cantidad" bigint NOT NULL,
	"stock_resultante" bigint NOT NULL,
	"referencia_tipo" text,
	"referencia_id" uuid,
	"usuario_id" uuid NOT NULL,
	"motivo" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "movimiento_inventario_tipo_check" CHECK ("movimiento_inventario"."tipo" in ('CONSUMO', 'ENTRADA', 'AJUSTE', 'MERMA', 'REVERSION')),
	CONSTRAINT "movimiento_inventario_cantidad_no_cero_check" CHECK ("movimiento_inventario"."cantidad" != 0)
);
--> statement-breakpoint
ALTER TABLE "producto" ADD CONSTRAINT "producto_categoria_id_categoria_id_fk" FOREIGN KEY ("categoria_id") REFERENCES "public"."categoria"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "receta_item" ADD CONSTRAINT "receta_item_producto_id_producto_id_fk" FOREIGN KEY ("producto_id") REFERENCES "public"."producto"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "receta_item" ADD CONSTRAINT "receta_item_ingrediente_id_ingrediente_id_fk" FOREIGN KEY ("ingrediente_id") REFERENCES "public"."ingrediente"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "movimiento_inventario" ADD CONSTRAINT "movimiento_inventario_ingrediente_id_ingrediente_id_fk" FOREIGN KEY ("ingrediente_id") REFERENCES "public"."ingrediente"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "movimiento_inventario" ADD CONSTRAINT "movimiento_inventario_usuario_id_fk" FOREIGN KEY ("usuario_id") REFERENCES "public"."usuario"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "producto_nombre_lower_idx" ON "producto" USING btree (lower("nombre"));--> statement-breakpoint
CREATE INDEX "movimiento_inventario_ingrediente_created_idx" ON "movimiento_inventario" USING btree ("ingrediente_id","created_at");