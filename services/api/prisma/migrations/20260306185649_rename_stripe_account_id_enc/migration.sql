/*
  Warnings:

  - You are about to drop the column `stripeAccountId` on the `Vendor` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "Vendor" DROP COLUMN "stripeAccountId",
ADD COLUMN     "stripeAccountIdEnc" TEXT;
