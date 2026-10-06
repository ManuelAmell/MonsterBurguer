CREATE TABLE "cliente" (
	"id" uuid PRIMARY KEY NOT NULL,
	"nombre" text NOT NULL,
	"telefono" text,
	"documento" text,
	"email" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "mesa" (
	"id" uuid PRIMARY KEY NOT NULL,
	"nombre" text NOT NULL,
	"capacidad" integer DEFAULT 4 NOT NULL,
	"activa" boolean DEFAULT true NOT NULL,
	"orden" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "mesa_nombre_unique" UNIQUE("nombre")
);
--> statement-breakpoint
CREATE UNIQUE INDEX "cliente_telefono_unique" ON "cliente" USING btree ("telefono") WHERE "cliente"."telefono" is not null;