import { IsOptional, IsString, MinLength } from "class-validator";

export class GoogleLoginDto {
  @IsString()
  @MinLength(20)
  idToken!: string;

  @IsOptional()
  @IsString()
  fullName?: string;
}
