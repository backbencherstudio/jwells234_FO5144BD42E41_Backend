/*
  Warnings:

  - The values [PREMIUM_MONTHLY,PREMIUM_YEARLY] on the enum `SubscriptionPlan` will be removed. If these variants are still used in the database, this will fail.
  - Added the required column `type` to the `subscriptions` table without a default value. This is not possible if the table is not empty.

*/
-- AlterEnum
BEGIN;
CREATE TYPE "SubscriptionPlan_new" AS ENUM ('FREE', 'TRIALING', 'BASIC', 'PREMIUM');
ALTER TYPE "SubscriptionPlan" RENAME TO "SubscriptionPlan_old";
ALTER TYPE "SubscriptionPlan_new" RENAME TO "SubscriptionPlan";
DROP TYPE "SubscriptionPlan_old";
COMMIT;

-- AlterTable
ALTER TABLE "SubsPlan" ADD COLUMN     "type" "SubscriptionPlan" NOT NULL DEFAULT 'FREE';

-- AlterTable
ALTER TABLE "subscriptions" ADD COLUMN     "isTrial" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "remainingDays" INTEGER,
ADD COLUMN     "type" TEXT NOT NULL;
