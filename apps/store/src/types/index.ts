export interface PageComponent {
  id: string;
  type: string;
  order: number;
  props: Record<string, unknown>;
}

export interface StoreInfo {
  id: string;
  slug: string;
  name: string;
  description?: string;
  logoUrl?: string;
  theme: 'TAILWIND' | 'BOOTSTRAP' | 'BULMA' | 'PICO';
  primaryColor: string;
  gaId?: string;
  tier: 'STARTER' | 'GROWTH' | 'ENTERPRISE';
  settings?: {
    currency: string;
    taxRate: number;
    flatShippingRate: number;
    freeShippingAbove?: number;
    stripePublicKey?: string;
    contactEmail?: string;
  };
}
