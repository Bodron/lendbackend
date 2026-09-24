import {
  ArrayMaxSize,
  IsArray,
  IsInt,
  IsNumber,
  Matches,
  IsNotEmpty,
  IsIn,
  IsOptional,
  IsString,
  Max,
  Min,
  ValidateNested,
} from "class-validator";
import { Type } from "class-transformer";
import { ProductMediaDto } from "./product-media.dto";

export class CreateProductDto {
  @IsString()
  @IsNotEmpty()
  title!: string;

  @IsString()
  @IsNotEmpty()
  category!: string;

  @IsString()
  @IsNotEmpty()
  categorySlug!: string;

  @IsString()
  @IsNotEmpty()
  description!: string;

  @IsInt()
  @Min(1)
  @Max(100000)
  pricePerDay!: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(1000000)
  pricePerMonth?: number;

  @IsInt()
  @Min(0)
  @Max(100000)
  deposit!: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(100)
  stockQuantity?: number;

  @IsString()
  @IsNotEmpty()
  city!: string;

  @IsString()
  @IsNotEmpty()
  address!: string;

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
