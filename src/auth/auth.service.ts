import { Injectable, UnauthorizedException } from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import { compare, hash } from "bcryptjs";
import { S3StorageService } from "../storage/s3-storage.service";
import { SafeUser, UsersService } from "../users/users.service";
import { LoginDto } from "./dto/login.dto";
import { RegisterDto } from "./dto/register.dto";
import { UpdateAvatarDto } from "./dto/update-avatar.dto";

type AuthResponse = {
  accessToken: string;
  user: SafeUser;
};

@Injectable()
export class AuthService {
  constructor(
    private readonly usersService: UsersService,
    private readonly jwtService: JwtService,
    private readonly s3StorageService: S3StorageService,
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
}
