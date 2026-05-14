import { Transform } from 'class-transformer';
import {
  ArrayUnique,
  IsArray,
  IsIn,
  IsNotEmpty,
  IsOptional,
  IsString,
  Length,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export const SEARCH_FIELD_VALUES = ['name', 'message', 'tags'] as const;
export type SearchField = (typeof SEARCH_FIELD_VALUES)[number];

export class SearchPhotosQueryDto {
  @ApiProperty({
    description: 'Event ID to scope the search to.',
    example: 'event-uuid',
  })
  @IsString()
  @IsNotEmpty()
  eventId!: string;

  @ApiProperty({
    description:
      'Free-text query (1..100 chars, trimmed). Matched case-insensitively against the selected `fields`. LIKE wildcards (`%`, `_`, `\\`) are escaped server-side.',
    minLength: 1,
    maxLength: 100,
    example: '민준',
  })
  @IsString()
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @IsNotEmpty()
  @Length(1, 100)
  q!: string;

  @ApiPropertyOptional({
    description: 'Sorting order applied to `photo.createdAt`.',
    enum: ['asc', 'desc'],
    default: 'desc',
    example: 'desc',
  })
  @IsIn(['asc', 'desc'])
  @IsOptional()
  order: 'asc' | 'desc' = 'desc';

  @ApiPropertyOptional({
    description:
      'Comma-separated list of fields to match. Allowed values: `name` (uploader name), `message` (message authored by the uploader), `tags` (no-op until the Tag schema is added). Send as repeated query params or a comma-separated string, e.g. `fields=name,message`.',
    enum: SEARCH_FIELD_VALUES,
    isArray: true,
    default: ['name', 'message', 'tags'],
    example: ['name', 'message'],
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
