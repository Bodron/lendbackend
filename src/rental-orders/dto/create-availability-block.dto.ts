import { IsISO8601, IsOptional, IsString, MaxLength } from "class-validator";

export class CreateAvailabilityBlockDto {
  @IsISO8601()
  startDate!: string;

  @IsISO8601()
  endDate!: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  reason?: string;
}
