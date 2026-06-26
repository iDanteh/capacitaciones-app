-- DropForeignKey
ALTER TABLE "certificates" DROP CONSTRAINT "certificates_enrollmentId_fkey";

-- DropForeignKey
ALTER TABLE "certificates" DROP CONSTRAINT "certificates_quizAssignmentId_fkey";

-- AddForeignKey
ALTER TABLE "certificates" ADD CONSTRAINT "certificates_enrollmentId_fkey" FOREIGN KEY ("enrollmentId") REFERENCES "enrollments"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "certificates" ADD CONSTRAINT "certificates_quizAssignmentId_fkey" FOREIGN KEY ("quizAssignmentId") REFERENCES "quiz_assignments"("id") ON DELETE SET NULL ON UPDATE CASCADE;
