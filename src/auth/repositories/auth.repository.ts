import { Injectable } from '@nestjs/common';
import { GuestRelation } from '@prisma/client';
import { OAuthProvider, SessionType } from '@prisma/client';
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

  async createGuest(data: {
    eventId: string;
    name: string;
    passwordHash: string;
    relation?: GuestRelation;
  }) {
    return this.prisma.guest.create({
      data: {
        eventId: data.eventId,
        name: data.name,
        passwordHash: data.passwordHash,
        relation: data.relation,
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

  async updateAuthSessionRefreshToken(
    sessionId: string,
    refreshTokenHash: string,
    expiresAt: Date,
  ) {
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

  async findEventById(id: string) {
    return this.prisma.event.findUnique({ where: { id } });
  }

  async upsertOAuthUser(
    provider: OAuthProvider,
    profile: {
      providerUserId: string;
      email?: string | null;
      displayName?: string | null;
      profileImageUrl?: string | null;
      accessToken?: string | null;
      refreshToken?: string | null;
    },
  ) {
    return this.prisma.$transaction(async (tx) => {
      const existingAccount = await tx.oAuthAccount.findUnique({
        where: {
          provider_providerUserId: {
            provider,
            providerUserId: profile.providerUserId,
          },
        },
        include: { user: true },
      });

      if (existingAccount?.user) {
        await tx.oAuthAccount.update({
          where: { id: existingAccount.id },
          data: {
            email: profile.email,
            displayName: profile.displayName,
            profileImageUrl: profile.profileImageUrl,
            accessToken: profile.accessToken,
            refreshToken: profile.refreshToken,
          },
        });

        return existingAccount.user;
      }

      const matchedUser = profile.email
        ? await tx.user.findUnique({ where: { email: profile.email } })
        : null;

      const user =
        matchedUser ??
        (await tx.user.create({
          data: {
            email: profile.email,
            name: profile.displayName,
          },
        }));

      await tx.oAuthAccount.create({
        data: {
          provider,
          providerUserId: profile.providerUserId,
          email: profile.email,
          displayName: profile.displayName,
          profileImageUrl: profile.profileImageUrl,
          accessToken: profile.accessToken,
          refreshToken: profile.refreshToken,
          userId: user.id,
        },
      });

      return user;
    });
  }
}
