import { IsIn, IsOptional } from "class-validator";

export class RequestPayoutDto {
  @IsOptional()
  @IsIn(["individual", "company"])
  businessType?: "individual" | "company";
}
