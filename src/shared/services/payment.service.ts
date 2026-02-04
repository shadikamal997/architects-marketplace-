import Stripe from 'stripe';
import { prisma } from '../../lib/prisma';

export interface PaymentConfig {
  secretKey: string;
  webhookSecret: string;
  platformCommissionRate: number;
}

export interface CreateCheckoutSessionRequest {
  designId: string;
  designTitle: string;
  price: number; // in cents
  buyerEmail: string;
  successUrl: string;
  cancelUrl: string;
  metadata?: Record<string, string>;
}

export interface CheckoutSession {
  id: string;
  url: string;
}

export interface StripeConnectAccount {
  id: string;
  onboardingUrl: string;
}

export interface PayoutRequest {
  architectId: string;
  amount: number; // in cents
  currency: string;
  description: string;
  metadata?: Record<string, string>;
}

export interface PayoutResult {
  transferId: string;
  amount: number;
  currency: string;
  destination: string;
}

export class PaymentService {
  private stripe: Stripe;
  private config: PaymentConfig;

  constructor() {
    this.config = {
      secretKey: process.env.STRIPE_SECRET_KEY || '',
      webhookSecret: process.env.STRIPE_WEBHOOK_SECRET || '',
      platformCommissionRate: parseFloat(process.env.PLATFORM_COMMISSION_RATE || '0.10')
    };

    // In development, allow missing credentials but warn
    if (process.env.NODE_ENV !== 'production') {
      if (!this.config.secretKey) {
        console.warn('  Stripe credentials not configured. Payment features will fail.');
        this.config.secretKey = 'sk_test_dev_key_placeholder';
      }
    } else {
      if (!this.config.secretKey) {
        throw new Error('STRIPE_SECRET_KEY environment variable is required');
      }
    }

    this.stripe = new Stripe(this.config.secretKey, {
      // apiVersion: '2024-12-18.acacia' // Use default
    });
  }

  /**
   * Create a Stripe Express account for an architect
   */
  async createStripeConnectAccount(email: string, name: string): Promise<StripeConnectAccount> {
    try {
      const account = await this.stripe.accounts.create({
        type: 'express',
        country: 'US', // Default to US, can be made configurable
        email: email,
        capabilities: {
          card_payments: { requested: true },
          transfers: { requested: true },
        },
        business_type: 'individual', // or 'company' based on user type
        metadata: {
          name: name,
          platform: 'architects-marketplace'
        }
      });

      // Create account link for onboarding
      const accountLink = await this.stripe.accountLinks.create({
        account: account.id,
        refresh_url: process.env.FRONTEND_URL || 'http://localhost:3000/architect/onboarding/refresh',
        return_url: process.env.FRONTEND_URL || 'http://localhost:3000/architect/onboarding/complete',
        type: 'account_onboarding',
      });

      return {
        id: account.id,
        onboardingUrl: accountLink.url,
      };
    } catch (error) {
      console.error('Error creating Stripe Connect account:', error);
      throw new Error('Failed to create Stripe Connect account');
    }
  }

  /**
   * Check if a Stripe Connect account is fully onboarded
   */
  async checkAccountStatus(accountId: string): Promise<{ payoutsEnabled: boolean; status: 'PENDING' | 'VERIFIED' }> {
    try {
      const account = await this.stripe.accounts.retrieve(accountId);

      // Check if account is fully onboarded
      const chargesEnabled = account.charges_enabled;
      const payoutsEnabled = account.payouts_enabled;
      const detailsSubmitted = account.details_submitted;

      return {
        payoutsEnabled: chargesEnabled && payoutsEnabled && detailsSubmitted,
        status: (chargesEnabled && payoutsEnabled && detailsSubmitted) ? 'VERIFIED' : 'PENDING'
      };
    } catch (error) {
      console.error('Error checking account status:', error);
      throw new Error('Failed to check account status');
    }
  }

  /**
   * Create a payout transfer to an architect's Stripe account
   */
  async createPayoutTransfer(request: PayoutRequest): Promise<PayoutResult> {
    try {
      const transfer = await this.stripe.transfers.create({
        amount: request.amount,
        currency: request.currency.toLowerCase(),
        destination: request.architectId, // This should be the Stripe account ID
        description: request.description,
        metadata: request.metadata || {}
      });

      return {
        transferId: transfer.id,
        amount: transfer.amount,
        currency: transfer.currency,
        destination: transfer.destination as string
      };
    } catch (error) {
      console.error('Error creating payout transfer:', error);
      throw new Error('Failed to create payout transfer');
    }
  }

  /**
   * Calculate platform fee and architect share
   */
  calculatePayoutSplit(totalAmount: number): { platformFee: number; architectShare: number } {
    const platformFee = Math.round(totalAmount * this.config.platformCommissionRate);
    const architectShare = totalAmount - platformFee;

    return { platformFee, architectShare };
  }
  async createCheckoutSession(request: CreateCheckoutSessionRequest): Promise<CheckoutSession> {
    try {
      const sessionConfig: Stripe.Checkout.SessionCreateParams = {
        payment_method_types: ['card'],
        line_items: [
          {
            price_data: {
              currency: 'usd',
              product_data: {
                name: request.designTitle,
                description: `Architectural design: ${request.designTitle}`,
              },
              unit_amount: request.price, // price in cents
            },
            quantity: 1,
          },
        ],
        mode: 'payment',
        customer_email: request.buyerEmail,
        success_url: request.successUrl,
        cancel_url: request.cancelUrl,
      };

      // Add metadata if provided
      if (request.metadata) {
        sessionConfig.metadata = request.metadata;
      }

      const session = await this.stripe.checkout.sessions.create(sessionConfig);

      return {
        id: session.id,
        url: session.url!,
      };
    } catch (error) {
      console.error('Error creating checkout session:', error);
      console.error('Stripe error details:', {
        message: (error as any).message,
        type: (error as any).type,
        code: (error as any).code,
        param: (error as any).param
      });
      throw new Error('Failed to create payment session');
    }
  }

  /**
   * Verify and construct Stripe webhook event
   */
  constructWebhookEvent(payload: Buffer, signature: string): Stripe.Event {
    try {
      return this.stripe.webhooks.constructEvent(payload, signature, this.config.webhookSecret);
    } catch (error) {
      console.error('Webhook signature verification failed:', error);
      throw new Error('Invalid webhook signature');
    }
  }

  /**
   * Process successful payment and trigger payouts
   */
  async processSuccessfulPayment(session: Stripe.Checkout.Session): Promise<void> {
    try {
      // Extract metadata
      const designId = session.metadata?.designId;
      const modificationId = session.metadata?.modificationId;

      if (designId) {
        // Process design purchase payout
        await this.processDesignPurchasePayout(prisma, designId, session);
      } else if (modificationId) {
        // Process modification payout (when completed)
        await this.processModificationPayout(prisma, modificationId, session);
      }

      await prisma.$disconnect();
    } catch (error) {
      console.error('Error processing successful payment:', error);
      throw error;
    }
  }

  /**
   * Process design purchase payout (immediate)
   */
  private async processDesignPurchasePayout(
    prisma: any,
    designId: string,
    session: Stripe.Checkout.Session
  ): Promise<void> {
    // Get design and architect info
    const design = await prisma.design.findUnique({
      where: { id: designId },
      include: { architect: true }
    });

    if (!design) {
      throw new Error(`Design ${designId} not found`);
    }

    // Check if architect has payouts enabled
    if (!design.architect.payoutsEnabled || !design.architect.stripeAccountId) {
      console.log(`Architect ${design.architect.id} not ready for payouts - holding funds`);
      return; // Hold payout until onboarding is complete
    }

    // TEMPORARY: Disable all payouts until Stripe Connect is implemented
    // TODO: Re-enable immediate payouts after architect onboarding is complete
    console.log(`TEMPORARY: Holding payout for architect ${design.architect.id} - Stripe Connect not yet implemented`);
    return;

    // Calculate payout split
    const totalAmount = session.amount_total!;
    const { platformFee, architectShare } = this.calculatePayoutSplit(totalAmount);

    // Create transaction record
    const transaction = await prisma.transaction.create({
      data: {
        buyerId: session.metadata?.buyerId || 'unknown',
        designId: designId,
        stripeSessionId: session.id,
        stripePaymentIntentId: session.payment_intent as string,
        amountTotal: totalAmount,
        platformFee: platformFee,
        architectEarning: architectShare,
        currency: session.currency!.toUpperCase(),
        status: 'PAID'
      }
    });

    // Create architect earning record
    const earning = await prisma.architectEarning.create({
      data: {
        architectId: design.architect.id,
        transactionId: transaction.id,
        amount: architectShare,
        currency: session.currency!.toUpperCase(),
        status: 'PAYABLE' // Will be paid immediately
      }
    });

    // Execute immediate payout
    try {
      const payoutResult = await this.createPayoutTransfer({
        architectId: design.architect.stripeAccountId,
        amount: architectShare,
        currency: session.currency!.toUpperCase(),
        description: `Design purchase: ${design.title}`,
        metadata: {
          earningId: earning.id,
          transactionId: transaction.id,
          designId: designId
        }
      });

      // Update earning status to PAID
      await prisma.architectEarning.update({
        where: { id: earning.id },
        data: {
          status: 'PAID',
          paidAt: new Date()
        }
      });

      console.log(`Payout completed: ${payoutResult.transferId} for architect ${design.architect.id}`);
    } catch (payoutError) {
      console.error('Payout failed:', payoutError);
      // Keep earning as PAYABLE for retry
    }
  }

  /**
   * Process modification payout (when completed)
   */
  private async processModificationPayout(
    prisma: any,
    modificationId: string,
    session: Stripe.Checkout.Session
  ): Promise<void> {
    // For modifications, we only record the payment now
    // Payout happens when modification status becomes COMPLETED

    const modification = await prisma.modificationRequest.findUnique({
      where: { id: modificationId },
      include: { design: { include: { architect: true } } }
    });

    if (!modification) {
      throw new Error(`Modification ${modificationId} not found`);
    }

    // Calculate payout split
    const totalAmount = session.amount_total!;
    const { platformFee, architectShare } = this.calculatePayoutSplit(totalAmount);

    // Create transaction record
    const transaction = await prisma.transaction.create({
      data: {
        buyerId: session.metadata?.buyerId || 'unknown',
        modificationId: modificationId,
        stripeSessionId: session.id,
        stripePaymentIntentId: session.payment_intent as string,
        amountTotal: totalAmount,
        platformFee: platformFee,
        architectEarning: architectShare,
        currency: session.currency!.toUpperCase(),
        status: 'PAID'
      }
    });

    // Create architect earning record (initially PENDING until modification is completed)
    await prisma.architectEarning.create({
      data: {
        architectId: modification.design.architect.id,
        transactionId: transaction.id,
        amount: architectShare,
        currency: session.currency!.toUpperCase(),
        status: 'PENDING' // Will become PAYABLE when modification is completed
      }
    });

    console.log(`Modification payment recorded: ${transaction.id}, payout pending completion`);
  }

  /**
   * Verify Stripe connectivity (for testing)
   */
  async testConnection(): Promise<boolean> {
    try {
      await this.stripe.balance.retrieve();
      return true;
    } catch (error) {
      console.error('Stripe connection test failed:', error);
      return false;
    }
  }

  /**
   * Get Stripe client instance (for advanced operations)
   */
  getStripeClient(): Stripe {
    return this.stripe;
  }
}

// Export singleton instance
export const paymentService = new PaymentService();