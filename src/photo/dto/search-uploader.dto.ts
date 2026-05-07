import { IsNotEmpty, IsString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class SearchUploaderDto {
  @ApiProperty({ description: 'Event ID' })
  @IsString()
  @IsNotEmpty()
  eventId!: string;

  @ApiProperty({ description: 'Uploader Name (partial match)' })
  @IsString()
  @IsNotEmpty()
  name!: string;
}
