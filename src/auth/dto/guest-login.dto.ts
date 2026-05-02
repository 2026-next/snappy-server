import { IsNotEmpty, IsString, MinLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class GuestLoginDto {
  @ApiProperty({
    description: 'Event ID that the guest belongs to',
    example: 'event_1',
  })
  @IsString()
  @IsNotEmpty()
  eventId!: string;

  @ApiProperty({
    description: "Guest's display name",
    example: '김민준',
  })
  @IsString()
  @IsNotEmpty()
  name!: string;

  @ApiProperty({
    description: "Guest's password",
    example: '12345678',
  })
  @IsString()
  @MinLength(1)
  password!: string;
}
