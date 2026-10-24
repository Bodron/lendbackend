import { ArrayMaxSize, IsArray, IsMongoId } from "class-validator";

export class ImportFavoritesDto {
  @IsArray()
  @ArrayMaxSize(200)
  @IsMongoId({ each: true })
  productIds!: string[];
}
