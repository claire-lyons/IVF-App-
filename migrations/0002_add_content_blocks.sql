CREATE TABLE IF NOT EXISTS "content_blocks" (
  "id" varchar PRIMARY KEY,
  "cycle_template_id" varchar NOT NULL,
  "milestone_name" varchar NOT NULL,
  "milestone_type" varchar,
  "notification_title" varchar,
  "milestone_details" text,
  "medical_information" text,
  "what_to_expect" text,
  "todays_tips" text,
  "milestone_order" integer DEFAULT 0,
  "expected_day_offset" integer,
  "created_at" timestamp DEFAULT now(),
  "updated_at" timestamp DEFAULT now()
);
