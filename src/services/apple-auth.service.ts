import jwt from 'jsonwebtoken';
import jwksClient from 'jwks-rsa';

/**
 * Apple Authentication Service
 * 
 * CRITICAL Apple Behavior:
 * - Email + name sent ONLY on first login
 * - Subsequent logins: only 'sub' (user identifier)
 * - Email may be private relay (@privaterelay.appleid.com)
 * - 'sub' is the ONLY stable identifier
 * 
 * This service verifies Apple ID tokens using Apple's public keys.
 */

interface AppleTokenPayload {
  sub: string;              // Apple user ID (REQUIRED, stable identifier)
  email?: string;           // Email (OPTIONAL, may be private relay or missing)
  email_verified?: boolean | string;
  is_private_email?: boolean | string;
  iss: string;              // Issuer (should be https://appleid.apple.com)
  aud: string;              // Audience (your Apple Client ID)
  exp: number;              // Expiration
  iat: number;              // Issued at
}

export interface AppleUserInfo {
  providerUserId: string;   // Apple's 'sub' claim (stable identifier)
  email?: string;           // May be undefined or private relay
  emailVerified: boolean;
  isPrivateEmail: boolean;
}

export class AppleAuthService {
  private jwksClient: jwksClient.JwksClient;

  constructor() {
    if (!process.env.APPLE_CLIENT_ID) {
      throw new Error('APPLE_CLIENT_ID environment variable is required');
    }

    // Initialize JWKS client to fetch Apple's public keys
    this.jwksClient = jwksClient({
      jwksUri: 'https://appleid.apple.com/auth/keys',
      cache: true,
      cacheMaxAge: 86400000, // 24 hours
    });
  }

  /**
   * Get Apple's signing key for token verification
   */
  private getSigningKey(kid: string): Promise<string> {
    return new Promise((resolve, reject) => {
      this.jwksClient.getSigningKey(kid, (err, key) => {
        if (err) {
          return reject(err);
        }
        if (!key) {
          return reject(new Error('Signing key not found'));
        }
        const signingKey = key.getPublicKey();
        resolve(signingKey);
      });
    });
  }

  /**
   * Verify Apple ID token and extract user information
   * 
   * @param idToken - The ID token from Apple Sign-In
   * @returns Verified user information from Apple
   * @throws Error if token is invalid or verification fails
   */
  async verifyIdToken(idToken: string): Promise<AppleUserInfo> {
    try {
      // Decode header to get key ID (kid)
      const decoded = jwt.decode(idToken, { complete: true });
      
      if (!decoded || typeof decoded === 'string') {
        throw new Error('Invalid token format');
      }

      const { kid } = decoded.header;
      
      if (!kid) {
        throw new Error('Token missing kid in header');
      }

      // Get Apple's public key
      const signingKey = await this.getSigningKey(kid);

      // Verify token with Apple's public key
      const payload = jwt.verify(idToken, signingKey, {
        audience: process.env.APPLE_CLIENT_ID,
        issuer: 'https://appleid.apple.com',
        algorithms: ['RS256'],
      }) as AppleTokenPayload;

      // Validate required claims
      if (!payload.sub) {
        throw new Error('Token missing sub claim');
      }

      // Apple sends email_verified and is_private_email as strings "true"/"false"
      const emailVerified = payload.email_verified === true || payload.email_verified === 'true';
      const isPrivateEmail = payload.is_private_email === true || payload.is_private_email === 'true';

      return {
        providerUserId: payload.sub,
        email: payload.email, // May be undefined
        emailVerified,
        isPrivateEmail,
      };
    } catch (error: any) {
      console.error('Apple token verification failed:', error.message);
      throw new Error('Invalid Apple token');
    }
  }
}

// Singleton instance
let appleAuthService: AppleAuthService | null = null;

export function getAppleAuthService(): AppleAuthService {
  if (!appleAuthService) {
    appleAuthService = new AppleAuthService();
  }
  return appleAuthService;
}
