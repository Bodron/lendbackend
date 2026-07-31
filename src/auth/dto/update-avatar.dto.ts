import { IsOptional, IsString, IsUrl } from "class-validator";

export class UpdateAvatarDto {
  @IsUrl({ require_tld: false })
  avatarUrl!: string;

  @IsOptional()
  @IsString()
  avatarKey?: string;
}
