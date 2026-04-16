import { IsNotEmpty, IsString, MinLength } from 'class-validator';

export class GuestLoginDto {
  @IsString()
  @IsNotEmpty()
  eventId!: string;

  @IsString()
  @IsNotEmpty()
  name!: string;

  @IsString()
  @MinLength(1)
  password!: string;
}
