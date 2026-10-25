import { ProductsService } from "./products.service";
import { mockProducts } from "./mock-products";

describe("Seeded product ownership", () => {
  it("keeps the linked owner's name when refreshing demo listings", async () => {
    const updates: any[] = [];
    const productModel = {
      findOne: () => ({
        select: () => ({ exec: async () => ({ ownerId: "owner-1", ownerName: "Old demo name" }) }),
      }),
      findOneAndUpdate: (_filter: unknown, update: any) => {
        updates.push(update);
        return { exec: async () => ({ images: [] }) };
      },
    };
    const service = new ProductsService(
      productModel as any,
      {} as any,
      { uploadRemoteImage: async () => ({ key: "image" }) } as any,
      { seedMockCategories: async () => undefined } as any,
      { findById: async () => ({ fullName: "Proprietar Demo" }) } as any,
    );
    jest.spyOn(service as any, "withReadableImageUrls").mockResolvedValue({});

    await service.seedMockProducts();

    expect(updates).toHaveLength(mockProducts.length);
    expect(updates.every((update) => update.$set.ownerName === "Proprietar Demo")).toBe(true);
  });
});
