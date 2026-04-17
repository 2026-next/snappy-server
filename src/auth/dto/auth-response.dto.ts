import { ApiProperty } from '@nestjs/swagger';

export class TokenPairResponseDto {
  @ApiProperty({
    description: 'Access token',
    example:
      'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.access_token_example.signature',
  })
  accessToken!: string;

  @ApiProperty({
    description: 'Refresh token',
    example:
      'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.refresh_token_example.signature',
  })
  refreshToken!: string;

  @ApiProperty({
    description: 'Token type',
    example: 'Bearer',
  })
  tokenType!: string;
}

export class MeResponseDto {
  @ApiProperty({
    description: 'Session Type (e.g., GUEST or USER)',
    example: 'GUEST',
  })
  sessionType!: string;

  @ApiProperty({
    description: 'Guest profile object when session type is GUEST',
    required: false,
    type: Object,
  })
  guest?: Record<string, unknown>;

  @ApiProperty({
    description: 'User profile object when session type is USER',
    required: false,
    type: Object,
  })
  user?: Record<string, unknown>;
}

export class LogoutResponseDto {
  @ApiProperty({
    description: 'Has logout succeeded',
    example: true,
  })
  success!: boolean;
}
