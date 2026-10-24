import { Types } from "mongoose";
import { FavoritesService } from "./favorites.service";

describe("FavoritesService", () => {
  const productId = new Types.ObjectId();
  const exec = (value: unknown) => ({ exec: async () => value });
  const favorites = {
    find: jest.fn(),
    updateOne: jest.fn(),
    deleteOne: jest.fn(),
    bulkWrite: jest.fn(),
  };
  const products = { exists: jest.fn(), find: jest.fn() };
  const service = new FavoritesService(favorites as any, products as any);

  beforeEach(() => jest.clearAllMocks());

  it("reads only the signed-in user's favorites", async () => {
    favorites.find.mockReturnValue({ sort: () => exec([{ productId }]) });
    await expect(service.list("alice")).resolves.toEqual({ productIds: [productId.toString()] });
    expect(favorites.find).toHaveBeenCalledWith({ userId: "alice" });
  });

  it("adds only an existing listing to the signed-in account", async () => {
    products.exists.mockResolvedValue({ _id: productId });
    favorites.updateOne.mockReturnValue(exec({}));
    await service.add("alice", productId.toString());
    expect(favorites.updateOne).toHaveBeenCalledWith(
      { userId: "alice", productId },
      { $setOnInsert: { userId: "alice", productId } },
      { upsert: true },
    );
  });

  it("rejects a missing listing without saving it", async () => {
    products.exists.mockResolvedValue(null);
    await expect(service.add("alice", productId.toString())).rejects.toThrow();
    expect(favorites.updateOne).not.toHaveBeenCalled();
  });

  it("removes a favorite only from the signed-in account", async () => {
    favorites.deleteOne.mockReturnValue(exec({}));
    await service.remove("alice", productId.toString());
    expect(favorites.deleteOne).toHaveBeenCalledWith({ userId: "alice", productId });
  });
});
