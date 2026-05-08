import { Injectable } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';

export type CreatePhotoData = {
  eventId: string;
  guestId: string;
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

@Injectable()
export class PhotoRepository {
  constructor(private readonly prisma: PrismaService) {}

  async createPhoto(data: CreatePhotoData) {
    return this.prisma.photo.create({
      data: {
        eventId: data.eventId,
        uploadedByGuestId: data.guestId,
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
// [기능] 특정 이벤트의 모든 사진 가져오기 (타임라인/즐겨찾기 필터 포함)
  async findAllByEvent(eventId: string, onlyFavorites: boolean = false) {
    return this.prisma.photo.findMany({
      where: {
        eventId,
        isDeleted: false,
        ...(onlyFavorites && { isFavorite: true }),
      },
      include: {
        uploadedByGuest: {
          select: { name: true },
        },
      },
      orderBy: { uploadedAt: 'desc' },
    });
  }

  async findAllByEventPaginated(
    eventId: string,
    skip: number,
    take: number,
    order: Prisma.SortOrder,
  ) {
    const where = { eventId, isDeleted: false };
    const [photos, total] = await this.prisma.$transaction([
      this.prisma.photo.findMany({
        where,
        include: { uploadedByGuest: { select: { name: true } } },
        orderBy: { uploadedAt: order },
        skip,
        take,
      }),
      this.prisma.photo.count({ where }),
    ]);

    return { photos, total };
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
      where: { eventId, isDeleted: false },
      include: { uploadedByGuest: { select: { name: true } } },
      orderBy: [{ exifTakenAt: 'asc' }, { uploadedAt: 'asc' }],
    });
  }

  async findEmbeddingsByEvent(eventId: string) {
    return this.prisma.photo.findMany({
      where: { eventId, isDeleted: false },
      select: {
        id: true,
        originalObjectKey: true,
        uploadedAt: true,
        uploadedByGuest: { select: { name: true } },
        embedding: true,
      },
    });
  }

  async findPhotoDetailForOwner(photoId: string, userId: string) {
    return this.prisma.photo.findFirst({
      where: { id: photoId, isDeleted: false, event: { ownerId: userId } },
      include: {
        uploadedByGuest: { select: { id: true, name: true } },
        event: { select: { id: true, name: true } },
      },
    });
  }

  async searchUploaders(eventId: string, name: string) {
    return this.prisma.photo.findMany({
      where: {
        eventId,
        isDeleted: false,
        uploadedByGuest: { name: { contains: name, mode: 'insensitive' } },
      },
      include: { uploadedByGuest: { select: { id: true, name: true } } },
      orderBy: { uploadedAt: 'desc' },
    });
  }

  async findPhotoForOwner(photoId: string, userId: string) {
    return this.prisma.photo.findFirst({
      where: { id: photoId, isDeleted: false, event: { ownerId: userId } },
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
      where: { id: { in: photoIds }, eventId, isDeleted: false },
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
    const where = { groupId, photo: { isDeleted: false } };
    const [links, total] = await this.prisma.$transaction([
      this.prisma.photoGroupPhoto.findMany({
        where,
        include: {
          photo: { include: { uploadedByGuest: { select: { name: true } } } },
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
}


