import {
  IsArray,
  IsInt,
  IsMongoId,
  IsNotEmpty,
  IsOptional,
  IsString,
  Max,
  Min,
} from "class-validator";

export class CreateRoommatePostDto {
  @IsOptional()
  @IsMongoId()
  productId?: string;

  @IsString()
  @IsNotEmpty()
  title!: string;

  @IsString()
  @IsNotEmpty()
  city!: string;

  @IsOptional()
  @IsString()
  area?: string;

  @IsInt()
  @Min(1)
  @Max(100000)
  budgetPerMonth!: number;

  @IsOptional()
  @IsString()
  moveInDate?: string;

  @IsString()
  @IsNotEmpty()
  description!: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  preferences?: string[];
}
