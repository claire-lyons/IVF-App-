CREATE TABLE "clinics" (
	"id" varchar PRIMARY KEY NOT NULL,
	"name" varchar NOT NULL,
	"display_order" integer DEFAULT 0,
	"active" boolean DEFAULT true,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "clinics_name_unique" UNIQUE("name")
);
--> statement-breakpoint
CREATE TABLE "cycle_types" (
	"id" varchar PRIMARY KEY NOT NULL,
	"label" varchar NOT NULL,
	"display_order" integer DEFAULT 0,
	"active" boolean DEFAULT true,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "event_types" (
	"id" varchar PRIMARY KEY NOT NULL,
	"label" varchar NOT NULL,
	"display_order" integer DEFAULT 0,
	"active" boolean DEFAULT true,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "milestone_types" (
	"id" varchar PRIMARY KEY NOT NULL,
	"cycle_type" varchar NOT NULL,
	"label" varchar NOT NULL,
	"display_order" integer DEFAULT 0,
	"active" boolean DEFAULT true,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "treatment_types" (
	"id" varchar PRIMARY KEY NOT NULL,
	"label" varchar NOT NULL,
	"description" text,
	"display_order" integer DEFAULT 0,
	"active" boolean DEFAULT true,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE UNIQUE INDEX "forum_post_reactions_post_user_unique" ON "forum_post_reactions" USING btree ("post_id","user_id");