import {
  ArrayMaxSize,
  IsArray,
  IsInt,
  IsOptional,
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
  @Min(0)
  @Max(100000)
  deposit?: number;

  @IsOptional()
  @IsString()
  city?: string;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(8)
  @ValidateNested({ each: true })
  @Type(() => ProductMediaDto)
  media?: ProductMediaDto[];
}
