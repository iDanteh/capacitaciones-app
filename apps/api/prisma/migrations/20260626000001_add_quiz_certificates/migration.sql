-- Drop old compound unique index (incompatible with nullable courseId)
DROP INDEX IF EXISTS "certificates_tenantId_userId_courseId_key";

-- Make courseId nullable (quiz certificates don't have a courseId)
ALTER TABLE "certificates" ALTER COLUMN "courseId" DROP NOT NULL;

-- Make enrollmentId nullable (quiz certificates don't have an enrollmentId)
ALTER TABLE "certificates" ALTER COLUMN "enrollmentId" DROP NOT NULL;

-- Add quizId column (snapshot of quizId for quiz certificates)
ALTER TABLE "certificates" ADD COLUMN "quizId" TEXT;

-- Add quizAssignmentId column (1 certificate per quiz assignment)
ALTER TABLE "certificates" ADD COLUMN "quizAssignmentId" TEXT;

-- Unique: 1 certificate per quiz assignment
CREATE UNIQUE INDEX "certificates_quizAssignmentId_key" ON "certificates"("quizAssignmentId");

-- Compound index for efficient queries by tenant + user
CREATE INDEX "certificates_tenantId_userId_idx" ON "certificates"("tenantId", "userId");

-- Foreign key: certificate → quiz_assignment
ALTER TABLE "certificates" ADD CONSTRAINT "certificates_quizAssignmentId_fkey"
  FOREIGN KEY ("quizAssignmentId") REFERENCES "quiz_assignments"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;
