-- CreateTable
CREATE TABLE "processed_stripe_events" (
    "id" TEXT NOT NULL,
    "stripeEventId" TEXT NOT NULL,
    "eventType" TEXT NOT NULL,
    "processedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "processed_stripe_events_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "processed_stripe_events_stripeEventId_key" ON "processed_stripe_events"("stripeEventId");

-- CreateIndex
CREATE INDEX "processed_stripe_events_processedAt_idx" ON "processed_stripe_events"("processedAt");
