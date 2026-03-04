// Learn more: https://github.com/testing-library/jest-dom
import '@testing-library/jest-dom'

// Mock ResizeObserver for recharts
global.ResizeObserver = jest.fn().mockImplementation(() => ({
  observe: jest.fn(),
  unobserve: jest.fn(),
  disconnect: jest.fn(),
}));
