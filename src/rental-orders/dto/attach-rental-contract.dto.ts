import { IsNotEmpty, IsOptional, IsString } from "class-validator";

export class AttachRentalContractDto {
  @IsString()
  @IsNotEmpty()
  key!: string;

  @IsOptional()
  @IsString()
  url?: string;

  @IsOptional()
  @IsString()
  contentType?: string;
}
