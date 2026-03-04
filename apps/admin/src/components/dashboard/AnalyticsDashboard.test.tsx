import { render, screen } from '@testing-library/react';
import { AnalyticsDashboard } from './AnalyticsDashboard';
import type { AnalyticsDashboard as DashboardData } from '@/types';

// Mock the entire recharts library
jest.mock('recharts', () => {
  const OriginalModule = jest.requireActual('recharts');
  return {
    ...OriginalModule,
    ResponsiveContainer: ({ children }: { children: React.ReactNode }) => (
      <div data-testid="recharts-container">{children}</div>
    ),
    LineChart: ({ children }: { children: React.ReactNode }) => <div data-testid="line-chart">{children}</div>,
    BarChart: ({ children }: { children: React.ReactNode }) => <div data-testid="bar-chart">{children}</div>,
    PieChart: ({ children }: { children: React.ReactNode }) => <div data-testid="pie-chart">{children}</div>,
    Line: () => null,
    Bar: () => null,
    Pie: () => null,
    XAxis: () => null,
    YAxis: () => null,
    CartesianGrid: () => null,
    Tooltip: () => null,
    Cell: () => null,
  };
});

const sampleAnalyticsData: DashboardData = {
  overview: {
    totalRevenue: 12345.67,
    totalOrders: 150,
    pendingOrders: 12,
    totalProducts: 85,
    lowStockProducts: 5,
    unreadMessages: 8,
    chatSessions: 25,
  },
  revenueByDay: [
    { date: '2024-01-01', revenue: 500, orders: 10 },
    { date: '2024-01-02', revenue: 750, orders: 15 },
  ],
  ordersByStatus: {
    PENDING: 12,
    SHIPPED: 100,
    DELIVERED: 38,
  },
  recentOrders: [
    {
      id: 'order-1',
      orderNumber: 'ORD-2024-00150',
      total: 89.99,
      status: 'DELIVERED',
      items: [{ productName: 'Product A' }, { productName: 'Product B' }],
    },
    {
      id: 'order-2',
      orderNumber: 'ORD-2024-00149',
      total: 42.50,
      status: 'PENDING',
      items: [{ productName: 'Product C' }],
    },
  ],
};

describe('AnalyticsDashboard', () => {
  it('should render loading skeletons when isLoading is true', () => {
    render(<AnalyticsDashboard isLoading={true} />);
    const skeletons = screen.getAllByRole('generic', { name: '' });
    // A simple check for multiple pulse animations
    expect(skeletons.filter(el => el.classList.contains('animate-pulse')).length).toBeGreaterThan(0);
  });

  it('should render null if not loading and no data is provided', () => {
    const { container } = render(<AnalyticsDashboard isLoading={false} data={undefined} />);
    expect(container.firstChild).toBeNull();
  });

  it('should render metric cards with correct data', () => {
    render(<AnalyticsDashboard isLoading={false} data={sampleAnalyticsData} />);
    
    // Check for formatted revenue
    expect(screen.getByText('$12,345.67')).toBeInTheDocument();
    // Check for total orders
    expect(screen.getByText('150')).toBeInTheDocument();
    // Check for low stock warning
    expect(screen.getByText('5 low stock')).toBeInTheDocument();
    // Check for unread messages
    expect(screen.getByText('8')).toBeInTheDocument();
  });

  it('should render chart titles', () => {
    render(<AnalyticsDashboard isLoading={false} data={sampleAnalyticsData} />);
    
    expect(screen.getByText('Revenue Over Time')).toBeInTheDocument();
    expect(screen.getByText('Orders by Status')).toBeInTheDocument();
    expect(screen.getByText('Orders Per Day')).toBeInTheDocument();
  });

  it('should render recent orders', () => {
    render(<AnalyticsDashboard isLoading={false} data={sampleAnalyticsData} />);

    expect(screen.getByText('ORD-2024-00150')).toBeInTheDocument();
    expect(screen.getByText('Product A, Product B')).toBeInTheDocument();
    expect(screen.getByText('$89.99')).toBeInTheDocument();

    expect(screen.getByText('ORD-2024-00149')).toBeInTheDocument();
    expect(screen.getByText('Product C')).toBeInTheDocument();
    expect(screen.getByText('$42.50')).toBeInTheDocument();
  });

  it('should show an urgent ring on cards when conditions are met', () => {
    render(<AnalyticsDashboard isLoading={false} data={sampleAnalyticsData} />);
    
    // Total Orders card should be urgent because pendingOrders > 10
    const totalOrdersCard = screen.getByText('Total Orders').closest('.card');
    expect(totalOrdersCard).toHaveClass('ring-2');

    // Products card should be urgent because lowStockProducts > 0
    const productsCard = screen.getByText('Products').closest('.card');
    expect(productsCard).toHaveClass('ring-2');

    // Unread Messages card should be urgent because unreadMessages > 0
    const messagesCard = screen.getByText('Unread Messages').closest('.card');
    expect(messagesCard).toHaveClass('ring-2');

    // Revenue card should not be urgent
    const revenueCard = screen.getByText('Total Revenue').closest('.card');
    expect(revenueCard).not.toHaveClass('ring-2');
  });
});
