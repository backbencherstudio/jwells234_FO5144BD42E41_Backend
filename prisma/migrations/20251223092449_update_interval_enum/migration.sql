/*
  Warnings:

  - The values [MONTH,YEAR,QUARTERLY,BIANNUALLY] on the enum `Interval` will be removed. If these variants are still used in the database, this will fail.

*/
-- AlterEnum
BEGIN;
CREATE TYPE "Interval_new" AS ENUM ('monthly', 'quarterly', 'biannually', 'annually');
ALTER TABLE "SubsPlan" ALTER COLUMN "interval" TYPE "Interval_new" USING (
  CASE
    WHEN "interval"::text = 'MONTH' THEN 'monthly'::"Interval_new"
    WHEN "interval"::text = 'YEAR' THEN 'annually'::"Interval_new"
    WHEN "interval"::text = 'QUARTERLY' THEN 'quarterly'::"Interval_new"
    WHEN "interval"::text = 'BIANNUALLY' THEN 'biannually'::"Interval_new"
    ELSE "interval"::text::"Interval_new"
  END
);
ALTER TYPE "Interval" RENAME TO "Interval_old";
ALTER TYPE "Interval_new" RENAME TO "Interval";
DROP TYPE "Interval_old";
COMMIT;
