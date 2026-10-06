CREATE TABLE "configuracion" (
	"clave" text PRIMARY KEY NOT NULL,
	"valor" jsonb NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_by" uuid
);
--> statement-breakpoint
CREATE TABLE "evento_sistema" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "evento_sistema_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"tipo" text NOT NULL,
	"modulo" text NOT NULL,
	"agregado_id" uuid,
	"usuario_id" uuid,
	"payload" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"procesado_at" timestamp with time zone,
	"intentos" integer DEFAULT 0 NOT NULL,
	"ultimo_error" text
);
--> statement-breakpoint
CREATE TABLE "sesion_usuario" (
	"id" uuid PRIMARY KEY NOT NULL,
	"usuario_id" uuid NOT NULL,
	"token_hash" text NOT NULL,
	"expira_at" timestamp with time zone NOT NULL,
	"ultimo_uso_at" timestamp with time zone DEFAULT now() NOT NULL,
	"user_agent" text,
	"ip" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "sesion_usuario_tokenHash_unique" UNIQUE("token_hash")
);
--> statement-breakpoint
CREATE TABLE "usuario" (
	"id" uuid PRIMARY KEY NOT NULL,
	"nombre" text NOT NULL,
	"username" text NOT NULL,
	"password_hash" text NOT NULL,
	"rol" text NOT NULL,
	"activo" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "usuario_username_unique" UNIQUE("username"),
	CONSTRAINT "usuario_rol_check" CHECK ("usuario"."rol" in ('ADMIN', 'CAJERO', 'COCINA')),
	CONSTRAINT "usuario_username_minusculas_check" CHECK ("usuario"."username" = lower("usuario"."username"))
);
--> statement-breakpoint
ALTER TABLE "sesion_usuario" ADD CONSTRAINT "sesion_usuario_usuario_id_usuario_id_fk" FOREIGN KEY ("usuario_id") REFERENCES "public"."usuario"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "evento_sistema_pendiente_idx" ON "evento_sistema" USING btree ("id") WHERE "evento_sistema"."procesado_at" is null;--> statement-breakpoint
CREATE INDEX "evento_sistema_created_at_idx" ON "evento_sistema" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "evento_sistema_tipo_idx" ON "evento_sistema" USING btree ("tipo","created_at");--> statement-breakpoint
CREATE INDEX "sesion_usuario_usuario_idx" ON "sesion_usuario" USING btree ("usuario_id");--> statement-breakpoint
CREATE INDEX "sesion_usuario_expira_idx" ON "sesion_usuario" USING btree ("expira_at");