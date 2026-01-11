-- CreateEnum
CREATE TYPE "SupportStatus" AS ENUM ('OPEN', 'IN_PROGRESS', 'RESOLVED', 'CLOSED');

-- AlterTable
ALTER TABLE "support_requests" ADD COLUMN     "status" "SupportStatus" DEFAULT 'OPEN';
