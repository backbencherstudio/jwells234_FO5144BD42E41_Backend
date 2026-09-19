/*
  Warnings:

  - You are about to drop the column `stripeSubId` on the `subscriptions` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "subscriptions" DROP COLUMN "stripeSubId",
ADD COLUMN     "paystackSubId" TEXT;
