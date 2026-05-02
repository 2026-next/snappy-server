import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, MinLength } from 'class-validator';

export class UpdateUserDto {
  @ApiPropertyOptional({
    description: 'User display name',
    example: '민준',
  })
  @IsOptional()
  @IsString()
  @MinLength(1)
  name?: string;
}
