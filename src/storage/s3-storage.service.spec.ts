import { ConfigService } from "@nestjs/config";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { S3StorageService } from "./s3-storage.service";

jest.mock("@aws-sdk/s3-request-presigner", () => ({
  getSignedUrl: jest.fn(),
}));

describe("S3StorageService.getReadableUrl", () => {
  const sign = getSignedUrl as jest.Mock;

  beforeEach(() => {
    jest.useFakeTimers().setSystemTime(new Date("2026-10-27T07:00:00Z"));
    sign.mockReset();
    let next = 0;
    sign.mockImplementation(async () => `signed-url-${++next}`);
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it("reuses a signed image URL until shortly before it expires", async () => {
    const config = {
      get: (name: string, fallback?: unknown) =>
        ({ BUCKET_NAME: "test-bucket", AWS_S3_SIGNED_URL_TTL_SECONDS: 3600 })[
          name
        ] ?? fallback,
    } as ConfigService;
    const storage = new S3StorageService(config);

    expect(await storage.getReadableUrl("avatars/user-a.jpg")).toBe("signed-url-1");
    expect(await storage.getReadableUrl("avatars/user-a.jpg")).toBe("signed-url-1");
    expect(await storage.getReadableUrl("avatars/user-b.jpg")).toBe("signed-url-2");
    expect(sign).toHaveBeenCalledTimes(2);

    jest.advanceTimersByTime(3540 * 1000);
    expect(await storage.getReadableUrl("avatars/user-a.jpg")).toBe("signed-url-3");
    expect(sign).toHaveBeenCalledTimes(3);
  });
});
