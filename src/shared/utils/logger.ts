/**
 * Structured Logging Utility
 *
 * Provides consistent, structured logging across the application
 * Includes request tracking, user context, and error details
 */

import { v4 as uuidv4 } from 'uuid';

export interface LogContext {
  requestId?: string;
  userId?: string;
  sessionId?: string;
  ip?: string;
  userAgent?: string;
  method?: string;
  url?: string;
  statusCode?: number;
  duration?: number;
  [key: string]: any;
}

export class Logger {
  private static instance: Logger;
  private requestId: string;

  constructor() {
    this.requestId = uuidv4();
  }

  static getInstance(): Logger {
    if (!Logger.instance) {
      Logger.instance = new Logger();
    }
    return Logger.instance;
  }

  /**
   * Generate a new request ID
   */
  generateRequestId(): string {
    return uuidv4();
  }

  /**
   * Log an info message
   */
  info(message: string, context?: LogContext): void {
    this.log('info', message, context);
  }

  /**
   * Log a warning message
   */
  warn(message: string, context?: LogContext): void {
    this.log('warn', message, context);
  }

  /**
   * Log an error message
   */
  error(message: string, error?: Error, context?: LogContext): void {
    const errorContext = {
      ...context,
      error: error ? {
        name: error.name,
        message: error.message,
        stack: error.stack
      } : undefined
    };
    this.log('error', message, errorContext);
  }

  /**
   * Log a debug message (only in development)
   */
  debug(message: string, context?: LogContext): void {
    if (process.env.NODE_ENV === 'development') {
      this.log('debug', message, context);
    }
  }

  /**
   * Log an HTTP request
   */
  httpRequest(method: string, url: string, statusCode: number, duration: number, context?: LogContext): void {
    const level = statusCode >= 400 ? 'warn' : 'info';
    this.log(level, `HTTP ${method} ${url}`, {
      ...context,
      method,
      url,
      statusCode,
      duration
    });
  }

  /**
   * Log a database operation
   */
  database(operation: string, table: string, duration?: number, context?: LogContext): void {
    this.log('debug', `DB ${operation} on ${table}`, {
      ...context,
      operation,
      table,
      duration
    });
  }

  /**
   * Log a Stripe operation
   */
  stripe(operation: string, resourceId?: string, context?: LogContext): void {
    this.log('info', `Stripe ${operation}`, {
      ...context,
      operation,
      resourceId
    });
  }

  /**
   * Log a file upload/download operation
   */
  file(operation: string, fileName: string, fileSize?: number, context?: LogContext): void {
    this.log('info', `File ${operation}: ${fileName}`, {
      ...context,
      operation,
      fileName,
      fileSize
    });
  }

  /**
   * Core logging method
   */
  private log(level: string, message: string, context?: LogContext): void {
    const timestamp = new Date().toISOString();
    const logEntry = {
      timestamp,
      level,
      message,
      ...context
    };

    // In production, you might want to use a proper logging service
    // For now, we'll use console with structured output
    if (process.env.NODE_ENV === 'production') {
      // Structured JSON logging for production
      console.log(JSON.stringify(logEntry));
    } else {
      // Human-readable logging for development
      const contextStr = context ? ` ${JSON.stringify(context, null, 2)}` : '';
      console.log(`[${timestamp}] ${level.toUpperCase()}: ${message}${contextStr}`);
    }
  }
}

// Export singleton instance
export const logger = Logger.getInstance();