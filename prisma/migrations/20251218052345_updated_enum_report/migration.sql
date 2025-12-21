-- CreateEnum
CREATE TYPE "ReportStatus" AS ENUM ('PENDING', 'REVIEWED', 'RESOLVED');

-- AlterTable
ALTER TABLE "shout_reports" ADD COLUMN     "status" "ReportStatus" NOT NULL DEFAULT 'PENDING';

-- AlterTable
ALTER TABLE "user_reports" ADD COLUMN     "status" "ReportStatus" NOT NULL DEFAULT 'PENDING';
