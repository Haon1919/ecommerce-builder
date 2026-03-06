-- CreateEnum
CREATE TYPE "SubscriptionTier" AS ENUM ('STARTER', 'GROWTH', 'ENTERPRISE');

-- AlterTable
ALTER TABLE "PriceList" ADD COLUMN     "prices" JSONB NOT NULL DEFAULT '{}';

-- AlterTable
ALTER TABLE "Store" ADD COLUMN     "tier" "SubscriptionTier" NOT NULL DEFAULT 'STARTER';
