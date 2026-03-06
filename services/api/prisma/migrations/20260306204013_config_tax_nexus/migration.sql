-- AlterTable
ALTER TABLE "StoreSettings" ADD COLUMN     "taxNexus" TEXT[] DEFAULT ARRAY[]::TEXT[];
