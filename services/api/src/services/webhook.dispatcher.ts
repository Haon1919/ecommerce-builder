import { prisma } from '../db';
import { logger } from '../utils/logger';
import crypto from 'crypto';
import { decrypt } from './encryption';

export interface WebhookEvent {
    topic: string;
    storeId: string;
    payload: any;
}

export class WebhookDispatcher {
    /**
     * Dispatch an event to all subscribed webhooks.
     * In a real system, this would push to a queue (like Pub/Sub or SQS),
     * and a worker would process it. Here we process asynchronously in the background.
     */
    async dispatch(event: WebhookEvent) {
        // Run asynchronously so we don't block the API response
        setImmediate(async () => {
            try {
                const subscriptions = await prisma.webhookSubscription.findMany({
                    where: {
                        storeId: event.storeId,
                        topic: event.topic,
                        active: true,
                    },
                });

                if (subscriptions.length === 0) return;

                const promises = subscriptions.map((sub) =>
                    this.sendWithRetry(sub, event.payload, 0)
                );

                await Promise.allSettled(promises);
            } catch (err) {
                logger.error('Failed to dispatch webhooks', { error: err, topic: event.topic });
            }
        });
    }

    private async sendWithRetry(subscription: any, payload: any, attempt: number): Promise<void> {
        const MAX_RETRIES = 3;
        const baseDelayMs = 1000;

        try {
            const secret = decrypt(subscription.secret);
            const body = JSON.stringify(payload);
            const signature = this.signPayload(body, secret);

            const response = await fetch(subscription.targetUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-Store-ID': subscription.storeId,
                    'X-Webhook-Signature': signature,
                },
                body,
            });

            if (!response.ok) {
                throw new Error(`Endpoint returned status ${response.status}`);
            }

            logger.info('Webhook dispatched successfully', {
                subscriptionId: subscription.id,
                targetUrl: subscription.targetUrl,
            });
        } catch (err: any) {
            logger.error(`Webhook delivery failed for subscription ${subscription.id}`, {
                error: err.message,
                attempt: attempt + 1,
            });

            if (attempt < MAX_RETRIES) {
                const delay = baseDelayMs * Math.pow(2, attempt); // Exponential backoff
                await new Promise((resolve) => setTimeout(resolve, delay));
                return this.sendWithRetry(subscription, payload, attempt + 1);
            } else {
                logger.error(`Webhook delivery permanently failed after ${MAX_RETRIES} retries`, {
                    subscriptionId: subscription.id,
                });
            }
        }
    }

    private signPayload(payload: string, secret: string): string {
        return crypto
            .createHmac('sha256', secret)
            .update(payload, 'utf8')
            .digest('hex');
    }
}

export const webhookDispatcher = new WebhookDispatcher();
