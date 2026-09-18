import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { InjectModel, Prop, Schema, SchemaFactory } from "@nestjs/mongoose";
import { Model } from "mongoose";
import {
  App,
  applicationDefault,
  cert,
  initializeApp,
} from "firebase-admin/app";
import { getMessaging } from "firebase-admin/messaging";

@Schema({ timestamps: true })
export class PushDevice {
  @Prop({ required: true, unique: true }) token!: string;
  @Prop({ required: true, index: true }) userId!: string;
  @Prop({ required: true }) platform!: string;
  @Prop({ required: true }) lastSeenAt!: Date;
}
export const PushDeviceSchema = SchemaFactory.createForClass(PushDevice);
PushDeviceSchema.index(
  { lastSeenAt: 1 },
  { expireAfterSeconds: 60 * 24 * 60 * 60 },
);

@Injectable()
export class PushService {
  private readonly logger = new Logger(PushService.name);
  private app?: App;

  constructor(
    @InjectModel(PushDevice.name) private readonly devices: Model<PushDevice>,
    config: ConfigService,
  ) {
    const json = config.get<string>("FIREBASE_SERVICE_ACCOUNT_JSON");
    const useAdc = config.get<string>("FIREBASE_USE_ADC") === "true";
    if (!json && !useAdc) {
      this.logger.warn(
        "Push disabled: configure FIREBASE_SERVICE_ACCOUNT_JSON or FIREBASE_USE_ADC=true.",
      );
      return;
    }
    // Invalid configured credentials should fail deployment visibly.
    this.app = initializeApp(
      {
        credential: json ? cert(JSON.parse(json)) : applicationDefault(),
        projectId: config.get<string>("FIREBASE_PROJECT_ID", "pinlend-de45e"),
      },
      "lend-push",
    );
  }

  async register(userId: string, token: string, platform: string) {
    await this.devices
      .updateOne(
        { token },
        { $set: { userId, platform, lastSeenAt: new Date() } },
        { upsert: true },
      )
      .exec();
  }

  async remove(userId: string, token: string) {
    await this.devices.deleteOne({ userId, token }).exec();
  }

  async sendMessage(
    recipientId: string,
    messageId: string,
    productId: string,
    productTitle: string,
  ) {
    if (!this.app) return;
    try {
      const devices = await this.devices
        .find({ userId: recipientId })
        .select("token")
        .lean()
        .exec();
      for (let offset = 0; offset < devices.length; offset += 500) {
        const tokens = devices
          .slice(offset, offset + 500)
          .map((device) => device.token);
        const result = await getMessaging(this.app).sendEachForMulticast({
          tokens,
          notification: {
            title: "Mesaj nou • Lend",
            body: "Ai primit un mesaj nou. Apasă pentru a deschide conversația.",
          },
          data: {
            type: "chat_message",
            recipientId,
            messageId,
            productId,
            productTitle: productTitle.slice(0, 150),
          },
          apns: {
            headers: { "apns-push-type": "alert", "apns-priority": "10" },
            payload: { aps: { sound: "default", threadId: productId } },
          },
          android: { priority: "high", notification: { sound: "default" } },
        });
        for (let i = 0; i < result.responses.length; i++) {
          const error = result.responses[i].error;
          if (!error) continue;
          if (
            [
              "messaging/registration-token-not-registered",
              "messaging/invalid-registration-token",
            ].includes(error.code)
          ) {
            await this.remove(recipientId, tokens[i]);
          } else {
            this.logger.warn(`Push delivery failed: ${error.code}`);
          }
        }
      }
    } catch {
      // A push outage must not turn an already-saved message into a failed send.
      this.logger.error(
        "Push delivery failed; message remains available in chat.",
      );
    }
  }

  async sendRentalRequest(
    recipientId: string,
    rentalOrderId: string,
    productId: string,
    productTitle: string,
    targetPerspective: "owned" | "renting" = "owned",
  ) {
    if (!this.app) return;
    try {
      const devices = await this.devices
        .find({ userId: recipientId })
        .select("token")
        .lean()
        .exec();
      for (let offset = 0; offset < devices.length; offset += 500) {
        const tokens = devices
          .slice(offset, offset + 500)
          .map((device) => device.token);
        const result = await getMessaging(this.app).sendEachForMulticast({
          tokens,
          notification: {
            title:
              targetPerspective === "owned"
                ? "Cerere nouă de închiriere"
                : "Închiriere înregistrată",
            body:
              targetPerspective === "owned"
                ? `Ai primit o cerere pentru „${productTitle.slice(0, 100)}”.`
                : `Închirierea pentru „${productTitle.slice(0, 100)}” a fost înregistrată.`,
          },
          data: {
            type: "rental_order_received",
            rentalOrderId,
            productId,
            productTitle: productTitle.slice(0, 150),
            rentalPerspective: targetPerspective,
          },
          apns: {
            headers: { "apns-push-type": "alert", "apns-priority": "10" },
            payload: {
              aps: { sound: "default", threadId: `rental:${productId}` },
            },
          },
          android: { priority: "high", notification: { sound: "default" } },
        });
        for (let i = 0; i < result.responses.length; i++) {
          const error = result.responses[i].error;
          if (!error) continue;
          if (
            [
              "messaging/registration-token-not-registered",
              "messaging/invalid-registration-token",
            ].includes(error.code)
          ) {
            await this.remove(recipientId, tokens[i]);
          } else {
            this.logger.warn(`Push delivery failed: ${error.code}`);
          }
        }
      }
    } catch {
      this.logger.error(
        "Rental push delivery failed; rental remains available in the app.",
      );
    }
  }

  async sendRentalScheduleUpdated(
    recipientId: string,
    rentalOrderId: string,
    productId: string,
    productTitle: string,
    pickupTime: string,
    returnTime: string,
  ) {
    if (!this.app) return;
    try {
      const devices = await this.devices
        .find({ userId: recipientId })
        .select("token")
        .lean()
        .exec();
      for (let offset = 0; offset < devices.length; offset += 500) {
        const tokens = devices
          .slice(offset, offset + 500)
          .map((device) => device.token);
        const result = await getMessaging(this.app).sendEachForMulticast({
          tokens,
          notification: {
            title: "Program de inchiriere modificat",
            body: `Programul pentru "${productTitle.slice(0, 100)}" a fost modificat: ridicare ${pickupTime}, retur ${returnTime}.`,
          },
          data: {
            type: "rental_order_received",
            rentalOrderId,
            productId,
            productTitle: productTitle.slice(0, 150),
            rentalPerspective: "renting",
          },
          apns: {
            headers: { "apns-push-type": "alert", "apns-priority": "10" },
            payload: {
              aps: { sound: "default", threadId: `rental:${productId}` },
            },
          },
          android: { priority: "high", notification: { sound: "default" } },
        });
        for (let i = 0; i < result.responses.length; i++) {
          const error = result.responses[i].error;
          if (!error) continue;
          if (
            [
              "messaging/registration-token-not-registered",
              "messaging/invalid-registration-token",
            ].includes(error.code)
          ) {
            await this.remove(recipientId, tokens[i]);
          } else {
            this.logger.warn(`Push delivery failed: ${error.code}`);
          }
        }
      }
    } catch {
      this.logger.error(
        "Rental schedule push delivery failed; rental remains available in the app.",
      );
    }
  }
}
