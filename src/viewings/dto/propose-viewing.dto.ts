import { IsDateString } from "class-validator";

export class ProposeViewingDto {
  @IsDateString()
  startsAt!: string;
}
