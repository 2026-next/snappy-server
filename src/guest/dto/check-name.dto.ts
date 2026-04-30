import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';

export class CheckGuestNameDto {
  @ApiProperty({
    description: 'Event ID',
    example: 'clw123eventid',
  })
  @IsString()
  @IsNotEmpty()
  eventId!: string;

  @ApiProperty({
    description: 'Guest name',
    example: '김민준',
  })
  @IsString()
  @IsNotEmpty()
  name!: string;
}