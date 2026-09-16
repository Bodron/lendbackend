import { IsIn } from "class-validator";

export class RequestPayoutDto {
  @IsIn(["individual", "company"])
  businessType?: "individual" | "company";
}
