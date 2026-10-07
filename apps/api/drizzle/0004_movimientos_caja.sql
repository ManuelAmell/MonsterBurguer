CREATE TABLE "movimiento_caja" (
	"id" uuid PRIMARY KEY NOT NULL,
	"sesion_caja_id" uuid NOT NULL,
	"tipo" text NOT NULL,
	"monto" bigint NOT NULL,
	"motivo" text NOT NULL,
	"usuario_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "movimiento_caja_tipo_check" CHECK ("movimiento_caja"."tipo" in ('INGRESO', 'RETIRO')),
	CONSTRAINT "movimiento_caja_monto_check" CHECK ("movimiento_caja"."monto" > 0),
	CONSTRAINT "movimiento_caja_motivo_check" CHECK (length("movimiento_caja"."motivo") between 3 and 140)
);
--> statement-breakpoint
ALTER TABLE "movimiento_caja" ADD CONSTRAINT "movimiento_caja_sesion_caja_id_sesion_caja_id_fk" FOREIGN KEY ("sesion_caja_id") REFERENCES "public"."sesion_caja"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "movimiento_caja_sesion_idx" ON "movimiento_caja" USING btree ("sesion_caja_id");--> statement-breakpoint
CREATE INDEX "movimiento_caja_created_idx" ON "movimiento_caja" USING btree ("created_at");--> statement-breakpoint
-- FK a identidad (fronteras de módulo)
ALTER TABLE "movimiento_caja" ADD CONSTRAINT "movimiento_caja_usuario_id_usuario_id_fk" FOREIGN KEY ("usuario_id") REFERENCES "public"."usuario"("id") ON DELETE restrict ON UPDATE no action;
