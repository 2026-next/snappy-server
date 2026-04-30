import { ForbiddenException, Injectable } from '@nestjs/common';
import { SessionType } from '@prisma/client';
import { UpdateUserDto } from './dto/update-user.dto';
import { UserRepository } from './repositories/user.repository';
import type { AccessTokenPayload } from '../auth/types/token-payload.types';

@Injectable()
export class UserService {
  constructor(private readonly userRepository: UserRepository) {}

  async updateMe(payload: AccessTokenPayload, updateUserDto: UpdateUserDto) {
    if (payload.sessionType !== SessionType.USER) {
      throw new ForbiddenException('User session is required');
    }

    return this.userRepository.update(payload.sub, updateUserDto);
  }
}
