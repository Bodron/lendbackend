import { IsIn, IsOptional, IsString } from "class-validator";

export class ProductMediaDto {
  @IsString()
  key!: string;

  @IsString()
  url!: string;

  @IsString()
  alt!: string;

  @IsString()
  contentType!: string;

  @IsIn(["image", "video"])
  type!: "image" | "video";

  @IsOptional()
  @IsString()
  thumbnailKey?: string;
}
