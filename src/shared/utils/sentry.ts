/**
 * Sentry Configuration
 *
 * Error monitoring and performance tracking for production
 */

import * as Sentry from '@sentry/node';
import { nodeProfilingIntegration } from '@sentry/profiling-node';
import { Request, Response, NextFunction } from 'express';

const SENTRY_DSN = process.env.SENTRY_DSN;
const SENTRY_ENVIRONMENT = process.env.NODE_ENV || 'development';

export function initializeSentry() {
  if (!SENTRY_DSN) {
    console.warn('  Sentry DSN not configured. Error monitoring disabled.');
    return;
  }

  Sentry.init({
    dsn: SENTRY_DSN,
    environment: SENTRY_ENVIRONMENT,
    integrations: [
      // Add profiling integration for performance monitoring
      nodeProfilingIntegration(),
      // Add Express integration for automatic error capturing
      Sentry.expressIntegration(),
    ],

    // Performance Monitoring
    tracesSampleRate: SENTRY_ENVIRONMENT === 'production' ? 0.1 : 1.0, // 10% in production, 100% in development
    profilesSampleRate: SENTRY_ENVIRONMENT === 'production' ? 0.1 : 1.0,

    // Error Tracking
    beforeSend(event, hint) {
      // Filter out sensitive information
      if (event.request?.data) {
        // Remove sensitive fields from request data
        const sensitiveFields = ['password', 'token', 'secret', 'key'];
        const data = event.request.data as any;

        if (typeof data === 'object' && data !== null) {
          sensitiveFields.forEach(field => {
            if (data[field]) {
              data[field] = '[FILTERED]';
            }
          });
        }
      }

      return event;
    },

    // Custom error filtering
    beforeSendTransaction(event) {
      // Filter out health check transactions in production
      if (event.transaction === 'GET /api/health' && SENTRY_ENVIRONMENT === 'production') {
        return null;
      }

      return event;
    }
  });

  console.log(' Sentry initialized for error monitoring and performance tracking');
}

// Performance monitoring middleware
export function sentryPerformanceMiddleware(req: any, res: any, next: any) {
  // Record the start time
  const startTime = Date.now();

  res.on('finish', () => {
    // Calculate duration and send to Sentry
    const duration = Date.now() - startTime;

    // Only track slow requests (>1 second) to avoid noise
    if (duration > 1000) {
      Sentry.withScope(scope => {
        scope.setTag('method', req.method);
        scope.setTag('url', req.url);
        scope.setTag('status_code', res.statusCode);
        scope.setTag('duration_ms', duration.toString());

        Sentry.captureMessage(`Slow request: ${req.method} ${req.url}`, 'warning');
      });
    }
  });

  next();
}

// Error boundary for async errors
export function captureAsyncError(error: Error, context?: Record<string, any>) {
  Sentry.withScope(scope => {
    if (context) {
      Object.keys(context).forEach(key => {
        scope.setTag(key, context[key]);
      });
    }
    Sentry.captureException(error);
  });
}

// Custom metrics and events
export const monitoring = {
  // Track user actions
  trackUserAction: (action: string, userId?: string, metadata?: Record<string, any>) => {
    Sentry.withScope(scope => {
      scope.setTag('action', action);
      if (userId) scope.setUser({ id: userId });
      if (metadata) {
        Object.keys(metadata).forEach(key => {
          scope.setTag(key, metadata[key]);
        });
      }
      Sentry.captureMessage(`User Action: ${action}`, 'info');
    });
  },

  // Track security events
  trackSecurityEvent: (event: string, severity: 'low' | 'medium' | 'high' | 'critical', metadata?: Record<string, any>) => {
    Sentry.withScope(scope => {
      scope.setTag('security_event', event);
      scope.setTag('severity', severity);
      scope.setLevel(severity === 'critical' ? 'fatal' : severity === 'high' ? 'error' : 'warning');

      if (metadata) {
        Object.keys(metadata).forEach(key => {
          scope.setTag(key, metadata[key]);
        });
      }

      Sentry.captureMessage(`Security Event: ${event}`, severity === 'critical' ? 'fatal' : 'error');
    });
  },

  // Track performance metrics
  trackPerformance: (operation: string, duration: number, metadata?: Record<string, any>) => {
    Sentry.withScope(scope => {
      scope.setTag('performance_operation', operation);
      scope.setTag('duration_ms', duration.toString());

      if (metadata) {
        Object.keys(metadata).forEach(key => {
          scope.setTag(key, metadata[key]);
        });
      }

      // Use Sentry's performance monitoring
      Sentry.captureMessage(`Performance: ${operation} took ${duration}ms`, 'info');
    });
  },

  // Track business metrics
  trackBusinessMetric: (metric: string, value: number, metadata?: Record<string, any>) => {
    Sentry.withScope(scope => {
      scope.setTag('business_metric', metric);
      scope.setTag('value', value.toString());

      if (metadata) {
        Object.keys(metadata).forEach(key => {
          scope.setTag(key, metadata[key]);
        });
      }

      Sentry.captureMessage(`Business Metric: ${metric} = ${value}`, 'info');
    });
  }
};

// Express error handler middleware for Sentry
export function sentryErrorHandler(): (error: any, req: Request, res: Response, next: NextFunction) => void {
  return Sentry.expressErrorHandler({
    shouldHandleError: (error) => {
      // Only handle actual errors, not 4xx client errors
      return true;
    }
  });
}