import { IsMongoId, IsString, MaxLength, MinLength } from "class-validator";

export class CreateMessageDto {
  @IsMongoId()
  productId!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(2000)
  body!: string;
}
