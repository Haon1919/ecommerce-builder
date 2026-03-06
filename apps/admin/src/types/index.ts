export interface Store {
  id: string;
  slug: string;
  name: string;
  description?: string;
  logoUrl?: string;
  theme: 'TAILWIND' | 'BOOTSTRAP' | 'BULMA' | 'PICO';
  primaryColor: string;
  configured: boolean;
  gaId?: string;
  customDomain?: string | null;
  tier: 'STARTER' | 'GROWTH' | 'ENTERPRISE';
  settings?: StoreSettings;
}

export interface StoreSettings {
  contactEmail?: string;
  currency: string;
  taxRate: number;
  flatShippingRate: number;
  freeShippingAbove?: number;
  stripePublicKey?: string;
  shippingPolicy?: string;
  returnPolicy?: string;
  aboutText?: string;
  supplierWebhookUrls?: string[];
}

export interface User {
  id: string;
  email: string;
  name: string;
  role: 'OWNER' | 'ADMIN' | 'VIEWER';
  storeId?: string;
  store?: Store;
}

export interface AuthState {
  token: string | null;
  user: User | null;
  store: Store | null;
  isLoading: boolean;
}

// ==================== PAGE BUILDER ====================

export type ComponentType =
  | 'HeroSection' | 'Banner' | 'Testimonial' | 'FAQ'
  | 'Heading' | 'Text' | 'Image' | 'Video' | 'Icon' | 'Divider' | 'Spacer'
  | 'ProductGrid' | 'FeaturedProducts' | 'ProductCarousel'
  | 'Button' | 'ContactForm' | 'NewsletterForm'
  | 'Navbar' | 'Footer' | 'Breadcrumb'
  | 'Section' | 'TwoColumns' | 'ThreeColumns';

export interface PageComponent {
  id: string;
  type: ComponentType;
  order: number;
  props: Record<string, unknown>;
}

export interface Page {
  id: string;
  slug: string;
  title: string;
  type: string;
  layout: PageComponent[];
  published: boolean;
  updatedAt: string;
}

// ==================== PRODUCTS ====================

export interface Product {
  id: string;
  sku?: string;
  name: string;
  description?: string;
  price: number;
  comparePrice?: number;
  stock: number;
  trackStock: boolean;
  category?: string;
  tags: string[];
  images: string[];
  variants?: ProductVariant[];
  modelUrl?: string;
  arEnabled?: boolean;
  active: boolean;
  featured: boolean;
  createdAt: string;
}

export interface ProductVariant {
  name: string;
  options: string[];
}

// ==================== ORDERS ====================

export interface Order {
  id: string;
  orderNumber: string;
  status: 'PENDING' | 'CONFIRMED' | 'PROCESSING' | 'SHIPPED' | 'DELIVERED' | 'CANCELLED' | 'REFUNDED';
  customerEmail: string;
  customerName: string;
  customerPhone?: string;
  shippingAddress: ShippingAddress;
  subtotal: number;
  tax: number;
  shipping: number;
  total: number;
  trackingNumber?: string;
  items: OrderItem[];
  createdAt: string;
}

export interface ShippingAddress {
  line1: string;
  line2?: string;
  city: string;
  state: string;
  zip: string;
  country: string;
}

export interface OrderItem {
  id: string;
  productName: string;
  quantity: number;
  price: number;
  product?: { name: string; images: string[] };
}

// ==================== MESSAGES ====================

export interface ContactMessage {
  id: string;
  name: string;
  email: string;
  subject: string;
  message: string;
  read: boolean;
  createdAt: string;
  replies: MessageReply[];
}

export interface MessageReply {
  id: string;
  body: string;
  sentAt: string;
  user: { name: string };
}

// ==================== TICKETS ====================

export interface SupportTicket {
  id: string;
  ticketNumber: string;
  title: string;
  description: string;
  status: 'OPEN' | 'IN_PROGRESS' | 'WAITING_FOR_INFO' | 'RESOLVED' | 'CLOSED';
  priority: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  category?: string;
  createdAt: string;
  comments: TicketComment[];
}

export interface TicketComment {
  id: string;
  body: string;
  internal: boolean;
  createdAt: string;
  user?: { name: string };
}

// ==================== ANALYTICS ====================

export interface AnalyticsDashboard {
  overview: {
    totalOrders: number;
    totalRevenue: number;
    pendingOrders: number;
    totalProducts: number;
    lowStockProducts: number;
    unreadMessages: number;
    openTickets: number;
    chatSessions: number;
  };
  recentOrders: Order[];
  ordersByStatus: Record<string, number>;
  revenueByDay: Array<{ date: string; revenue: number; orders: number }>;
}

// ==================== B2B WHOLESALE ====================

export interface PriceList {
  id: string;
  name: string;
  description?: string | null;
  prices: Record<string, number>;
}

export interface Company {
  id: string;
  name: string;
  taxId?: string | null;
  creditLimit: number;
  priceListId?: string | null;
  priceList?: PriceList | null;
}
