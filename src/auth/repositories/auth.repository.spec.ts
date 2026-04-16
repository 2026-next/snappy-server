import { Test, TestingModule } from '@nestjs/testing';
import { AuthRepository } from './auth.repository';
import { PrismaService } from '../../prisma/prisma.service';

describe('AuthRepository', () => {
  let repository: AuthRepository;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthRepository,
        {
          provide: PrismaService,
          useValue: {
            guest: {},
            authSession: {},
          },
        },
      ],
    }).compile();

    repository = module.get<AuthRepository>(AuthRepository);
  });

  it('should be defined', () => {
    expect(repository).toBeDefined();
  });
});
