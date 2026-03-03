-- CreateEnum
CREATE TYPE "VoteChoice" AS ENUM ('ITEM', 'IMAGE', 'DATA', 'NEAR');

-- CreateTable
CREATE TABLE "vote_events" (
    "id" TEXT NOT NULL,
    "sid" TEXT NOT NULL,
    "choice" "VoteChoice" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "vote_events_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "vote_events_sid_choice_idx" ON "vote_events"("sid", "choice");
