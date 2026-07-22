import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { randomUUID } from 'crypto';
import { extname } from 'path';

/**
 * Cliente S3 generico (funciona com AWS S3 ou qualquer storage S3-compativel,
 * como Cloudflare R2, bastando configurar STORAGE_S3_ENDPOINT + STORAGE_S3_FORCE_PATH_STYLE).
 */
@Injectable()
export class StorageService {
  private readonly client: S3Client;
  private readonly bucket: string;
  private readonly publicUrlBase: string;

  constructor(private readonly config: ConfigService) {
    this.bucket = this.config.getOrThrow<string>('STORAGE_S3_BUCKET');
    this.publicUrlBase = this.config.getOrThrow<string>('STORAGE_S3_PUBLIC_URL_BASE').replace(/\/$/, '');

    this.client = new S3Client({
      region: this.config.get<string>('STORAGE_S3_REGION', 'auto'),
      endpoint: this.config.get<string>('STORAGE_S3_ENDPOINT') || undefined,
      forcePathStyle: this.config.get<string>('STORAGE_S3_FORCE_PATH_STYLE') === 'true',
      credentials: {
        accessKeyId: this.config.getOrThrow<string>('STORAGE_S3_ACCESS_KEY_ID'),
        secretAccessKey: this.config.getOrThrow<string>('STORAGE_S3_SECRET_ACCESS_KEY'),
      },
    });
  }

  /** Envia o arquivo para `{pasta}/{uuid}.{ext}` e retorna a URL publica. */
  async upload(pasta: string, arquivo: Express.Multer.File): Promise<string> {
    const chave = `${pasta}/${randomUUID()}${extname(arquivo.originalname)}`;

    await this.client.send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: chave,
        Body: arquivo.buffer,
        ContentType: arquivo.mimetype,
      }),
    );

    return `${this.publicUrlBase}/${chave}`;
  }
}
