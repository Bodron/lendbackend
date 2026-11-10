import { Types } from "mongoose";
import { MessagesService } from "./messages.service";

describe("Message push integration", () => {
  const productId = new Types.ObjectId();
  const messageId = new Types.ObjectId();
  const push = { sendMessage: jest.fn().mockResolvedValue(undefined) };
  const messages = { create: jest.fn(), findOne: jest.fn() };
  const rentalOrders = { findOne: jest.fn() };
  const products = { findById: () => ({ exec: async () => ({ _id: productId, ownerId: "owner", title: "Product" }) }) };
  let service: MessagesService;
  beforeEach(() => {
    jest.clearAllMocks();
    service = new MessagesService(push as any, messages as any, products as any, {} as any, {} as any, {} as any, rentalOrders as any);
    messages.create.mockResolvedValue({ _id: messageId });
    messages.findOne.mockReturnValue({ exec: async () => null });
    rentalOrders.findOne.mockReturnValue({ exec: async () => null });
  });

  it("notifies the owner after saving a buyer message", async () => {
    await service.create("buyer", { productId: productId.toString(), body: "Hello" });
    expect(push.sendMessage).toHaveBeenCalledWith("owner", messageId.toString(), productId.toString(), "Product", "buyer");
  });

  it("notifies the buyer when the owner replies", async () => {
    messages.findOne.mockReturnValue({ exec: async () => ({ senderId: "buyer", recipientId: "owner" }) });
    await service.create("owner", { productId: productId.toString(), recipientId: "buyer", body: "Reply" });
    expect(push.sendMessage).toHaveBeenCalledWith("buyer", messageId.toString(), productId.toString(), "Product", "owner");
  });

  it("lets the owner start a conversation with the renter on an existing order", async () => {
    rentalOrders.findOne.mockReturnValue({ exec: async () => ({ renterId: "buyer" }) });
    await service.create("owner", { productId: productId.toString(), recipientId: "buyer", body: "Pickup details" });
    expect(rentalOrders.findOne).toHaveBeenCalledWith({ productId, renterId: "buyer" });
    expect(messages.create).toHaveBeenCalledWith(expect.objectContaining({ senderId: "owner", recipientId: "buyer" }));
  });

  it("does not let the owner message an unrelated person", async () => {
    await expect(service.create("owner", { productId: productId.toString(), recipientId: "stranger", body: "Hello" })).rejects.toThrow();
    expect(messages.create).not.toHaveBeenCalled();
  });

  it("requires the owner to select a conversation before replying", async () => {
    await expect(service.create("owner", { productId: productId.toString(), body: "Reply" })).rejects.toThrow();
    expect(messages.create).not.toHaveBeenCalled();
  });

  it("does not send push if saving the message fails", async () => {
    messages.create.mockRejectedValue(new Error("Database unavailable"));
    await expect(service.create("buyer", { productId: productId.toString(), body: "Hello" })).rejects.toThrow();
    expect(push.sendMessage).not.toHaveBeenCalled();
  });
});
