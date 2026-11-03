CREATE TYPE "public"."answer_kind" AS ENUM('fact', 'estimate');--> statement-breakpoint
CREATE TYPE "public"."attempt_status" AS ENUM('active', 'solved', 'revealed', 'skipped');--> statement-breakpoint
CREATE TYPE "public"."difficulty" AS ENUM('easy', 'medium', 'hard', 'insane');--> statement-breakpoint
CREATE TYPE "public"."guess_direction" AS ENUM('high', 'low', 'exact');--> statement-breakpoint
CREATE TYPE "public"."play_mode" AS ENUM('random', 'daily', 'category', 'endless');--> statement-breakpoint
CREATE TYPE "public"."run_status" AS ENUM('active', 'ended');--> statement-breakpoint
CREATE TABLE "attempts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"question_id" integer NOT NULL,
	"mode" "play_mode" NOT NULL,
	"daily_date" date,
	"run_id" uuid,
	"status" "attempt_status" DEFAULT 'active' NOT NULL,
	"practice" boolean DEFAULT false NOT NULL,
	"guess_count" integer DEFAULT 0 NOT NULL,
	"first_error" double precision,
	"best_error" double precision,
	"best_guess" double precision,
	"points" integer DEFAULT 0 NOT NULL,
	"xp_gained" integer DEFAULT 0 NOT NULL,
	"score_breakdown" jsonb,
	"personal_best" boolean DEFAULT false NOT NULL,
	"started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"finished_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "categories" (
	"slug" varchar(48) PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	"icon" varchar(48) NOT NULL,
	"color" varchar(16) NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "daily_challenges" (
	"date" date PRIMARY KEY NOT NULL,
	"question_id" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "endless_runs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"status" "run_status" DEFAULT 'active' NOT NULL,
	"solved_count" integer DEFAULT 0 NOT NULL,
	"questions_played" integer DEFAULT 0 NOT NULL,
	"current_streak" integer DEFAULT 0 NOT NULL,
	"best_streak" integer DEFAULT 0 NOT NULL,
	"total_accuracy" double precision DEFAULT 0 NOT NULL,
	"started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"ended_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "guesses" (
	"id" serial PRIMARY KEY NOT NULL,
	"attempt_id" uuid NOT NULL,
	"value" double precision NOT NULL,
	"log_error" double precision NOT NULL,
	"direction" "guess_direction" NOT NULL,
	"tier" varchar(24) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "question_packs" (
	"id" serial PRIMARY KEY NOT NULL,
	"slug" varchar(64) NOT NULL,
	"name" text NOT NULL,
	"author_id" uuid,
	"is_public" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "question_packs_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "questions" (
	"id" serial PRIMARY KEY NOT NULL,
	"slug" varchar(96) NOT NULL,
	"text" text NOT NULL,
	"category_slug" varchar(48) NOT NULL,
	"difficulty" "difficulty" NOT NULL,
	"answer" double precision NOT NULL,
	"answer_low" double precision,
	"answer_high" double precision,
	"unit" text NOT NULL,
	"tolerance_ratio" double precision NOT NULL,
	"answer_kind" "answer_kind" NOT NULL,
	"explanation" text NOT NULL,
	"reasoning" jsonb NOT NULL,
	"fact" text NOT NULL,
	"image_url" text,
	"sources" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"daily_eligible" boolean DEFAULT true NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"pack_id" integer,
	"author_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "questions_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "session" (
	"sid" varchar PRIMARY KEY NOT NULL,
	"sess" json NOT NULL,
	"expire" timestamp (6) NOT NULL
);
--> statement-breakpoint
CREATE TABLE "user_achievements" (
	"user_id" uuid NOT NULL,
	"key" varchar(48) NOT NULL,
	"unlocked_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "user_achievements_user_id_key_pk" PRIMARY KEY("user_id","key")
);
--> statement-breakpoint
CREATE TABLE "user_stats" (
	"user_id" uuid PRIMARY KEY NOT NULL,
	"xp" integer DEFAULT 0 NOT NULL,
	"daily_streak" integer DEFAULT 0 NOT NULL,
	"best_daily_streak" integer DEFAULT 0 NOT NULL,
	"last_daily_date" date,
	"best_endless_streak" integer DEFAULT 0 NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"username" varchar(32),
	"password_hash" text,
	"is_guest" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "attempts" ADD CONSTRAINT "attempts_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "attempts" ADD CONSTRAINT "attempts_question_id_questions_id_fk" FOREIGN KEY ("question_id") REFERENCES "public"."questions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "attempts" ADD CONSTRAINT "attempts_run_id_endless_runs_id_fk" FOREIGN KEY ("run_id") REFERENCES "public"."endless_runs"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "daily_challenges" ADD CONSTRAINT "daily_challenges_question_id_questions_id_fk" FOREIGN KEY ("question_id") REFERENCES "public"."questions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "endless_runs" ADD CONSTRAINT "endless_runs_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "guesses" ADD CONSTRAINT "guesses_attempt_id_attempts_id_fk" FOREIGN KEY ("attempt_id") REFERENCES "public"."attempts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "question_packs" ADD CONSTRAINT "question_packs_author_id_users_id_fk" FOREIGN KEY ("author_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "questions" ADD CONSTRAINT "questions_category_slug_categories_slug_fk" FOREIGN KEY ("category_slug") REFERENCES "public"."categories"("slug") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "questions" ADD CONSTRAINT "questions_pack_id_question_packs_id_fk" FOREIGN KEY ("pack_id") REFERENCES "public"."question_packs"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "questions" ADD CONSTRAINT "questions_author_id_users_id_fk" FOREIGN KEY ("author_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_achievements" ADD CONSTRAINT "user_achievements_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_stats" ADD CONSTRAINT "user_stats_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "attempts_user_idx" ON "attempts" USING btree ("user_id","started_at");--> statement-breakpoint
CREATE INDEX "attempts_question_idx" ON "attempts" USING btree ("question_id");--> statement-breakpoint
CREATE INDEX "attempts_daily_idx" ON "attempts" USING btree ("daily_date");--> statement-breakpoint
CREATE UNIQUE INDEX "attempts_daily_unique_idx" ON "attempts" USING btree ("user_id","daily_date") WHERE "attempts"."mode" = 'daily' and "attempts"."practice" = false;--> statement-breakpoint
CREATE INDEX "endless_runs_user_idx" ON "endless_runs" USING btree ("user_id","status");--> statement-breakpoint
CREATE INDEX "guesses_attempt_idx" ON "guesses" USING btree ("attempt_id");--> statement-breakpoint
CREATE INDEX "questions_filter_idx" ON "questions" USING btree ("category_slug","difficulty","is_active");--> statement-breakpoint
CREATE INDEX "IDX_session_expire" ON "session" USING btree ("expire");--> statement-breakpoint
CREATE UNIQUE INDEX "users_username_lower_idx" ON "users" USING btree (lower("username"));