-- CreateEnum
CREATE TYPE "ContactStatus" AS ENUM ('OPEN', 'IN_PROGRESS', 'RESOLVED', 'CLOSED');

-- AlterTable
ALTER TABLE "contacts" ADD COLUMN     "status" "ContactStatus" DEFAULT 'OPEN';
