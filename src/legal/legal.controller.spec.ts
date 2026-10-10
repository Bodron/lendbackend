import { BadRequestException } from "@nestjs/common";
jest.mock("../auth/auth.service", () => ({ AuthService: class {} }));
import { LegalController } from "./legal.controller";
import { legalDocuments } from "./legal-documents";

describe("LegalController", () => {
  const authorization = "Bearer valid-token";
  const authService = { verifyToken: jest.fn(() => ({ sub: "user-1" })) };
  let records: Array<{
    userId: string;
    documentId: string;
    version: string;
    hash: string;
    acceptedAt: Date;
  }>;
  let controller: LegalController;
  let bulkWrite: jest.Mock;

  beforeEach(() => {
    records = [];
    bulkWrite = jest.fn(async (operations) => {
      for (const operation of operations) {
        const item = operation.updateOne.update.$setOnInsert;
        records.push(item);
      }
    });
    const model = {
      bulkWrite,
      find: jest.fn(() => ({
        sort: () => ({ lean: () => ({ exec: async () => records }) }),
      })),
    };
    controller = new LegalController(authService as never, model as never);
  });

  it("keeps the same document hashes across languages", () => {
    expect(controller.documents("ro").map((item) => item.hash)).toEqual(
      controller.documents("en").map((item) => item.hash),
    );
  });

  it("rejects stale document text without recording consent", async () => {
    const documents = legalDocuments.map((item) => ({
      id: item.id,
      version: item.version,
      hash: item.hash,
    }));
    documents[0].hash = "outdated";
    await expect(
      controller.accept(authorization, { documents }),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(bulkWrite).not.toHaveBeenCalled();
  });

  it("records each current version and returns the acceptance timestamps", async () => {
    const documents = legalDocuments.map((item) => ({
      id: item.id,
      version: item.version,
      hash: item.hash,
    }));
    const result = await controller.accept(authorization, { documents });
    expect(result.current).toBe(true);
    expect(result.documents).toHaveLength(legalDocuments.length);
    expect(
      result.documents.every((item) => item.acceptedAt instanceof Date),
    ).toBe(true);
    expect(records.every((item) => item.userId === "user-1")).toBe(true);
  });
});
