import { IsDateString, IsMongoId } from "class-validator";

export class CreateRentalOrderDto {
  @IsMongoId()
  productId!: string;

  @IsDateString()
  startDate!: string;

  @IsDateString()
  endDate!: string;
}
