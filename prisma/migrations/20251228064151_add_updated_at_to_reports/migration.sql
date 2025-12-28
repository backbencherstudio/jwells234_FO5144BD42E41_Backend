/*
  Warnings:

  - Added the required column `updated_at` to the `shout_reports` table without a default value. This is not possible if the table is not empty.
  - Added the required column `updated_at` to the `user_reports` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "shout_reports" ADD COLUMN     "updated_at" TIMESTAMP(3) NOT NULL;

-- AlterTable
ALTER TABLE "user_reports" ADD COLUMN     "updated_at" TIMESTAMP(3) NOT NULL;
