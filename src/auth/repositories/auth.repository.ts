import { Injectable } from '@nestjs/common';
import { SessionType } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class AuthRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findGuestByEventIdAndName(eventId: string, name: string) {
    return this.prisma.guest.findUnique({
      where: {
        eventId_name: {
          eventId,
          name,
        },
      },
    });
  }

  async createGuest(data: { eventId: string; name: string; passwordHash: string }) {
    return this.prisma.guest.create({
      data: {
        eventId: data.eventId,
        name: data.name,
        passwordHash: data.passwordHash,
      },
    });
  }

  async createAuthSession(data: {
    sessionType: SessionType;
    guestId?: string;
    userId?: string;
    expiresAt: Date;
  }) {
    return this.prisma.authSession.create({
      data: {
        sessionType: data.sessionType,
        guestId: data.guestId,
        userId: data.userId,
        expiresAt: data.expiresAt,
      },
    });
  }

  async findAuthSessionByIdWithRelations(sessionId: string) {
    return this.prisma.authSession.findUnique({
      where: { id: sessionId },
      include: {
        guest: {
          select: {
            id: true,
            name: true,
            eventId: true,
            createdAt: true,
            updatedAt: true,
          },
        },
        user: {
          select: {
            id: true,
            email: true,
            name: true,
            createdAt: true,
            updatedAt: true,
          },
        },
      },
    });
  }

  async updateAuthSessionRefreshToken(sessionId: string, refreshTokenHash: string, expiresAt: Date) {
    return this.prisma.authSession.update({
      where: { id: sessionId },
      data: {
        refreshTokenHash,
        expiresAt,
      },
    });
  }

  async revokeAuthSession(sessionId: string) {
    return this.prisma.authSession.updateMany({
      where: {
        id: sessionId,
        revokedAt: null,
      },
      data: {
        revokedAt: new Date(),
      },
    });
  }
}
