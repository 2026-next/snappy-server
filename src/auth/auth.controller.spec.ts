import { Test, TestingModule } from '@nestjs/testing';
import { JwtService } from '@nestjs/jwt';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { AccessTokenGuard } from './guards/access-token.guard';
import { AuthRepository } from './repositories/auth.repository';
import { PrismaService } from '../prisma/prisma.service';

describe('AuthController', () => {
  let controller: AuthController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [AuthController],
      providers: [
        {
          provide: AuthService,
          useValue: {
            guestLogin: jest.fn(),
            refresh: jest.fn(),
            me: jest.fn(),
            logout: jest.fn(),
          },
        },
        {
          provide: AccessTokenGuard,
          useValue: {
            canActivate: jest.fn().mockResolvedValue(true),
          },
        },
        {
          provide: JwtService,
          useValue: {},
        },
        {
          provide: AuthRepository,
          useValue: {
            findGuestByEventIdAndName: jest.fn(),
            createAuthSession: jest.fn(),
            findAuthSessionByIdWithRelations: jest.fn(),
            updateAuthSessionRefreshToken: jest.fn(),
            revokeAuthSession: jest.fn(),
          },
        },
        {
          provide: PrismaService,
          useValue: {
            authSession: {},
          },
        },
      ],
    }).compile();

    controller = module.get<AuthController>(AuthController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
