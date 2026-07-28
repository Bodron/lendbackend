import { IsEnum } from "class-validator";
import { RentalOrderStatus } from "../schemas/rental-order.schema";

export class UpdateRentalOrderStatusDto {
  @IsEnum(RentalOrderStatus)
  status!: RentalOrderStatus;
}
