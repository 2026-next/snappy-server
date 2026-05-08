import {
  ArrayMaxSize,
  ArrayUnique,
  IsArray,
  IsString,
} from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class PhotoGroupPhotosDto {
  @ApiProperty({ description: 'Photo IDs', type: [String] })
  @IsArray()
  @ArrayMaxSize(500)
  @ArrayUnique()
  @IsString({ each: true })
  photoIds!: string[];
}
