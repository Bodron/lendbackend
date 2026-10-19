import { ForbiddenException, UnauthorizedException } from "@nestjs/common";
import { AdminController } from "./admin.controller";

jest.mock("jose", () => ({ createRemoteJWKSet: jest.fn(() => jest.fn()), jwtVerify: jest.fn() }));

describe("AdminController authorization", () => {
  const auth = {
    verifyToken: jest.fn().mockReturnValue({ sub: "user-1" }),
    getProfile: jest.fn(),
  };
  const admin = {
    overview: jest.fn().mockResolvedValue({ users: 2 }),
    moderateProduct: jest.fn().mockResolvedValue({ isClosedByAdmin: true }),
  };
  const controller = new AdminController(auth as never, admin as never);

  beforeEach(() => jest.clearAllMocks());

  it("rejects a missing token", async () => {
    await expect(controller.overview()).rejects.toBeInstanceOf(UnauthorizedException);
    expect(admin.overview).not.toHaveBeenCalled();
  });

  it("rejects a valid token for a regular user", async () => {
    auth.getProfile.mockResolvedValue({ id: "user-1", role: "user" });
    await expect(controller.moderate("Bearer valid", "507f1f77bcf86cd799439011", { closed: true, reason: "spam" })).rejects.toBeInstanceOf(ForbiddenException);
    expect(admin.moderateProduct).not.toHaveBeenCalled();
  });

  it("checks the current database role before a moderation change", async () => {
    auth.getProfile.mockResolvedValue({ id: "user-1", role: "super_admin" });
    await controller.moderate("Bearer valid", "507f1f77bcf86cd799439011", { closed: true, reason: "spam" });
    expect(admin.moderateProduct).toHaveBeenCalledWith("507f1f77bcf86cd799439011", { closed: true, reason: "spam" }, "user-1");
  });
});
