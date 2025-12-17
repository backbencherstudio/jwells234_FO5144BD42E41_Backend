-- CreateTable
CREATE TABLE "shout_reports" (
    "id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "user_id" TEXT NOT NULL,
    "shout_id" TEXT NOT NULL,
    "reason" TEXT,

    CONSTRAINT "shout_reports_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "shout_reports_user_id_shout_id_key" ON "shout_reports"("user_id", "shout_id");

-- AddForeignKey
ALTER TABLE "shout_reports" ADD CONSTRAINT "shout_reports_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "shout_reports" ADD CONSTRAINT "shout_reports_shout_id_fkey" FOREIGN KEY ("shout_id") REFERENCES "shouts"("id") ON DELETE CASCADE ON UPDATE CASCADE;
