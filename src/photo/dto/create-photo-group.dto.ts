import {
  ArrayMaxSize,
  ArrayUnique,
  IsArray,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreatePhotoGroupDto {
  @ApiProperty({ description: 'Event ID' })
  @IsString()
  @IsNotEmpty()
  eventId!: string;

  @ApiProperty({ description: 'Group name', maxLength: 50 })
  @IsString()
  @IsNotEmpty()
  @MaxLength(50)
  name!: string;

  @ApiPropertyOptional({ description: 'Initial photo IDs', type: [String] })
  @IsArray()
  @ArrayUnique()
  @ArrayMaxSize(500)
  @IsString({ each: true })
  @IsOptional()
  photoIds?: string[];
}
