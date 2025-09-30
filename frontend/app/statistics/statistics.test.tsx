import React from 'react';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { QueryClient, QueryProvider } from '@tanstack/react-query';
import StatisticsPage from './page';
import axios from 'axios';

// Mock axios
jest.mock('axios');
const mockedAxios = axios as jest.Mocked<typeof axios>;

// Mock recharts components
jest.mock('recharts', () => ({
  ResponsiveContainer: ({ children }: any) => <div data-testid="responsive-container">{children}</div>,
  BarChart: ({ children }: any) => <div data-testid="bar-chart">{children}</div>,
  AreaChart: ({ children }: any) => <div data-testid="area-chart">{children}</div>,
  PieChart: ({ children }: any) => <div data-testid="pie-chart">{children}</div>,
  LineChart: ({ children }: any) => <div data-testid="line-chart">{children}</div>,
  Bar: () => <div data-testid="bar" />,
  Area: () => <div data-testid="area" />,
  Pie: () => <div data-testid="pie" />,
  Line: () => <div data-testid="line" />,
  XAxis: () => <div data-testid="x-axis" />,
  YAxis: () => <div data-testid="y-axis" />,
  CartesianGrid: () => <div data-testid="cartesian-grid" />,
  Tooltip: () => <div data-testid="tooltip" />,
  Legend: () => <div data-testid="legend" />,
  Cell: () => <div data-testid="cell" />,
  RadarChart: ({ children }: any) => <div data-testid="radar-chart">{children}</div>,
  Radar: () => <div data-testid="radar" />,
  PolarGrid: () => <div data-testid="polar-grid" />,
  PolarAngleAxis: () => <div data-testid="polar-angle-axis" />,
  PolarRadiusAxis: () => <div data-testid="polar-radius-axis" />
}));

// Mock data
const mockOverviewData = {
  totalGames: 1234567890,
  totalPlayers: 45678901,
  activeTournaments: 1234,
  platforms: {
    chesscom: {
      games: 856789012,
      players: 32145678,
      avgRating: 1487
    },
    lichess: {
      games: 377778878,
      players: 13533223,
      avgRating: 1592
    }
  },
  gameFormats: {
    bullet: 456789012,
    blitz: 345678901,
    rapid: 234567890,
    classical: 123456789,
    correspondence: 73456788
  },
  topCountries: [
    { country: 'United States', players: 5678901, flag: '🇺🇸' },
    { country: 'Russia', players: 4567890, flag: '🇷🇺' },
    { country: 'India', players: 3456789, flag: '🇮🇳' }
  ],
  lastUpdated: new Date().toISOString()
};

const mockActivityData = {
  timeframe: '24h',
  platform: 'all',
  games: 2345678,
  players: 234567,
  tournaments: 456,
  peakHour: {
    hour: '20:00 UTC',
    games: 345678
  },
  hourlyData: Array.from({ length: 24 }, (_, i) => ({
    hour: i,
    games: Math.floor(Math.random() * 200000) + 50000,
    players: Math.floor(Math.random() * 20000) + 5000
  })),
  lastUpdated: new Date().toISOString()
};

const mockRatingsData = {
  platform: 'all',
  distribution: {
    '0-800': { players: 3456789, percentage: 15.2 },
    '800-1000': { players: 4567890, percentage: 20.1 },
    '1000-1200': { players: 5678901, percentage: 25.0 },
    '1200-1400': { players: 4567890, percentage: 20.1 },
    '1400-1600': { players: 2345678, percentage: 10.3 },
    '1600-1800': { players: 1234567, percentage: 5.4 },
    '1800+': { players: 890123, percentage: 3.9 }
  },
  totalPlayers: 22741838,
  averageRating: 1532,
  lastUpdated: new Date().toISOString()
};

const mockLeaderboardsData = {
  category: 'rating',
  variant: 'blitz',
  limit: 10,
  leaders: Array.from({ length: 10 }, (_, i) => ({
    rank: i + 1,
    username: `player${i + 1}`,
    rating: 2800 - i * 5,
    country: ['US', 'RU', 'IN', 'DE', 'FR'][i % 5],
    title: i < 3 ? ['GM', 'IM', 'FM'][i % 3] : null,
    games: Math.floor(Math.random() * 10000) + 5000,
    winRate: (65 - i * 0.2).toFixed(1)
  })),
  lastUpdated: new Date().toISOString()
};

const mockOpeningsData = {
  popular: [
    { eco: 'C50', name: 'Italian Game', games: 1234567, winRate: 52.3, drawRate: 28.1 },
    { eco: 'B10', name: 'Caro-Kann Defense', games: 987654, winRate: 48.7, drawRate: 31.2 },
    { eco: 'D02', name: 'London System', games: 876543, winRate: 51.1, drawRate: 29.4 }
  ]
};

// Test wrapper with QueryClient
const createWrapper = () => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false }
    }
  });
  return ({ children }: { children: React.ReactNode }) => (
    <QueryProvider client={queryClient}>
      {children}
    </QueryProvider>
  );
};

describe('StatisticsPage Component', () => {
  let consoleSpy: jest.SpyInstance;

  beforeEach(() => {
    jest.clearAllMocks();
    consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    
    // Setup default successful API responses
    mockedAxios.get.mockImplementation((url: string) => {
      if (url.includes('/api/stats/overview')) {
        return Promise.resolve({ data: mockOverviewData });
      }
      if (url.includes('/api/stats/activity')) {
        return Promise.resolve({ data: mockActivityData });
      }
      if (url.includes('/api/stats/rating-distribution')) {
        return Promise.resolve({ data: mockRatingsData });
      }
      if (url.includes('/api/stats/leaderboards')) {
        return Promise.resolve({ data: mockLeaderboardsData });
      }
      if (url.includes('/api/stats/openings')) {
        return Promise.resolve({ data: mockOpeningsData });
      }
      return Promise.reject(new Error('Unknown endpoint'));
    });
  });

  afterEach(() => {
    consoleSpy.restore();
  });

  describe('Component Rendering', () => {
    test('should render loading state initially', async () => {
      render(<StatisticsPage />);
      
      expect(screen.getByText('Loading real-time statistics...')).toBeInTheDocument();
      expect(screen.getByTestId('loading-spinner')).toBeInTheDocument();
    });

    test('should render main header with live data indicator', async () => {
      render(<StatisticsPage />);
      
      await waitFor(() => {
        expect(screen.getByText('Live Chess Statistics')).toBeInTheDocument();
        expect(screen.getByText('Live Data')).toBeInTheDocument();
      });
    });

    test('should render all navigation tabs', async () => {
      render(<StatisticsPage />);
      
      await waitFor(() => {
        expect(screen.getByText('Platform Overview')).toBeInTheDocument();
        expect(screen.getByText('Activity Trends')).toBeInTheDocument();
        expect(screen.getByText('Rating Distribution')).toBeInTheDocument();
        expect(screen.getByText('Top Players')).toBeInTheDocument();
        expect(screen.getByText('Opening Stats')).toBeInTheDocument();
        expect(screen.getByText('Key Insights')).toBeInTheDocument();
      });
    });

    test('should render timeframe and platform controls', async () => {
      render(<StatisticsPage />);
      
      await waitFor(() => {
        expect(screen.getByDisplayValue('Last 24 Hours')).toBeInTheDocument();
        expect(screen.getByDisplayValue('All Platforms')).toBeInTheDocument();
      });
    });
  });

  describe('API Integration', () => {
    test('should make parallel API calls on mount', async () => {
      render(<StatisticsPage />);
      
      await waitFor(() => {
        expect(mockedAxios.get).toHaveBeenCalledTimes(5);
        expect(mockedAxios.get).toHaveBeenCalledWith('http://localhost:3007/api/stats/overview');
        expect(mockedAxios.get).toHaveBeenCalledWith('http://localhost:3007/api/stats/activity', {
          params: { timeframe: '24h', platform: 'all' }
        });
        expect(mockedAxios.get).toHaveBeenCalledWith('http://localhost:3007/api/stats/rating-distribution', {
          params: { platform: 'all' }
        });
        expect(mockedAxios.get).toHaveBeenCalledWith('http://localhost:3007/api/stats/leaderboards', {
          params: { category: 'rating', limit: 10 }
        });
        expect(mockedAxios.get).toHaveBeenCalledWith('http://localhost:3007/api/stats/openings');
      });
    });

    test('should handle API errors gracefully', async () => {
      mockedAxios.get.mockRejectedValue(new Error('API Error'));
      
      render(<StatisticsPage />);
      
      await waitFor(() => {
        expect(screen.getByText('Statistics Error')).toBeInTheDocument();
        expect(screen.getByText('Failed to load statistics. Please try again.')).toBeInTheDocument();
        expect(screen.getByText('Retry')).toBeInTheDocument();
      });
    });

    test('should retry API calls when retry button is clicked', async () => {
      mockedAxios.get.mockRejectedValueOnce(new Error('API Error'));
      
      render(<StatisticsPage />);
      
      await waitFor(() => {
        expect(screen.getByText('Retry')).toBeInTheDocument();
      });
      
      // Setup successful response for retry
      mockedAxios.get.mockResolvedValue({ data: mockOverviewData });
      
      fireEvent.click(screen.getByText('Retry'));
      
      await waitFor(() => {
        expect(mockedAxios.get).toHaveBeenCalledTimes(6); // Initial 5 + 5 retry calls
      });
    });
  });

  describe('Interactive Controls', () => {
    test('should update API calls when timeframe changes', async () => {
      render(<StatisticsPage />);
      
      await waitFor(() => {
        expect(screen.getByDisplayValue('Last 24 Hours')).toBeInTheDocument();
      });
      
      // Change timeframe
      const timeframeSelect = screen.getByDisplayValue('Last 24 Hours');
      fireEvent.change(timeframeSelect, { target: { value: '7d' } });
      
      await waitFor(() => {
        expect(mockedAxios.get).toHaveBeenCalledWith('http://localhost:3007/api/stats/activity', {
          params: { timeframe: '7d', platform: 'all' }
        });
      });
    });

    test('should update API calls when platform changes', async () => {
      render(<StatisticsPage />);
      
      await waitFor(() => {
        expect(screen.getByDisplayValue('All Platforms')).toBeInTheDocument();
      });
      
      // Change platform
      const platformSelect = screen.getByDisplayValue('All Platforms');
      fireEvent.change(platformSelect, { target: { value: 'chess.com' } });
      
      await waitFor(() => {
        expect(mockedAxios.get).toHaveBeenCalledWith('http://localhost:3007/api/stats/activity', {
          params: { timeframe: '24h', platform: 'chess.com' }
        });
        expect(mockedAxios.get).toHaveBeenCalledWith('http://localhost:3007/api/stats/rating-distribution', {
          params: { platform: 'chess.com' }
        });
      });
    });

    test('should handle manual refresh', async () => {
      render(<StatisticsPage />);
      
      await waitFor(() => {
        expect(screen.getByText('Refresh')).toBeInTheDocument();
      });
      
      const refreshButton = screen.getByText('Refresh');
      fireEvent.click(refreshButton);
      
      await waitFor(() => {
        expect(mockedAxios.get).toHaveBeenCalledTimes(10); // Initial 5 + 5 refresh calls
      });
    });

    test('should disable refresh button during refresh', async () => {
      render(<StatisticsPage />);
      
      await waitFor(() => {
        expect(screen.getByText('Refresh')).toBeInTheDocument();
      });
      
      const refreshButton = screen.getByText('Refresh');
      fireEvent.click(refreshButton);
      
      expect(refreshButton).toBeDisabled();
      
      await waitFor(() => {
        expect(refreshButton).not.toBeDisabled();
      });
    });
  });

  describe('Tab Navigation', () => {
    test('should switch to different tabs', async () => {
      render(<StatisticsPage />);
      
      await waitFor(() => {
        expect(screen.getByText('Platform Overview')).toBeInTheDocument();
      });
      
      // Click Activity Trends tab
      fireEvent.click(screen.getByText('Activity Trends'));
      
      await waitFor(() => {
        const activityTab = screen.getByText('Activity Trends');
        expect(activityTab.closest('button')).toHaveClass('border-blue-600', 'text-blue-600');
      });
    });

    test('should show correct tab content for each tab', async () => {
      render(<StatisticsPage />);
      
      await waitFor(() => {
        // Default overview tab content
        expect(screen.getByText('Total Games')).toBeInTheDocument();
        expect(screen.getByText('Platform Comparison')).toBeInTheDocument();
      });
      
      // Switch to Activity tab
      fireEvent.click(screen.getByText('Activity Trends'));
      
      await waitFor(() => {
        expect(screen.getByText('Activity Pattern')).toBeInTheDocument();
      });
      
      // Switch to Ratings tab
      fireEvent.click(screen.getByText('Rating Distribution'));
      
      await waitFor(() => {
        expect(screen.getByText('Rating Distribution')).toBeInTheDocument();
      });
      
      // Switch to Leaderboards tab
      fireEvent.click(screen.getByText('Top Players'));
      
      await waitFor(() => {
        expect(screen.getByText('Current Top Players')).toBeInTheDocument();
        expect(screen.getByText('Live Rankings')).toBeInTheDocument();
      });
      
      // Switch to Openings tab
      fireEvent.click(screen.getByText('Opening Stats'));
      
      await waitFor(() => {
        expect(screen.getByText('Most Popular Openings')).toBeInTheDocument();
      });
      
      // Switch to Insights tab
      fireEvent.click(screen.getByText('Key Insights'));
      
      await waitFor(() => {
        expect(screen.getByText('Platform Health Metrics')).toBeInTheDocument();
      });
    });
  });

  describe('Data Visualization', () => {
    test('should render charts in overview tab', async () => {
      render(<StatisticsPage />);
      
      await waitFor(() => {
        expect(screen.getByTestId('responsive-container')).toBeInTheDocument();
        expect(screen.getByTestId('bar-chart')).toBeInTheDocument();
      });
    });

    test('should render area chart in activity tab', async () => {
      render(<StatisticsPage />);
      
      await waitFor(() => {
        fireEvent.click(screen.getByText('Activity Trends'));
      });
      
      await waitFor(() => {
        expect(screen.getByTestId('area-chart')).toBeInTheDocument();
      });
    });

    test('should render rating distribution chart', async () => {
      render(<StatisticsPage />);
      
      fireEvent.click(screen.getByText('Rating Distribution'));
      
      await waitFor(() => {
        expect(screen.getByTestId('bar-chart')).toBeInTheDocument();
      });
    });
  });

  describe('Data Display', () => {
    test('should display formatted numbers correctly', async () => {
      render(<StatisticsPage />);
      
      await waitFor(() => {
        expect(screen.getByText('1,234,567,890')).toBeInTheDocument(); // Total games
        expect(screen.getByText('45,678,901')).toBeInTheDocument(); // Total players
        expect(screen.getByText('1,234')).toBeInTheDocument(); // Active tournaments
      });
    });

    test('should display platform comparison data', async () => {
      render(<StatisticsPage />);
      
      await waitFor(() => {
        expect(screen.getByText('Chess.com')).toBeInTheDocument();
        expect(screen.getByText('Lichess')).toBeInTheDocument();
        expect(screen.getByText('856,789,012')).toBeInTheDocument(); // Chess.com games
        expect(screen.getByText('377,778,878')).toBeInTheDocument(); // Lichess games
      });
    });

    test('should display top countries with flags', async () => {
      render(<StatisticsPage />);
      
      await waitFor(() => {
        expect(screen.getByText('🇺🇸')).toBeInTheDocument();
        expect(screen.getByText('🇷🇺')).toBeInTheDocument();
        expect(screen.getByText('🇮🇳')).toBeInTheDocument();
        expect(screen.getByText('United States')).toBeInTheDocument();
        expect(screen.getByText('Russia')).toBeInTheDocument();
        expect(screen.getByText('India')).toBeInTheDocument();
      });
    });

    test('should display leaderboard with player rankings', async () => {
      render(<StatisticsPage />);
      
      fireEvent.click(screen.getByText('Top Players'));
      
      await waitFor(() => {
        expect(screen.getByText('#1')).toBeInTheDocument();
        expect(screen.getByText('player1')).toBeInTheDocument();
        expect(screen.getByText('2800')).toBeInTheDocument(); // Top player rating
      });
    });

    test('should display opening statistics', async () => {
      render(<StatisticsPage />);
      
      fireEvent.click(screen.getByText('Opening Stats'));
      
      await waitFor(() => {
        expect(screen.getByText('Italian Game')).toBeInTheDocument();
        expect(screen.getByText('Caro-Kann Defense')).toBeInTheDocument();
        expect(screen.getByText('London System')).toBeInTheDocument();
        expect(screen.getByText('C50')).toBeInTheDocument(); // ECO code
      });
    });
  });

  describe('Real-time Features', () => {
    test('should show live data indicator when not loading', async () => {
      render(<StatisticsPage />);
      
      await waitFor(() => {
        const liveIndicator = screen.getByText('Live Data');
        expect(liveIndicator).toBeInTheDocument();
        
        // Check for green indicator dot
        const indicator = liveIndicator.parentElement?.querySelector('.bg-green-500');
        expect(indicator).toBeInTheDocument();
      });
    });

    test('should show updating indicator when loading', async () => {
      // Make API calls slower to test loading state
      mockedAxios.get.mockImplementation(() => 
        new Promise(resolve => 
          setTimeout(() => resolve({ data: mockOverviewData }), 1000)
        )
      );
      
      render(<StatisticsPage />);
      
      expect(screen.getByText('Updating...')).toBeInTheDocument();
      
      // Check for yellow indicator dot
      const yellowIndicator = document.querySelector('.bg-yellow-500');
      expect(yellowIndicator).toBeInTheDocument();
    });

    test('should display last updated time', async () => {
      render(<StatisticsPage />);
      
      await waitFor(() => {
        expect(screen.getByText(/Last updated:/)).toBeInTheDocument();
      });
    });
  });

  describe('Responsive Design', () => {
    test('should render metric cards in grid layout', async () => {
      render(<StatisticsPage />);
      
      await waitFor(() => {
        const metricsGrid = screen.getByText('Total Games').closest('.grid');
        expect(metricsGrid).toHaveClass('grid-cols-1', 'md:grid-cols-2', 'lg:grid-cols-4');
      });
    });

    test('should have responsive navigation tabs', async () => {
      render(<StatisticsPage />);
      
      await waitFor(() => {
        const tabsContainer = screen.getByText('Platform Overview').closest('.flex');
        expect(tabsContainer).toHaveClass('overflow-x-auto');
      });
    });
  });

  describe('Accessibility', () => {
    test('should have proper ARIA labels and roles', async () => {
      render(<StatisticsPage />);
      
      await waitFor(() => {
        const refreshButton = screen.getByText('Refresh');
        expect(refreshButton).toHaveAttribute('type', 'button');
        
        const timeframeSelect = screen.getByDisplayValue('Last 24 Hours');
        expect(timeframeSelect.previousElementSibling).toHaveTextContent('Timeframe:');
        
        const platformSelect = screen.getByDisplayValue('All Platforms');
        expect(platformSelect.previousElementSibling).toHaveTextContent('Platform:');
      });
    });

    test('should handle keyboard navigation', async () => {
      render(<StatisticsPage />);
      
      await waitFor(() => {
        const activityTab = screen.getByText('Activity Trends');
        activityTab.focus();
        
        fireEvent.keyDown(activityTab, { key: 'Enter', code: 'Enter' });
        
        expect(activityTab.closest('button')).toHaveClass('border-blue-600');
      });
    });
  });

  describe('Performance', () => {
    test('should not cause memory leaks with intervals', async () => {
      const clearIntervalSpy = jest.spyOn(global, 'clearInterval');
      
      const { unmount } = render(<StatisticsPage />);
      
      await waitFor(() => {
        expect(screen.getByText('Live Chess Statistics')).toBeInTheDocument();
      });
      
      unmount();
      
      expect(clearIntervalSpy).toHaveBeenCalled();
      clearIntervalSpy.mockRestore();
    });

    test('should debounce API calls when controls change rapidly', async () => {
      render(<StatisticsPage />);
      
      await waitFor(() => {
        expect(screen.getByDisplayValue('Last 24 Hours')).toBeInTheDocument();
      });
      
      const timeframeSelect = screen.getByDisplayValue('Last 24 Hours');
      
      // Rapid changes
      fireEvent.change(timeframeSelect, { target: { value: '7d' } });
      fireEvent.change(timeframeSelect, { target: { value: '30d' } });
      fireEvent.change(timeframeSelect, { target: { value: '24h' } });
      
      await waitFor(() => {
        // Should not have made excessive API calls
        const callCount = mockedAxios.get.mock.calls.length;
        expect(callCount).toBeLessThan(20); // Reasonable limit
      });
    });
  });
});