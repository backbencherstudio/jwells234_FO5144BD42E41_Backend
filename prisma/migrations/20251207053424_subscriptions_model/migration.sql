-- CreateEnum
CREATE TYPE "Interval" AS ENUM ('MONTH', 'YEAR');

-- CreateEnum
CREATE TYPE "SubscriptionPlan" AS ENUM ('FREE', 'PREMIUM_MONTHLY', 'PREMIUM_YEARLY');

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "subscriptionId" TEXT;

-- CreateTable
CREATE TABLE "SubsPlan" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "description" TEXT,
    "price_description" TEXT,
    "isFree" BOOLEAN NOT NULL DEFAULT false,
    "price" INTEGER,
    "currency" TEXT,
    "interval" "Interval",
    "intervalCount" INTEGER,
    "stripeProductId" TEXT,
    "stripePriceId" TEXT,
    "trialDays" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SubsPlan_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payment_methods" (
    "id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deleted_at" TIMESTAMP(3),
    "status" SMALLINT DEFAULT 1,
    "type" TEXT,
    "brand" TEXT,
    "last4" TEXT,
    "exp_month" INTEGER,
    "exp_year" INTEGER,
    "cardholder_name" TEXT,
    "payment_method_id" TEXT NOT NULL,
    "sort_order" INTEGER DEFAULT 0,
    "user_id" TEXT NOT NULL,

    CONSTRAINT "payment_methods_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "subscriptions" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "planId" TEXT NOT NULL,
    "startDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "endDate" TIMESTAMP(3),
    "trialEndsAt" TIMESTAMP(3),
    "status" TEXT,
    "stripeSubId" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "cancelAtPeriodEnd" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "subscriptions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "SubsPlan_slug_key" ON "SubsPlan"("slug");

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_subscriptionId_fkey" FOREIGN KEY ("subscriptionId") REFERENCES "subscriptions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payment_methods" ADD CONSTRAINT "payment_methods_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "subscriptions" ADD CONSTRAINT "subscriptions_planId_fkey" FOREIGN KEY ("planId") REFERENCES "SubsPlan"("id") ON DELETE CASCADE ON UPDATE CASCADE;
