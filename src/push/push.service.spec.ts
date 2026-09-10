import { ConfigService } from "@nestjs/config";
import { PushService } from "./push.service";
import { getMessaging } from "firebase-admin/messaging";

jest.mock("firebase-admin/app", () => ({ initializeApp: jest.fn(() => ({})), applicationDefault: jest.fn(), cert: jest.fn() }));
jest.mock("firebase-admin/messaging", () => ({ getMessaging: jest.fn() }));

describe("PushService", () => {
  const exec = jest.fn();
  const devices = {
    find: jest.fn(() => ({ select: () => ({ lean: () => ({ exec }) }) })),
    updateOne: jest.fn(() => ({ exec: jest.fn().mockResolvedValue({}) })),
    deleteOne: jest.fn(() => ({ exec: jest.fn().mockResolvedValue({}) })),
  };
  const send = jest.fn();
  let service: PushService;

  beforeEach(() => {
    jest.clearAllMocks();
    (getMessaging as jest.Mock).mockReturnValue({ sendEachForMulticast: send });
    service = new PushService(devices as any, new ConfigService({ FIREBASE_USE_ADC: "true" }));
  });

  it("targets only the recipient and removes only permanently invalid tokens", async () => {
    exec.mockResolvedValue([{ token: "expired" }, { token: "temporary" }, { token: "good" }]);
    send.mockResolvedValue({ responses: [
      { error: { code: "messaging/registration-token-not-registered" } },
      { error: { code: "messaging/server-unavailable" } },
      { success: true },
    ] });
    await service.sendMessage("recipient", "message", "product", "Product");
    expect(devices.find).toHaveBeenCalledWith({ userId: "recipient" });
    expect(send).toHaveBeenCalledWith(expect.objectContaining({
      tokens: ["expired", "temporary", "good"],
      data: expect.objectContaining({ recipientId: "recipient", productId: "product", messageId: "message" }),
    }));
    expect(devices.deleteOne).toHaveBeenCalledTimes(1);
    expect(devices.deleteOne).toHaveBeenCalledWith({ userId: "recipient", token: "expired" });
  });

  it("does not reject a saved message when Firebase is unavailable", async () => {
    exec.mockResolvedValue([{ token: "device" }]);
    send.mockRejectedValue(new Error("offline"));
    await expect(service.sendMessage("recipient", "message", "product", "Product")).resolves.toBeUndefined();
    expect(devices.deleteOne).not.toHaveBeenCalled();
  });

  it("moves a device to the current account and scopes logout to its owner", async () => {
    await service.register("new-user", "device", "ios");
    expect(devices.updateOne).toHaveBeenCalledWith({ token: "device" }, { $set: {
      userId: "new-user", platform: "ios", lastSeenAt: expect.any(Date),
    } }, { upsert: true });
    await service.remove("old-user", "device");
    expect(devices.deleteOne).toHaveBeenCalledWith({ userId: "old-user", token: "device" });
  });
});
