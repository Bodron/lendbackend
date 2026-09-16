import { IsNumber, IsOptional, IsString } from "class-validator";

export class UpdateLocationDto {
  @IsString()
  city!: string;

  @IsOptional()
  @IsNumber()
  latitude?: number;

  @IsOptional()
  @IsNumber()
  longitude?: number;
}
