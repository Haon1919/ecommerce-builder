import winston from 'winston';
import { config } from '../config';

const { combine, timestamp, errors, json, colorize, printf } = winston.format;

const devFormat = printf(({ level, message, timestamp: ts, ...meta }) => {
  const metaStr = Object.keys(meta).length ? ` ${JSON.stringify(meta)}` : '';
  return `${ts} [${level.toUpperCase()}] ${message}${metaStr}`;
});

export const logger = winston.createLogger({
  level: config.logging.level,
  format: config.logging.structured
    ? combine(timestamp(), errors({ stack: true }), json())
    : combine(timestamp({ format: 'HH:mm:ss' }), colorize(), errors({ stack: true }), devFormat),
  transports: [new winston.transports.Console()],
  exitOnError: false,
});

// Stream interface for Morgan
export const morganStream = {
  write: (message: string) => {
    logger.http(message.trim());
  },
};

// Helper to create child logger with store context
export const storeLogger = (storeId: string) =>
  logger.child({ storeId });
