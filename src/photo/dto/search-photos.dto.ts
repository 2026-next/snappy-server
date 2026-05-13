import { Transform, Type } from 'class-transformer';
import {
  ArrayUnique,
  IsArray,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Length,
  Min,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export const SEARCH_FIELD_VALUES = ['name', 'message', 'tags'] as const;
export type SearchField = (typeof SEARCH_FIELD_VALUES)[number];

export class SearchPhotosQueryDto {
  @ApiProperty({ description: 'Event ID' })
  @IsString()
  @IsNotEmpty()
  eventId!: string;

  @ApiProperty({
    description:
      'Free-text query (1..100 chars). Matched against uploader name, attached message, and tags (when available).',
    minLength: 1,
    maxLength: 100,
  })
  @IsString()
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @IsNotEmpty()
  @Length(1, 100)
  q!: string;

  @ApiPropertyOptional({ description: 'Offset', default: 0 })
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @IsOptional()
  offset = 0;

  @ApiPropertyOptional({ description: 'Page Number', default: 1 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @IsOptional()
  page = 1;

  @ApiPropertyOptional({
    description: 'Sorting Order by photo.createdAt',
    enum: ['asc', 'desc'],
    default: 'desc',
  })
  @IsIn(['asc', 'desc'])
  @IsOptional()
  order: 'asc' | 'desc' = 'desc';

  @ApiPropertyOptional({
    description:
      'Comma-separated list of fields to match. Allowed: name, message, tags.',
    enum: SEARCH_FIELD_VALUES,
    isArray: true,
    default: ['name', 'message', 'tags'],
  })
  @Transform(({ value }: { value: unknown }): unknown => {
    if (Array.isArray(value)) {
      return value as unknown[];
    }
    if (typeof value !== 'string') {
      return value;
    }
    return value
      .split(',')
      .map((field) => field.trim())
      .filter((field) => field.length > 0);
  })
  @IsArray()
  @ArrayUnique()
  @IsIn(SEARCH_FIELD_VALUES, { each: true })
  @IsOptional()
  fields: SearchField[] = ['name', 'message', 'tags'];
}
