-- CreateTable
CREATE TABLE "support_requests" (
    "id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deleted_at" TIMESTAMP(3),
    "user_id" TEXT,
    "name" TEXT,
    "email" TEXT,
    "subject" TEXT,
    "message" TEXT,

    CONSTRAINT "support_requests_pkey" PRIMARY KEY ("id")
);
