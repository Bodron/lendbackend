import { Types } from "mongoose";
import { MessagesService } from "./messages.service";

describe("Message push integration", () => {
  const productId = new Types.ObjectId();
  const messageId = new Types.ObjectId();
  const push = { sendMessage: jest.fn().mockResolvedValue(undefined) };
  const messages = { create: jest.fn(), findOne: jest.fn() };
  const products = { findById: () => ({ exec: async () => ({ _id: productId, ownerId: "owner", title: "Product" }) }) };
  let service: MessagesService;
  beforeEach(() => {
    jest.clearAllMocks();
    service = new MessagesService(push as any, messages as any, products as any, {} as any, {} as any, {} as any);
    messages.create.mockResolvedValue({ _id: messageId });
  });

  it("notifies the owner after saving a buyer message", async () => {
    await service.create("buyer", { productId: productId.toString(), body: "Hello" });
    expect(push.sendMessage).toHaveBeenCalledWith("owner", messageId.toString(), productId.toString(), "Product");
  });

  it("notifies the buyer when the owner replies", async () => {
    messages.findOne.mockReturnValue({ sort: () => ({ exec: async () => ({ senderId: "buyer", recipientId: "owner" }) }) });
    await service.create("owner", { productId: productId.toString(), body: "Reply" });
    expect(push.sendMessage).toHaveBeenCalledWith("buyer", messageId.toString(), productId.toString(), "Product");
  });

  it("does not send push if saving the message fails", async () => {
    messages.create.mockRejectedValue(new Error("Database unavailable"));
    await expect(service.create("buyer", { productId: productId.toString(), body: "Hello" })).rejects.toThrow();
    expect(push.sendMessage).not.toHaveBeenCalled();
  });
});
