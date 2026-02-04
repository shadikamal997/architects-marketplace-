import { OAuth2Client } from 'google-auth-library';

/**
 * Google Authentication Service
 * 
 * Verifies Google ID tokens server-side to ensure security.
 * Frontend tokens are NOT trusted - only Google's verification is accepted.
 */

interface GoogleUserInfo {
  providerUserId: string;  // Google's 'sub' claim
  email: string;
  name: string;
  firstName?: string;
  lastName?: string;
  picture?: string;
  emailVerified: boolean;
}

export class GoogleAuthService {
  private client: OAuth2Client;

  constructor() {
    const clientId = process.env.GOOGLE_CLIENT_ID;
    
    if (!clientId) {
      throw new Error('GOOGLE_CLIENT_ID environment variable is required');
    }

    this.client = new OAuth2Client(clientId);
  }

  /**
   * Verify Google ID token and extract user information
   * 
   * @param idToken - The ID token from Google Sign-In
   * @returns Verified user information from Google
   * @throws Error if token is invalid or verification fails
   */
  async verifyIdToken(idToken: string): Promise<GoogleUserInfo> {
    try {
      const ticket = await this.client.verifyIdToken({
        idToken,
        audience: process.env.GOOGLE_CLIENT_ID,
      });

      const payload = ticket.getPayload();

      if (!payload) {
        throw new Error('Invalid token payload');
      }

      if (!payload.sub) {
        throw new Error('Token missing sub claim');
      }

      if (!payload.email) {
        throw new Error('Token missing email claim');
      }

      // Email verification check
      if (!payload.email_verified) {
        throw new Error('Google email not verified');
      }

      return {
        providerUserId: payload.sub,
        email: payload.email,
        name: payload.name || payload.email.split('@')[0],
        firstName: payload.given_name,
        lastName: payload.family_name,
        picture: payload.picture,
        emailVerified: payload.email_verified || false,
      };
    } catch (error: any) {
      console.error('Google token verification failed:', error.message);
      throw new Error('Invalid Google token');
    }
  }
}

// Singleton instance
let googleAuthService: GoogleAuthService | null = null;

export function getGoogleAuthService(): GoogleAuthService {
  if (!googleAuthService) {
    googleAuthService = new GoogleAuthService();
  }
  return googleAuthService;
}
