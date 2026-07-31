import {
  Body,
  Controller,
  Get,
  Headers,
  Patch,
  Post,
  UnauthorizedException,
} from "@nestjs/common";
import { AuthService } from "./auth.service";
import { LoginDto } from "./dto/login.dto";
import { RegisterDto } from "./dto/register.dto";
import { UpdateAvatarDto } from "./dto/update-avatar.dto";

@Controller("auth")
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post("register")
  register(@Body() registerDto: RegisterDto) {
    return this.authService.register(registerDto);
  }

  @Post("login")
  login(@Body() loginDto: LoginDto) {
    return this.authService.login(loginDto);
  }

  @Get("me")
  me(@Headers("authorization") authorization?: string) {
    const token = this.extractBearerToken(authorization);
    const payload = this.authService.verifyToken(token);
    return this.authService.getProfile(payload.sub);
  }

  @Patch("me/avatar")
  updateAvatar(
    @Headers("authorization") authorization: string | undefined,
    @Body() updateAvatarDto: UpdateAvatarDto,
  ) {
    const token = this.extractBearerToken(authorization);
    const payload = this.authService.verifyToken(token);
    return this.authService.updateAvatar(payload.sub, updateAvatarDto);
  }

  private extractBearerToken(authorization?: string): string {
    const [type, token] = authorization?.split(" ") ?? [];

    if (type !== "Bearer" || !token) {
      throw new UnauthorizedException("Lipsește tokenul de autentificare.");
    }

    return token;
  }
}
