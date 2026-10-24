import {
  IsMongoId,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from "class-validator";

export class CreateMessageDto {
  @IsMongoId()
  productId!: string;

  @IsOptional()
  @IsMongoId()
  roommateInterestId?: string;

  @IsOptional()
  @IsString()
  recipientId?: string;

  @IsString()
  @MinLength(1)
  @MaxLength(2000)
  body!: string;
}
