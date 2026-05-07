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

  async findAllByEvent(eventId: string, onlyFavorites = false) {
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

  async toggleFavorite(photoId: string, isFavorite: boolean) {
    return this.prisma.photo.update({
      where: { id: photoId },
      data: { isFavorite },
    });
  }
}
