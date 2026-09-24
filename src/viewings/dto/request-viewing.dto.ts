import { IsDateString, IsMongoId } from "class-validator";

export class RequestViewingDto {
  @IsMongoId()
  productId!: string;

  @IsDateString()
  startsAt!: string;
}
