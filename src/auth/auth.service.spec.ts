import { UnauthorizedException } from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import { AuthService } from "./auth.service";

jest.mock("jose", () => ({
  createRemoteJWKSet: jest.fn(),
  jwtVerify: jest.fn(),
}));

describe("AuthService.verifyToken", () => {
  const jwtService = new JwtService({ secret: "current-secret" });
  const authService = new AuthService(
    {} as ConstructorParameters<typeof AuthService>[0],
    jwtService,
    {} as ConstructorParameters<typeof AuthService>[2],
    {} as ConstructorParameters<typeof AuthService>[3],
  );

  it("accepts a token signed with the current secret", () => {
    const token = jwtService.sign({ sub: "user-1", email: "user@example.com" });

    expect(authService.verifyToken(token)).toMatchObject({ sub: "user-1" });
  });

  it("returns 401 for a token signed with an old secret", () => {
    const oldToken = new JwtService({ secret: "old-secret" }).sign({
      sub: "user-1",
      email: "user@example.com",
    });

    expect(() => authService.verifyToken(oldToken)).toThrow(UnauthorizedException);
  });
});
