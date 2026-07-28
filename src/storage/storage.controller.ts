import {
  Body,
  Controller,
  Headers,
  Post,
  UnauthorizedException,
} from "@nestjs/common";
import { AuthService } from "../auth/auth.service";
import { CreateUploadUrlDto } from "./dto/create-upload-url.dto";
import { S3StorageService } from "./s3-storage.service";

@Controller("storage")
export class StorageController {
  constructor(
    private readonly storageService: S3StorageService,
    private readonly authService: AuthService,
  ) {}

  @Post("uploads")
  createUploadUrl(
    @Headers("authorization") authorization: string | undefined,
    @Body() dto: CreateUploadUrlDto,
  ) {
    const userId = this.getUserId(authorization);
    return this.storageService.createPresignedUpload({ ...dto, userId });
  }

  private getUserId(authorization?: string): string {
    const [type, token] = authorization?.split(" ") ?? [];

    if (type !== "Bearer" || !token) {
      throw new UnauthorizedException("Lipseste tokenul de autentificare.");
    }

    return this.authService.verifyToken(token).sub;
  }
}
