-- CreateIndex
CREATE INDEX "course_modules_courseId_deletedAt_idx" ON "course_modules"("courseId", "deletedAt");

-- CreateIndex
CREATE INDEX "courses_tenantId_deletedAt_idx" ON "courses"("tenantId", "deletedAt");

-- CreateIndex
CREATE INDEX "lessons_moduleId_deletedAt_idx" ON "lessons"("moduleId", "deletedAt");

-- CreateIndex
CREATE INDEX "users_tenantId_deletedAt_idx" ON "users"("tenantId", "deletedAt");
