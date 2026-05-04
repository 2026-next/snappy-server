import { Injectable } from '@nestjs/common';
import { CreatePhotoDto } from './dto/create-photo.dto';
import { UpdatePhotoDto } from './dto/update-photo.dto';
import { PhotoRepository } from './repositories/photo.repository';

@Injectable()
export class PhotoService {
  constructor(private readonly photoRepository: PhotoRepository) {}

  // 사진 업로드 시 가상의 임베딩 생성 및 저장 테스트
  async uploadPhoto(eventId: string, guestId: string, url: string) {
    // 실제로는 여기서 AI 모델을 호출해야 하지만, 지금은 128차원 랜덤 벡터를 생성합니다.
    const dummyEmbedding = Array.from({ length: 128 }, () => Math.random());

    return this.photoRepository.createPhoto(
      eventId,
      guestId,
      url,
      dummyEmbedding,
    );
  }

  // 내 얼굴(Embedding)과 닮은 사진들 가져오기
  async getMyPhotos(eventId: string, myFaceEmbedding: number[]) {
    return this.photoRepository.findSimilarPhotos(myFaceEmbedding, eventId);
  }

  create(createPhotoDto: CreatePhotoDto) {
    return 'This action adds a new photo';
  }

  findAll() {
    return `This action returns all photo`;
  }

  findOne(id: number) {
    return `This action returns a #${id} photo`;
  }

  update(id: number, updatePhotoDto: UpdatePhotoDto) {
    return `This action updates a #${id} photo`;
  }

  remove(id: number) {
    return `This action removes a #${id} photo`;
  }
}
