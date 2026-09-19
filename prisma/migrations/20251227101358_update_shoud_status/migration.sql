-- CreateEnum
CREATE TYPE "ShoutStatus" AS ENUM ('FLAGGED', 'PUBLISHED', 'DELETED');

-- AlterTable
ALTER TABLE "shouts" ADD COLUMN     "status" "ShoutStatus" NOT NULL DEFAULT 'PUBLISHED';
