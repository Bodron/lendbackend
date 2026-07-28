import { Injectable, UnauthorizedException } from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import { compare, hash } from "bcryptjs";
import { SafeUser, UsersService } from "../users/users.service";
import { LoginDto } from "./dto/login.dto";
import { RegisterDto } from "./dto/register.dto";

type AuthResponse = {
  accessToken: string;
  user: SafeUser;
};

@Injectable()
export class AuthService {
  constructor(
    private readonly usersService: UsersService,
    private readonly jwtService: JwtService,
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

    return user;
  }

  verifyToken(token: string): { sub: string; email: string } {
    return this.jwtService.verify<{ sub: string; email: string }>(token);
  }

  private createAuthResponse(user: SafeUser): AuthResponse {
    return {
      accessToken: this.jwtService.sign({
        sub: user.id,
        email: user.email,
      }),
      user,
    };
  }
}
