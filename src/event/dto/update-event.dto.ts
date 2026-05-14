import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, Length } from 'class-validator';
import { Transform } from 'class-transformer';

export class UpdateEventDto {
  @ApiProperty({
    description: '새 앨범(이벤트) 이름. 앞뒤 공백은 자동으로 제거됩니다.',
    example: '민준 & 지수의 결혼식',
    minLength: 1,
    maxLength: 100,
  })
  @IsString()
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @IsNotEmpty()
  @Length(1, 100)
  name!: string;
}
