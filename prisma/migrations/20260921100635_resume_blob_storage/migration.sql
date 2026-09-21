-- CreateTable
CREATE TABLE "resume_blobs" (
    "id" TEXT NOT NULL,
    "data" BYTEA NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "resume_blobs_pkey" PRIMARY KEY ("id")
);
