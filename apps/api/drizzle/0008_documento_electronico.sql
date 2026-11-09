CREATE TABLE "documento_electronico" (
	"id" uuid PRIMARY KEY NOT NULL,
	"recibo_id" uuid NOT NULL,
	"cude" text NOT NULL,
	"qr" text NOT NULL,
	"proveedor" text NOT NULL,
	"estado" text DEFAULT 'EMITIDO' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "documento_electronico_estado_check" CHECK ("documento_electronico"."estado" in ('EMITIDO', 'RECHAZADO', 'CONTINGENCIA'))
);
--> statement-breakpoint
ALTER TABLE "documento_electronico" ADD CONSTRAINT "documento_electronico_recibo_id_recibo_id_fk" FOREIGN KEY ("recibo_id") REFERENCES "public"."recibo"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "documento_electronico_recibo_uq" ON "documento_electronico" USING btree ("recibo_id");--> statement-breakpoint
CREATE INDEX "documento_electronico_recibo_idx" ON "documento_electronico" USING btree ("recibo_id");
