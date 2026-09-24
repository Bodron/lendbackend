import { Types } from "mongoose";
import { MessagesService } from "./messages.service";

describe("MessagesService.hideThread", () => {
  const productId = new Types.ObjectId();
  const roommateInterestId = new Types.ObjectId();
  const updateMany = jest.fn().mockReturnValue({ exec: async () => ({}) });
  const service = new MessagesService(
    {} as any,
    { updateMany } as any,
    {} as any,
    {} as any,
    {} as any,
    {} as any,
  );

  beforeEach(() => jest.clearAllMocks());

  it("hides only this user's messages in the selected roommate conversation", async () => {
    await service.hideThread(
      "alice",
      productId.toString(),
      roommateInterestId.toString(),
    );

    expect(updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        productId,
        roommateInterestId,
        $or: [{ senderId: "alice" }, { recipientId: "alice" }],
        hiddenForUserIds: { $ne: "alice" },
      }),
      { $addToSet: { hiddenForUserIds: "alice" } },
    );
  });

  it("rejects invalid conversation ids without modifying messages", async () => {
    await expect(service.hideThread("alice", "invalid")).rejects.toThrow();
    expect(updateMany).not.toHaveBeenCalled();
  });
});
