CREATE TYPE "public"."question_shape" AS ENUM('stock', 'flow', 'tally', 'fit', 'scale', 'clock', 'trivia');--> statement-breakpoint
ALTER TABLE "questions" ADD COLUMN "qualifier" text;--> statement-breakpoint
ALTER TABLE "questions" ADD COLUMN "shape" "question_shape";