import { Injectable, Logger } from '@nestjs/common';
import { readFileSync } from 'fs';
import { getApp, getApps, initializeApp, cert, App } from 'firebase-admin/app';
import { getMessaging, Messaging, MulticastMessage } from 'firebase-admin/messaging';
import appConfig from '../../../../config/app.config';

@Injectable()
export class FcmService {
  private readonly logger = new Logger(FcmService.name);
  private messagingClient: Messaging | null = null;

  constructor() {
    this.initialize();
  }

  private initialize() {
    const firebaseConfig = appConfig().firebase;

    if (!firebaseConfig?.pushEnabled) {
      this.logger.warn('Firebase push is disabled by FIREBASE_PUSH_ENABLED=false');
      return;
    }

    try {
      let app: App;
      if (getApps().length > 0) {
        app = getApp();
      } else {
        const serviceAccountJson = this.getServiceAccountJson();
        if (!serviceAccountJson) {
          this.logger.warn(
            'Firebase service account is not configured. Push notifications are disabled.',
          );
          return;
        }

        app = initializeApp({
          credential: cert(serviceAccountJson),
        });
      }

      this.messagingClient = getMessaging(app);
      this.logger.log('Firebase Admin initialized successfully');
    } catch (error) {
      this.logger.error(
        `Failed to initialize Firebase Admin: ${error?.message || error}`,
      );
      this.messagingClient = null;
    }
  }

  isReady() {
    return Boolean(this.messagingClient);
  }

  getMessagingClient() {
    return this.messagingClient;
  }

  async sendMulticast(message: MulticastMessage) {
    if (!this.messagingClient) {
      return null;
    }

    return this.messagingClient.sendEachForMulticast(message);
  }

  private getServiceAccountJson(): Record<string, any> | null {
    const firebaseConfig = appConfig().firebase;

    if (firebaseConfig.serviceAccountBase64) {
      try {
        const decoded = Buffer.from(
          firebaseConfig.serviceAccountBase64,
          'base64',
        ).toString('utf8');
        return JSON.parse(decoded);
      } catch (error) {
        this.logger.error(
          'Invalid FIREBASE_SERVICE_ACCOUNT_BASE64 value. Failed to decode/parse JSON.',
        );
        return null;
      }
    }

    if (firebaseConfig.clientEmail && firebaseConfig.privateKey) {
      return {
        type: 'service_account',
        project_id: firebaseConfig.projectId,
        client_email: firebaseConfig.clientEmail,
        private_key: firebaseConfig.privateKey.replace(/\\n/g, '\n'),
      };
    }

    if (firebaseConfig.serviceAccountPath) {
      try {
        const json = readFileSync(firebaseConfig.serviceAccountPath, 'utf8');
        return JSON.parse(json);
      } catch (error) {
        this.logger.error(
          `Failed to read FIREBASE_SERVICE_ACCOUNT_PATH: ${error?.message || error}`,
        );
        return null;
      }
    }

    return null;
  }
}
