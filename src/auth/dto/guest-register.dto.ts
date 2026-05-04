import {
  IsInt,
  IsNotEmpty,
  IsString,
  Max,
  Min,
  MinLength,
} from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export enum GuestRelationCode {
  PARENT = 1,
  FRIEND = 2,
  SIBLING = 3,
  RELATIVE = 4,
  COWORKER = 5,
  ACQUAINTANCE = 6,
  OTHER = 7,
}

export class GuestRegisterDto {
  @ApiProperty({
    description: 'Event ID that the guest belongs to',
    example: 'cmoohra6a000115zyl8cnomj2',
  })
  @IsString()
  @IsNotEmpty()
  eventId!: string;

  @ApiProperty({ description: "Guest's name", example: '김민준' })
  @IsString()
  @IsNotEmpty()
  name!: string;

  @ApiProperty({ description: "Guest's password", example: '12345678' })
  @IsString()
  @MinLength(1)
  password!: string;

  @ApiProperty({
    description:
      'Relation to the owner: 1=PARENT, 2=FRIEND, 3=SIBLING, 4=RELATIVE, 5=COWORKER, 6=ACQUAINTANCE, 7=OTHER',
    enum: GuestRelationCode,
    example: GuestRelationCode.FRIEND,
  })
  @IsInt()
  @Min(GuestRelationCode.PARENT)
  @Max(GuestRelationCode.OTHER)
  relation!: GuestRelationCode;
}
