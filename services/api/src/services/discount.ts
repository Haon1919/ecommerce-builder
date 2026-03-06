import { Prisma } from '@prisma/client';
import { prisma } from '../db';

export interface CartItem {
    productId: string;
    quantity: number;
    price: number;
}

export interface Cart {
    items: CartItem[];
    subtotal: number;
}

export interface AppliedDiscount {
    ruleId: string;
    code: string | null;
    amount: number;
    description: string;
    affectedProductId?: string; // For item-specific discounts like BOGO
}

export class DiscountService {
    /**
     * Evaluates all applicable discounts for a cart and returns the best combination.
     * If overlapping non-combinable rules exist, the rule providing the highest total discount is selected.
     * Combinable rules can be stacked together.
     */
    async calculateBestDiscounts(
        storeId: string,
        cart: Cart,
        userTags: string[] = [],
        providedCodes: string[] = []
    ): Promise<AppliedDiscount[]> {
        const now = new Date();
        const rules = await prisma.discountRule.findMany({
            where: {
                storeId,
                active: true,
                OR: [
                    { startDate: null },
                    { startDate: { lte: now } }
                ],
                AND: [
                    { OR: [{ endDate: null }, { endDate: { gte: now } }] }
                ]
            },
            include: {
                conditions: true
            },
            orderBy: {
                priority: 'desc'
            }
        });

        const applicableRules = rules.filter(rule => {
            if (rule.code && !providedCodes.includes(rule.code)) return false;
            return this.evaluateConditions(rule, cart, userTags);
        });

        // Calculate possible discount for each rule
        const ruleDiscounts = applicableRules.map(rule => {
            const calculation = this.calculateDiscountAmount(rule, cart);
            return {
                rule,
                amount: calculation.amount,
                affectedProductId: calculation.affectedProductId
            };
        }).filter(rd => rd.amount > 0);

        if (ruleDiscounts.length === 0) return [];

        // Strategy for optimal discount:
        // Option 1: All combinable rules stacked together.
        // Option 2...N: Each non-combinable rule individually.

        // We compare Option 1 against each separate Option in N.
        // Winner is the one that provides the maximum total discount.

        const combinableRules = ruleDiscounts.filter(rd => rd.rule.combinable);
        const nonCombinableRules = ruleDiscounts.filter(rd => !rd.rule.combinable);

        const totalCombinableAmount = combinableRules.reduce((sum, rd) => sum.add(rd.amount), new Prisma.Decimal(0));

        let bestNonCombinable = nonCombinableRules.length > 0
            ? nonCombinableRules.reduce((prev, curr) => (curr.amount > prev.amount) ? curr : prev)
            : null;

        if (bestNonCombinable && new Prisma.Decimal(bestNonCombinable.amount).gt(totalCombinableAmount)) {
            return [{
                ruleId: bestNonCombinable.rule.id,
                code: bestNonCombinable.rule.code,
                amount: bestNonCombinable.amount,
                description: bestNonCombinable.rule.description || `Discount ${bestNonCombinable.rule.id}`,
                affectedProductId: bestNonCombinable.affectedProductId
            }];
        }

        return combinableRules.map(rd => ({
            ruleId: rd.rule.id,
            code: rd.rule.code,
            amount: rd.amount,
            description: rd.rule.description || `Discount ${rd.rule.id}`,
            affectedProductId: rd.affectedProductId
        }));
    }

    evaluateConditions(rule: any, cart: Cart, userTags: string[]): boolean {
        if (!rule.conditions || rule.conditions.length === 0) return true;

        for (const condition of rule.conditions) {
            if (condition.type === 'MIN_CART_VALUE') {
                const minValue = new Prisma.Decimal(condition.value);
                if (new Prisma.Decimal(cart.subtotal).lt(minValue)) return false;
            }
            if (condition.type === 'CUSTOMER_TAG') {
                if (!userTags.includes(condition.value)) return false;
            }
        }
        return true;
    }

    calculateDiscountAmount(rule: any, cart: Cart): { amount: number, affectedProductId?: string } {
        switch (rule.type) {
            case 'PERCENTAGE': {
                const percentage = new Prisma.Decimal(rule.value.toString());
                const amount = new Prisma.Decimal(cart.subtotal).mul(percentage.div(100)).toDecimalPlaces(2).toNumber();
                return { amount };
            }
            case 'FIXED_AMOUNT': {
                const fixedValue = new Prisma.Decimal(rule.value.toString());
                const amount = Prisma.Decimal.min(fixedValue, new Prisma.Decimal(cart.subtotal)).toDecimalPlaces(2).toNumber();
                return { amount };
            }
            case 'BUY_X_GET_Y':
                return this.calculateBuyXGetY(rule, cart);
            default:
                return { amount: 0 };
        }
    }

    private calculateBuyXGetY(rule: any, cart: Cart): { amount: number, affectedProductId?: string } {
        const { buyQuantity, getQuantity, buyProductId, getProductId } = rule;
        if (!buyQuantity || !getQuantity || !buyProductId || !getProductId) return { amount: 0 };

        const buyItem = cart.items.find(i => i.productId === buyProductId);
        const getItem = cart.items.find(i => i.productId === getProductId);

        if (!buyItem) return { amount: 0 };

        if (buyProductId === getProductId) {
            // Logic for same item: e.g. Buy 2 Get 1 Free (3 total items, 1 is free)
            const perGroup = buyQuantity + getQuantity;
            const numGroups = Math.floor(buyItem.quantity / perGroup);
            const freeItems = numGroups * getQuantity;
            const amount = new Prisma.Decimal(freeItems).mul(buyItem.price).toDecimalPlaces(2).toNumber();
            return { amount, affectedProductId: getProductId };
        } else {
            // Logic for different items: Buy X of A, Get Y of B free
            if (!getItem) return { amount: 0 };
            const numSets = Math.floor(buyItem.quantity / buyQuantity);
            const freeItemsPossible = numSets * getQuantity;
            const freeItemsActual = Math.min(freeItemsPossible, getItem.quantity);
            const amount = new Prisma.Decimal(freeItemsActual).mul(getItem.price).toDecimalPlaces(2).toNumber();
            return { amount, affectedProductId: getProductId };
        }
    }
}

export const discountService = new DiscountService();
