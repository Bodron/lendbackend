import {
  ArrayMaxSize,
  IsArray,
  IsInt,
  IsNumber,
  Matches,
  IsOptional,
  IsIn,
  IsString,
  Max,
  Min,
  ValidateNested,
} from "class-validator";
import { Type } from "class-transformer";
import { ProductMediaDto } from "./product-media.dto";

export class UpdateProductDto {
  @IsOptional()
  @IsString()
  title?: string;

  @IsOptional()
  @IsString()
  category?: string;

  @IsOptional()
  @IsString()
  categorySlug?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(100000)
  pricePerDay?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(1000000)
  pricePerMonth?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(100000)
  deposit?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(100)
  stockQuantity?: number;

  @IsOptional()
  @IsString()
  city?: string;

  @IsOptional()
  @IsString()
  address?: string;

  @IsOptional()
  @IsNumber()
  latitude?: number;

  @IsOptional()
  @IsNumber()
  longitude?: number;

  @IsOptional()
  @IsIn(["local", "national"])
  availabilityScope?: "local" | "national";

  @IsOptional()
  @IsString()
  @Matches(/^([01]\d|2[0-3]):[0-5]\d$/)
  pickupTime?: string;

  @IsOptional()
  @IsString()
  @Matches(/^([01]\d|2[0-3]):[0-5]\d$/)
  returnTime?: string;

  @IsOptional()
  @IsArray()
  @IsIn(["hour", "day", "month"], { each: true })
  rentalModes?: ("hour" | "day" | "month")[];

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(8)
  @ValidateNested({ each: true })
  @Type(() => ProductMediaDto)
  media?: ProductMediaDto[];
}
