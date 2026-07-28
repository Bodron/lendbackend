import {
  ArrayMaxSize,
  IsArray,
  IsInt,
  IsNotEmpty,
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

  @IsInt()
  @Min(0)
  @Max(100000)
  deposit!: number;

  @IsString()
  @IsNotEmpty()
  city!: string;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(8)
  @ValidateNested({ each: true })
  @Type(() => ProductMediaDto)
  media?: ProductMediaDto[];
}
