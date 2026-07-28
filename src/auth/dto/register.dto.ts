import {
  IsEmail,
  IsNotEmpty,
  IsPhoneNumber,
  IsString,
  MinLength,
} from "class-validator";

export class RegisterDto {
  @IsString()
  @IsNotEmpty()
  fullName!: string;

  @IsEmail()
  email!: string;

  @IsPhoneNumber("RO")
  phone!: string;

  @IsString()
  @MinLength(8)
  password!: string;
}
