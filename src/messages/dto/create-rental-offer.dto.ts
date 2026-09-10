import { IsDateString, IsIn, IsInt, IsMongoId, IsPositive } from "class-validator";

export class CreateRentalOfferDto {
  @IsMongoId()
  productId!: string;

  @IsInt()
  @IsPositive()
  amount!: number;

  @IsDateString()
  startDate!: string;

  @IsDateString()
  endDate!: string;

  @IsIn(["day", "hour", "month"])
  rentalMode!: "day" | "hour" | "month";
}
