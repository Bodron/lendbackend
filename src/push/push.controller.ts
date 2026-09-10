import { Body, Controller, Delete, Headers, Post, UnauthorizedException } from "@nestjs/common";
import { IsIn, IsString, Length } from "class-validator";
import { AuthService } from "../auth/auth.service";
import { PushService } from "./push.service";

class TokenDto {
  @IsString()
  @Length(20, 4096)
  token!: string;
}
class RegisterDeviceDto extends TokenDto {
  @IsIn(["ios", "android"])
  platform!: string;
}

@Controller("push/devices")
export class PushController {
  constructor(private readonly push: PushService, private readonly auth: AuthService) {}

  private user(authorization?: string) {
    const [scheme, token] = authorization?.split(" ") ?? [];
    if (scheme !== "Bearer" || !token) throw new UnauthorizedException();
    return this.auth.verifyToken(token).sub;
  }

  @Post()
  async register(@Headers("authorization") authorization: string | undefined, @Body() dto: RegisterDeviceDto) {
    await this.push.register(this.user(authorization), dto.token, dto.platform);
    return { ok: true };
  }

  @Delete()
  async remove(@Headers("authorization") authorization: string | undefined, @Body() dto: TokenDto) {
    await this.push.remove(this.user(authorization), dto.token);
    return { ok: true };
  }
}
