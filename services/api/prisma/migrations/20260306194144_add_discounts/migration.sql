-- AlterTable
ALTER TABLE "Order" ADD COLUMN     "appliedDiscounts" JSONB,
ADD COLUMN     "totalDiscount" DECIMAL(10,2) NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "OrderItem" ADD COLUMN     "discountAmount" DECIMAL(10,2) NOT NULL DEFAULT 0,
ADD COLUMN     "discountRuleId" TEXT;
