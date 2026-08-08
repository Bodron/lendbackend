import {
  BadRequestException,
  Injectable,
  UnauthorizedException,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { JwtService } from "@nestjs/jwt";
import { compare, hash } from "bcryptjs";
import { createRemoteJWKSet, jwtVerify, type JWTPayload } from "jose";
import { S3StorageService } from "../storage/s3-storage.service";
import { SafeUser, UsersService } from "../users/users.service";
import { AppleLoginDto } from "./dto/apple-login.dto";
import { GoogleLoginDto } from "./dto/google-login.dto";
import { LoginDto } from "./dto/login.dto";
import { RegisterDto } from "./dto/register.dto";
import { UpdateAvatarDto } from "./dto/update-avatar.dto";

type AuthResponse = {
  accessToken: string;
  user: SafeUser;
};

type AppleIdentityPayload = JWTPayload & {
  sub: string;
  email?: string;
  email_verified?: boolean | string;
};

type GoogleIdentityPayload = JWTPayload & {
  sub: string;
  email?: string;
  email_verified?: boolean | string;
  name?: string;
};

const appleJwks = createRemoteJWKSet(
  new URL("https://appleid.apple.com/auth/keys"),
);
const googleJwks = createRemoteJWKSet(
  new URL("https://www.googleapis.com/oauth2/v3/certs"),
);

@Injectable()
export class AuthService {
  constructor(
    private readonly usersService: UsersService,
    private readonly jwtService: JwtService,
    private readonly s3StorageService: S3StorageService,
    private readonly configService: ConfigService,
  ) {}

  async register(registerDto: RegisterDto): Promise<AuthResponse> {
    const passwordHash = await hash(registerDto.password, 12);
    const user = await this.usersService.create({
      fullName: registerDto.fullName,
      email: registerDto.email,
      phone: registerDto.phone,
      passwordHash,
    });

    return this.createAuthResponse(user);
  }

  async login(loginDto: LoginDto): Promise<AuthResponse> {
    const user = await this.usersService.findByEmailWithPassword(
      loginDto.email,
    );

    if (!user) {
      throw new UnauthorizedException("Email sau parolă incorectă.");
    }

    const isPasswordValid = await compare(loginDto.password, user.passwordHash);
    if (!isPasswordValid) {
      throw new UnauthorizedException("Email sau parolă incorectă.");
    }

    return this.createAuthResponse(this.usersService.toSafeUser(user));
  }

  async loginWithApple(appleLoginDto: AppleLoginDto): Promise<AuthResponse> {
    const appleUser = await this.verifyAppleIdentityToken(appleLoginDto);

    const userByAppleSub = await this.usersService.findByAppleSub(
      appleUser.sub,
    );
    if (userByAppleSub) {
      return this.createAuthResponse(userByAppleSub);
    }

    const email = appleUser.email?.toLowerCase();
    if (!email) {
      throw new UnauthorizedException(
        "Apple nu a returnat o adresă de email pentru acest cont.",
      );
    }

    const existingUser = await this.usersService.findByEmail(email);
    if (existingUser) {
      const linkedUser = await this.usersService.linkAppleAccount({
        userId: existingUser.id,
        appleSub: appleUser.sub,
      });

      if (!linkedUser) {
        throw new UnauthorizedException("Nu am putut lega contul Apple.");
      }

      return this.createAuthResponse(linkedUser);
    }

    const passwordHash = await hash(crypto.randomUUID(), 12);
    const user = await this.usersService.create({
      fullName: this.appleDisplayName(appleLoginDto.fullName, email),
      email,
      phone: "Apple",
      passwordHash,
      appleSub: appleUser.sub,
      authProvider: "apple",
    });

    return this.createAuthResponse(user);
  }

  async loginWithGoogle(googleLoginDto: GoogleLoginDto): Promise<AuthResponse> {
    const googleUser = await this.verifyGoogleIdToken(googleLoginDto);

    const userByGoogleSub = await this.usersService.findByGoogleSub(
      googleUser.sub,
    );
    if (userByGoogleSub) {
      return this.createAuthResponse(userByGoogleSub);
    }

    const email = googleUser.email?.toLowerCase();
    if (!email) {
      throw new UnauthorizedException(
        "Google nu a returnat o adresă de email pentru acest cont.",
      );
    }

    const existingUser = await this.usersService.findByEmail(email);
    if (existingUser) {
      const linkedUser = await this.usersService.linkGoogleAccount({
        userId: existingUser.id,
        googleSub: googleUser.sub,
      });

      if (!linkedUser) {
        throw new UnauthorizedException("Nu am putut lega contul Google.");
      }

      return this.createAuthResponse(linkedUser);
    }

    const passwordHash = await hash(crypto.randomUUID(), 12);
    const user = await this.usersService.create({
      fullName: this.googleDisplayName(
        googleLoginDto.fullName,
        googleUser.name,
        email,
      ),
      email,
      phone: "Google",
      passwordHash,
      googleSub: googleUser.sub,
      authProvider: "google",
    });

    return this.createAuthResponse(user);
  }

  async getProfile(userId: string): Promise<SafeUser> {
    const user = await this.usersService.findById(userId);

    if (!user) {
      throw new UnauthorizedException("Token invalid.");
    }

    return this.withReadableAvatar(user);
  }

  async updateAvatar(
    userId: string,
    updateAvatarDto: UpdateAvatarDto,
  ): Promise<SafeUser> {
    const user = await this.usersService.updateAvatar({
      userId,
      avatarUrl: updateAvatarDto.avatarUrl,
      avatarKey: updateAvatarDto.avatarKey,
    });

    if (!user) {
      throw new UnauthorizedException("Token invalid.");
    }

    return this.withReadableAvatar(user);
  }

  verifyToken(token: string): { sub: string; email: string } {
    return this.jwtService.verify<{ sub: string; email: string }>(token);
  }

  private async createAuthResponse(user: SafeUser): Promise<AuthResponse> {
    return {
      accessToken: this.jwtService.sign({
        sub: user.id,
        email: user.email,
      }),
      user: await this.withReadableAvatar(user),
    };
  }

  private async withReadableAvatar(user: SafeUser): Promise<SafeUser> {
    if (!user.avatarKey) {
      return user;
    }

    return {
      ...user,
      avatarUrl: await this.s3StorageService.getReadableUrl(user.avatarKey),
    };
  }

  private async verifyAppleIdentityToken(
    appleLoginDto: AppleLoginDto,
  ): Promise<AppleIdentityPayload> {
    const audiences = this.appleClientIds();
    const nonce = appleLoginDto.nonce?.trim() || undefined;

    try {
      const { payload } = await jwtVerify<AppleIdentityPayload>(
        appleLoginDto.identityToken,
        appleJwks,
        {
          issuer: "https://appleid.apple.com",
          audience: audiences,
        },
      );

      if (!payload.sub) {
        throw new UnauthorizedException("Token Apple invalid.");
      }

      if (nonce && payload.nonce !== nonce) {
        throw new UnauthorizedException("Nonce Apple invalid.");
      }

      return payload;
    } catch (error) {
      if (error instanceof UnauthorizedException) {
        throw error;
      }

      throw new UnauthorizedException("Token Apple invalid sau expirat.");
    }
  }

  private async verifyGoogleIdToken(
    googleLoginDto: GoogleLoginDto,
  ): Promise<GoogleIdentityPayload> {
    const audiences = this.googleClientIds();

    try {
      const { payload } = await jwtVerify<GoogleIdentityPayload>(
        googleLoginDto.idToken,
        googleJwks,
        {
          issuer: ["https://accounts.google.com", "accounts.google.com"],
          audience: audiences,
        },
      );

      if (!payload.sub) {
        throw new UnauthorizedException("Token Google invalid.");
      }

      return payload;
    } catch (error) {
      if (error instanceof UnauthorizedException) {
        throw error;
      }

      throw new UnauthorizedException("Token Google invalid sau expirat.");
    }
  }

  private appleClientIds(): string[] {
    const rawClientIds =
      this.configService.get<string>("APPLE_CLIENT_IDS") ??
      this.configService.get<string>("APPLE_CLIENT_ID");

    const clientIds = rawClientIds
      ?.split(",")
      .map((value) => value.trim())
      .filter(Boolean);

    if (!clientIds?.length) {
      throw new BadRequestException(
        "Lipseste APPLE_CLIENT_ID sau APPLE_CLIENT_IDS din configuratia backend.",
      );
    }

    return clientIds;
  }

  private googleClientIds(): string[] {
    const rawClientIds =
      this.configService.get<string>("GOOGLE_CLIENT_IDS") ??
      this.configService.get<string>("GOOGLE_CLIENT_ID");

    const clientIds = rawClientIds
      ?.split(",")
      .map((value) => value.trim())
      .filter(Boolean);

    if (!clientIds?.length) {
      throw new BadRequestException(
        "Lipseste GOOGLE_CLIENT_ID sau GOOGLE_CLIENT_IDS din configuratia backend.",
      );
    }

    return clientIds;
  }

  private appleDisplayName(fullName: string | undefined, email: string): string {
    const trimmedName = fullName?.trim();
    if (trimmedName) {
      return trimmedName;
    }

    return email.split("@")[0] || "Apple User";
  }

  private googleDisplayName(
    fullName: string | undefined,
    googleName: string | undefined,
    email: string,
  ): string {
    const trimmedName = fullName?.trim() || googleName?.trim();
    if (trimmedName) {
      return trimmedName;
    }

    return email.split("@")[0] || "Google User";
  }
}
