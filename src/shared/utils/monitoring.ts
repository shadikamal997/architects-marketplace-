/**
 * Monitoring Configuration
 *
 * Defines alert rules, thresholds, and monitoring policies for production
 */

export interface AlertRule {
  name: string;
  description: string;
  severity: 'critical' | 'high' | 'medium' | 'low' | 'info';
  condition: string;
  threshold: number;
  window: string; // e.g., '5m', '1h', '1d'
  channels: string[]; // e.g., ['email', 'slack', 'pagerduty']
  enabled: boolean;
}

export interface MonitoringConfig {
  alerts: AlertRule[];
  metrics: {
    collection: {
      interval: string; // e.g., '30s', '1m', '5m'
      retention: string; // e.g., '30d', '90d', '1y'
    };
    endpoints: {
      health: boolean;
      performance: boolean;
      business: boolean;
    };
  };
  security: {
    enabled: boolean;
    rules: string[];
  };
}

// Production monitoring configuration
export const monitoringConfig: MonitoringConfig = {
  alerts: [
    // Critical Alerts - Immediate response required
    {
      name: 'Database Connection Failure',
      description: 'Database is unreachable or connection pool exhausted',
      severity: 'critical',
      condition: 'database.connection.status != "healthy"',
      threshold: 1,
      window: '1m',
      channels: ['email', 'slack', 'pagerduty'],
      enabled: true
    },
    {
      name: 'Application Down',
      description: 'Application health check failing',
      severity: 'critical',
      condition: 'http.status_code == 503',
      threshold: 3,
      window: '2m',
      channels: ['email', 'slack', 'pagerduty'],
      enabled: true
    },
    {
      name: 'High Error Rate',
      description: 'Error rate exceeds 5% of total requests',
      severity: 'critical',
      condition: 'http.error_rate > 0.05',
      threshold: 1,
      window: '5m',
      channels: ['email', 'slack', 'pagerduty'],
      enabled: true
    },

    // High Priority Alerts
    {
      name: 'Payment Processing Failure',
      description: 'Stripe webhook processing failures',
      severity: 'high',
      condition: 'stripe.webhook.error_count > 0',
      threshold: 1,
      window: '5m',
      channels: ['email', 'slack'],
      enabled: true
    },
    {
      name: 'Security Incident',
      description: 'Suspicious security events detected',
      severity: 'high',
      condition: 'security.events.count > 0',
      threshold: 1,
      window: '1m',
      channels: ['email', 'slack', 'security-team'],
      enabled: true
    },
    {
      name: 'Slow Response Times',
      description: 'Average response time exceeds 3 seconds',
      severity: 'high',
      condition: 'http.response_time.avg > 3000',
      threshold: 1,
      window: '10m',
      channels: ['email', 'slack'],
      enabled: true
    },

    // Medium Priority Alerts
    {
      name: 'High Memory Usage',
      description: 'Memory usage exceeds 85%',
      severity: 'medium',
      condition: 'system.memory.usage > 0.85',
      threshold: 1,
      window: '5m',
      channels: ['email', 'slack'],
      enabled: true
    },
    {
      name: 'Database Slow Queries',
      description: 'Database query duration exceeds 2 seconds',
      severity: 'medium',
      condition: 'database.query.duration > 2000',
      threshold: 5,
      window: '10m',
      channels: ['email'],
      enabled: true
    },
    {
      name: 'Rate Limit Exceeded',
      description: 'Rate limiting triggered frequently',
      severity: 'medium',
      condition: 'http.rate_limit.count > 10',
      threshold: 1,
      window: '5m',
      channels: ['email'],
      enabled: true
    },

    // Low Priority Alerts
    {
      name: 'Disk Space Warning',
      description: 'Disk usage exceeds 80%',
      severity: 'low',
      condition: 'system.disk.usage > 0.80',
      threshold: 1,
      window: '1h',
      channels: ['email'],
      enabled: true
    },
    {
      name: 'User Registration Spike',
      description: 'Unusual spike in user registrations',
      severity: 'low',
      condition: 'business.registrations.count > 50',
      threshold: 1,
      window: '1h',
      channels: ['email'],
      enabled: true
    }
  ],

  metrics: {
    collection: {
      interval: '30s',
      retention: '90d'
    },
    endpoints: {
      health: true,
      performance: true,
      business: true
    }
  },

  security: {
    enabled: true,
    rules: [
      'failed_login_attempts',
      'suspicious_ip_addresses',
      'unusual_traffic_patterns',
      'webhook_signature_failures',
      'sql_injection_attempts',
      'xss_attempts',
      'rate_limit_violations'
    ]
  }
};

// Development monitoring (less aggressive)
export const developmentMonitoringConfig: MonitoringConfig = {
  ...monitoringConfig,
  alerts: monitoringConfig.alerts.map(alert => ({
    ...alert,
    enabled: alert.severity === 'critical', // Only critical alerts in development
    channels: ['email'] // Only email notifications in development
  }))
};

// Get monitoring config based on environment
export function getMonitoringConfig(): MonitoringConfig {
  const env = process.env.NODE_ENV || 'development';

  if (env === 'production') {
    return monitoringConfig;
  }

  return developmentMonitoringConfig;
}