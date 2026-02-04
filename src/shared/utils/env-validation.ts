/**
 * Environment Configuration Validation
 *
 * Validates required environment variables at startup
 * Provides clear error messages for missing or invalid configuration
 */

interface EnvVarConfig {
  name: string;
  required: boolean;
  validator?: (value: string) => boolean;
  description: string;
}

const ENV_CONFIG: EnvVarConfig[] = [
  {
    name: 'DATABASE_URL',
    required: true,
    validator: (value) => value.startsWith('postgresql://'),
    description: 'PostgreSQL database connection string'
  },
  {
    name: 'NODE_ENV',
    required: true,
    validator: (value) => ['development', 'staging', 'production'].includes(value),
    description: 'Environment (development, staging, production)'
  },
  {
    name: 'JWT_SECRET',
    required: true,
    validator: (value) => value.length >= 32,
    description: 'JWT signing secret (minimum 32 characters)'
  },
  {
    name: 'FRONTEND_URL',
    required: true,
    validator: (value) => {
      try {
        const url = new URL(value);
        return url.protocol === 'http:' || url.protocol === 'https:';
      } catch {
        return false;
      }
    },
    description: 'Frontend application URL'
  },
  {
    name: 'BACKEND_URL',
    required: true,
    validator: (value) => {
      try {
        const url = new URL(value);
        return url.protocol === 'http:' || url.protocol === 'https:';
      } catch {
        return false;
      }
    },
    description: 'Backend API URL'
  },
  {
    name: 'STORAGE_BUCKET',
    required: true,
    description: 'AWS S3 bucket name'
  },
  {
    name: 'STORAGE_REGION',
    required: true,
    description: 'AWS S3 region'
  },
  {
    name: 'STORAGE_ACCESS_KEY',
    required: true,
    description: 'AWS S3 access key'
  },
  {
    name: 'STORAGE_SECRET_KEY',
    required: true,
    description: 'AWS S3 secret key'
  },
  {
    name: 'STRIPE_SECRET_KEY',
    required: true,
    validator: (value) => value.startsWith('sk_'),
    description: 'Stripe secret key'
  },
  {
    name: 'STRIPE_WEBHOOK_SECRET',
    required: true,
    validator: (value) => value.startsWith('whsec_'),
    description: 'Stripe webhook secret'
  },
  {
    name: 'PLATFORM_COMMISSION_RATE',
    required: true,
    validator: (value) => {
      const rate = parseFloat(value);
      return !isNaN(rate) && rate >= 0 && rate <= 1;
    },
    description: 'Platform commission rate (0.0 to 1.0)'
  }
];

export class EnvironmentValidator {
  private errors: string[] = [];
  private warnings: string[] = [];

  /**
   * Validate all environment variables
   */
  validate(): { isValid: boolean; errors: string[]; warnings: string[] } {
    this.errors = [];
    this.warnings = [];

    for (const config of ENV_CONFIG) {
      this.validateVariable(config);
    }

    this.validateEnvironmentSpecific();

    return {
      isValid: this.errors.length === 0,
      errors: this.errors,
      warnings: this.warnings
    };
  }

  /**
   * Validate a single environment variable
   */
  private validateVariable(config: EnvVarConfig): void {
    const value = process.env[config.name];

    // Check if required variable is missing
    if (config.required && (!value || value.trim() === '')) {
      this.errors.push(`Missing required environment variable: ${config.name} - ${config.description}`);
      return;
    }

    // Skip validation if variable is not set and not required
    if (!value) return;

    // Run custom validator if provided
    if (config.validator && !config.validator(value)) {
      this.errors.push(`Invalid value for ${config.name}: ${value} - ${config.description}`);
    }
  }

  /**
   * Environment-specific validation
   */
  private validateEnvironmentSpecific(): void {
    const nodeEnv = process.env.NODE_ENV;

    if (nodeEnv === 'production') {
      // Production-specific validations
      if (process.env.STRIPE_SECRET_KEY?.includes('test')) {
        this.errors.push('Production environment should use live Stripe keys, not test keys');
      }

      if (process.env.FRONTEND_URL?.startsWith('http://')) {
        this.warnings.push('Production environment should use HTTPS for FRONTEND_URL');
      }

      if (process.env.BACKEND_URL?.startsWith('http://')) {
        this.warnings.push('Production environment should use HTTPS for BACKEND_URL');
      }

      if (process.env.ENABLE_SANDBOX_MODE === 'true') {
        this.errors.push('ENABLE_SANDBOX_MODE should be false in production');
      }
    }

    if (nodeEnv === 'development') {
      // Development-specific validations
      if (process.env.STRIPE_SECRET_KEY?.includes('live')) {
        this.warnings.push('Development environment should use test Stripe keys');
      }
    }
  }

  /**
   * Get current environment info
   */
  static getEnvironmentInfo(): {
    environment: string;
    isProduction: boolean;
    isDevelopment: boolean;
    port: number;
  } {
    const environment = process.env.NODE_ENV || 'development';
    const port = parseInt(process.env.PORT || '3001', 10);

    return {
      environment,
      isProduction: environment === 'production',
      isDevelopment: environment === 'development',
      port
    };
  }
}

/**
 * Validate environment on module load
 * This will throw an error if critical environment variables are missing
 */
export function validateEnvironment(): void {
  const validator = new EnvironmentValidator();
  const result = validator.validate();

  if (result.errors.length > 0) {
    console.error(' Environment validation failed:');
    result.errors.forEach(error => console.error(`  - ${error}`));
    console.error('\nPlease check your .env file and ensure all required variables are set.');
    process.exit(1);
  }

  if (result.warnings.length > 0) {
    console.warn('  Environment validation warnings:');
    result.warnings.forEach(warning => console.warn(`  - ${warning}`));
  }

  console.log(' Environment validation passed');
}