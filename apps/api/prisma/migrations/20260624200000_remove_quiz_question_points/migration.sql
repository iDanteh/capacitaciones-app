-- AlterTable: remove points column from quiz_questions.
-- Score is now calculated as (correct answers / total questions) * 100.
ALTER TABLE "quiz_questions" DROP COLUMN "points";
