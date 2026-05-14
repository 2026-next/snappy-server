import { Injectable } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';

export type CreatePhotoData = {
  eventId: string;
  guestId?: string | null;
  originalObjectKey: string;
  mimeType?: string;
  fileSizeBytes?: number;
  width?: number;
  height?: number;
  exifTakenAt?: Date;
  embedding: number[];
};

export type CreatePhotoGroupData = {
  eventId: string;
  userId: string;
  name: string;
  photoIds?: string[];
};

/**
 * Common predicate applied to every host-facing photo query so photos that the
 * host has hidden (via DELETE /photo/host/:photoId) disappear from album views,
 * timelines, favorites, groupings, search, photo detail, and photo groups.
 * Guest-facing endpoints (e.g. /photo/my) intentionally do NOT use this so the
 * uploader still sees their own photo.
 */
const VISIBLE_TO_HOST = { hiddenByHostAt: null } as const;

@Injectable()
export class PhotoRepository {
  constructor(private readonly prisma: PrismaService) {}

  async createPhoto(data: CreatePhotoData) {
    return this.prisma.photo.create({
      data: {
        eventId: data.eventId,
        uploadedByGuestId: data.guestId ?? null,
        originalObjectKey: data.originalObjectKey,
        mimeType: data.mimeType,
        fileSizeBytes: data.fileSizeBytes,
        width: data.width,
        height: data.height,
        exifTakenAt: data.exifTakenAt,
        embedding: data.embedding,
      },
    });
  }

  async findEventOwnedByUser(eventId: string, userId: string) {
    return this.prisma.event.findFirst({
      where: { id: eventId, ownerId: userId },
      select: { id: true },
    });
  }

  async findGuestById(guestId: string) {
    return this.prisma.guest.findUnique({
      where: { id: guestId },
      select: { id: true, name: true, eventId: true },
    });
  }

  async findAllByEvent(eventId: string, onlyFavorites: boolean = false) {
    return this.prisma.photo.findMany({
      where: {
        eventId,
        isDeleted: false,
        ...VISIBLE_TO_HOST,
        ...(onlyFavorites && { isFavorite: true }),
      },
      include: {
        uploadedByGuest: {
          select: { id: true, name: true, relation: true },
        },
      },
      orderBy: { uploadedAt: 'desc' },
    });
  }

  async findAllByEventOrdered(eventId: string, order: Prisma.SortOrder) {
    return this.prisma.photo.findMany({
      where: { eventId, isDeleted: false, ...VISIBLE_TO_HOST },
      include: {
        uploadedByGuest: {
          select: { id: true, name: true, relation: true },
        },
      },
      orderBy: { uploadedAt: order },
    });
  }

  async findPhotosByGuest(guestId: string, eventId: string) {
    return this.prisma.photo.findMany({
      where: {
        uploadedByGuestId: guestId,
        eventId,
        isDeleted: false,
      },
      orderBy: { uploadedAt: 'desc' },
    });
  }

  async findOne(id: string) {
    return this.prisma.photo.findUnique({
      where: { id },
    });
  }

  async findGuestPhoto(photoId: string, guestId: string, eventId: string) {
    return this.prisma.photo.findFirst({
      where: {
        id: photoId,
        uploadedByGuestId: guestId,
        eventId,
        isDeleted: false,
      },
    });
  }

  async softDeletePhoto(id: string) {
    return this.prisma.photo.update({
      where: { id },
      data: { isDeleted: true, deletedAt: new Date() },
    });
  }

  async findTimelineByEvent(eventId: string) {
    return this.prisma.photo.findMany({
      where: { eventId, isDeleted: false, ...VISIBLE_TO_HOST },
      include: {
        uploadedByGuest: {
          select: { id: true, name: true, relation: true },
        },
      },
      orderBy: [{ exifTakenAt: 'asc' }, { uploadedAt: 'asc' }],
    });
  }

  async findEmbeddingsByEvent(eventId: string) {
    return this.prisma.photo.findMany({
      where: { eventId, isDeleted: false, ...VISIBLE_TO_HOST },
      select: {
        id: true,
        originalObjectKey: true,
        uploadedAt: true,
        exifTakenAt: true,
        uploadedByGuestId: true,
        uploadedByGuest: {
          select: { id: true, name: true, relation: true },
        },
        embedding: true,
      },
    });
  }

  async findPhotoDetailForOwner(photoId: string, userId: string) {
    return this.prisma.photo.findFirst({
      where: {
        id: photoId,
        isDeleted: false,
        ...VISIBLE_TO_HOST,
        event: { ownerId: userId },
      },
      include: {
        uploadedByGuest: {
          select: {
            id: true,
            name: true,
            relation: true,
            messages: {
              select: {
                id: true,
                content: true,
                createdAt: true,
                updatedAt: true,
              },
              take: 1,
            },
          },
        },
        event: { select: { id: true, name: true } },
      },
    });
  }

  async searchUploaders(eventId: string, name: string) {
    return this.prisma.photo.findMany({
      where: {
        eventId,
        isDeleted: false,
        ...VISIBLE_TO_HOST,
        uploadedByGuest: { name: { contains: name, mode: 'insensitive' } },
      },
      include: {
        uploadedByGuest: {
          select: { id: true, name: true, relation: true },
        },
      },
      orderBy: { uploadedAt: 'desc' },
    });
  }

  async searchPhotosByEvent(params: {
    eventId: string;
    query: string;
    includeName: boolean;
    includeMessage: boolean;
    order: Prisma.SortOrder;
  }) {
    const { eventId, query, includeName, includeMessage, order } = params;

    const orClauses: Prisma.PhotoWhereInput[] = [];
    if (includeName) {
      orClauses.push({
        uploadedByGuest: {
          name: { contains: query, mode: 'insensitive' },
        },
      });
    }
    if (includeMessage) {
      orClauses.push({
        uploadedByGuest: {
          messages: {
            some: { content: { contains: query, mode: 'insensitive' } },
          },
        },
      });
    }

    if (orClauses.length === 0) {
      return [];
    }

    const where: Prisma.PhotoWhereInput = {
      eventId,
      isDeleted: false,
      ...VISIBLE_TO_HOST,
      OR: orClauses,
    };

    const uploaderSelect: Prisma.GuestSelect = {
      id: true,
      name: true,
      relation: true,
    };

    if (includeMessage) {
      uploaderSelect.messages = {
        where: { content: { contains: query, mode: 'insensitive' } },
        select: { content: true },
        take: 1,
      };
    }

    return this.prisma.photo.findMany({
      where,
      include: { uploadedByGuest: { select: uploaderSelect } },
      orderBy: { createdAt: order },
    });
  }

  async findPhotoForOwner(photoId: string, userId: string) {
    return this.prisma.photo.findFirst({
      where: {
        id: photoId,
        isDeleted: false,
        ...VISIBLE_TO_HOST,
        event: { ownerId: userId },
      },
    });
  }

  /**
   * Like {@link findPhotoForOwner} but does not exclude photos that the host
   * has already hidden. Used by the host-delete endpoint so re-issuing
   * DELETE /photo/host/:id stays idempotent (returns the same 204) instead of
   * 404ing on the second call.
   */
  async findPhotoForHostIncludingHidden(photoId: string, userId: string) {
    return this.prisma.photo.findFirst({
      where: {
        id: photoId,
        isDeleted: false,
        event: { ownerId: userId },
      },
      select: { id: true, hiddenByHostAt: true },
    });
  }

  async markPhotoHiddenByHost(photoId: string, hiddenAt: Date = new Date()) {
    return this.prisma.photo.update({
      where: { id: photoId },
      data: { hiddenByHostAt: hiddenAt },
      select: { id: true, hiddenByHostAt: true },
    });
  }

  /**
   * Lightweight host-owner lookup used by the file-replace flow. Returns just
   * the fields needed to authorize the call and to delete the old object after
   * the swap. Soft-deleted or host-hidden photos are excluded.
   */
  async findPhotoForHostReplacement(photoId: string, userId: string) {
    return this.prisma.photo.findFirst({
      where: {
        id: photoId,
        isDeleted: false,
        ...VISIBLE_TO_HOST,
        event: { ownerId: userId },
      },
      select: { id: true, eventId: true, originalObjectKey: true },
    });
  }

  /**
   * Atomically swap the photo's underlying file. The Photo row is updated in
   * place (preserving id, eventId, uploader, message, group memberships,
   * favorite status, createdAt, uploadedAt, exifTakenAt). The matching
   * isOriginal PhotoVersion row, if any, is updated to point at the new
   * fileKey so the version index stays consistent with Photo.originalObjectKey.
   */
  async replacePhotoFile(
    photoId: string,
    data: {
      originalObjectKey: string;
      mimeType: string;
      fileSizeBytes: number | null;
      width: number | null;
      height: number | null;
    },
  ) {
    return this.prisma.$transaction(async (tx) => {
      const photo = await tx.photo.update({
        where: { id: photoId },
        data: {
          originalObjectKey: data.originalObjectKey,
          mimeType: data.mimeType,
          fileSizeBytes: data.fileSizeBytes,
          width: data.width,
          height: data.height,
        },
      });

      await tx.photoVersion.updateMany({
        where: { photoId, isOriginal: true },
        data: {
          fileKey: data.originalObjectKey,
          width: data.width,
          height: data.height,
        },
      });

      return photo;
    });
  }

  async createPhotoGroup(data: CreatePhotoGroupData) {
    return this.prisma.photoGroup.create({
      data: {
        eventId: data.eventId,
        createdByUserId: data.userId,
        name: data.name,
        photos: data.photoIds?.length
          ? {
              createMany: {
                data: data.photoIds.map((photoId) => ({ photoId })),
                skipDuplicates: true,
              },
            }
          : undefined,
      },
      include: { _count: { select: { photos: true } } },
    });
  }

  async findPhotoGroupsByEvent(eventId: string) {
    return this.prisma.photoGroup.findMany({
      where: { eventId },
      include: {
        _count: { select: { photos: true } },
        photos: {
          where: { photo: { ...VISIBLE_TO_HOST } },
          take: 1,
          orderBy: { createdAt: 'asc' },
          include: { photo: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findPhotoGroupForOwner(groupId: string, userId: string) {
    return this.prisma.photoGroup.findFirst({
      where: { id: groupId, event: { ownerId: userId } },
      include: { event: { select: { id: true } } },
    });
  }

  async findPhotosByIdsForEvent(eventId: string, photoIds: string[]) {
    return this.prisma.photo.findMany({
      where: {
        id: { in: photoIds },
        eventId,
        isDeleted: false,
        ...VISIBLE_TO_HOST,
      },
      select: { id: true },
    });
  }

  async addPhotosToGroup(groupId: string, photoIds: string[]) {
    return this.prisma.photoGroupPhoto.createMany({
      data: photoIds.map((photoId) => ({ groupId, photoId })),
      skipDuplicates: true,
    });
  }

  async replaceGroupPhotos(groupId: string, photoIds: string[]) {
    return this.prisma.$transaction(async (tx) => {
      await tx.photoGroupPhoto.deleteMany({ where: { groupId } });
      if (photoIds.length === 0) {
        return { count: 0 };
      }

      return tx.photoGroupPhoto.createMany({
        data: photoIds.map((photoId) => ({ groupId, photoId })),
        skipDuplicates: true,
      });
    });
  }

  async removePhotoFromGroup(groupId: string, photoId: string) {
    return this.prisma.photoGroupPhoto.deleteMany({
      where: { groupId, photoId },
    });
  }

  async findPhotoGroupPhotosPaginated(
    groupId: string,
    skip: number,
    take: number,
    order: Prisma.SortOrder,
  ) {
    const where = {
      groupId,
      photo: { isDeleted: false, ...VISIBLE_TO_HOST },
    };
    const [links, total] = await this.prisma.$transaction([
      this.prisma.photoGroupPhoto.findMany({
        where,
        include: {
          photo: {
            include: {
              uploadedByGuest: {
                select: { id: true, name: true, relation: true },
              },
            },
          },
        },
        orderBy: { photo: { uploadedAt: order } },
        skip,
        take,
      }),
      this.prisma.photoGroupPhoto.count({ where }),
    ]);

    return { photos: links.map((link) => link.photo), total };
  }

  async toggleFavorite(photoId: string, isFavorite: boolean) {
    return this.prisma.photo.update({
      where: { id: photoId },
      data: { isFavorite },
    });
  }

  /**
   * Used by the EXIF worker to back-fill `exifTakenAt` once the worker has
   * extracted the timestamp from the uploaded object. `updateMany` is used so
   * the call is a no-op (instead of throwing P2025) when the photo has been
   * deleted in the meantime.
   */
  async updateExifTakenAt(photoId: string, takenAt: Date) {
    return this.prisma.photo.updateMany({
      where: { id: photoId },
      data: { exifTakenAt: takenAt },
    });
  }
}
