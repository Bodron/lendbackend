import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { randomUUID } from "crypto";
import {
  GetObjectCommand,
  PutObjectCommand,
  S3Client,
  type S3ClientConfig,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

export type StoredImage = {
  url: string;
  key: string;
  alt: string;
  contentType: string;
};

export type PresignedUploadInput = {
  userId: string;
  fileName: string;
  contentType: string;
  size: number;
};

type UploadRemoteImageInput = {
  sourceUrl: string;
  key: string;
  alt: string;
};

@Injectable()
export class S3StorageService {
  private readonly client: S3Client;
  private readonly bucketName: string;
  private readonly bucketRegion: string;
  private readonly publicBaseUrl?: string;
  private readonly signedUrlTtlSeconds: number;

  constructor(private readonly configService: ConfigService) {
    this.bucketName =
      this.configService.get<string>("BUCKET_NAME") ??
      this.configService.get<string>("AWS_S3_BUCKET") ??
      "";
    this.bucketRegion =
      this.configService.get<string>("BUCKET_REGION") ??
      this.configService.get<string>("AWS_REGION") ??
      "eu-central-1";
    this.publicBaseUrl = this.configService.get<string>(
      "AWS_S3_PUBLIC_BASE_URL",
    );
    this.signedUrlTtlSeconds = this.configService.get<number>(
      "AWS_S3_SIGNED_URL_TTL_SECONDS",
      3600,
    );

    const accessKeyId = this.configService.get<string>("AWS_ACCESS_KEY_ID");
    const secretAccessKey = this.configService.get<string>(
      "AWS_SECRET_ACCESS_KEY",
    );
    const clientConfig: S3ClientConfig = {
      region: this.bucketRegion,
    };

    if (accessKeyId && secretAccessKey) {
      clientConfig.credentials = {
        accessKeyId,
        secretAccessKey,
      };
    }

    this.client = new S3Client(clientConfig);
  }

  async uploadRemoteImage(input: UploadRemoteImageInput): Promise<StoredImage> {
    if (!this.bucketName) {
      throw new Error("Missing BUCKET_NAME or AWS_S3_BUCKET in environment.");
    }

    const response = await fetch(input.sourceUrl);

    if (!response.ok) {
      throw new Error(
        `Could not download mock image ${input.sourceUrl}: ${response.status}`,
      );
    }

    const contentType =
      response.headers.get("content-type")?.split(";")[0] ?? "image/jpeg";
    const body = Buffer.from(await response.arrayBuffer());

    await this.client.send(
      new PutObjectCommand({
        Bucket: this.bucketName,
        Key: input.key,
        Body: body,
        ContentType: contentType,
      }),
    );

    return {
      url: this.getPublicUrl(input.key),
      key: input.key,
      alt: input.alt,
      contentType,
    };
  }

  async createPresignedUpload(input: PresignedUploadInput) {
    if (!this.bucketName) {
      throw new Error("Missing BUCKET_NAME or AWS_S3_BUCKET in environment.");
    }

    const mediaType = input.contentType.startsWith("video/")
      ? "videos"
      : "images";
    const extension = this.extensionFor(input.contentType, input.fileName);
    const safeFileName = this.safeFileName(input.fileName);
    const key = [
      "uploads",
      input.userId,
      mediaType,
      `${Date.now()}-${randomUUID()}-${safeFileName}${extension}`,
    ].join("/");

    const uploadUrl = await getSignedUrl(
      this.client,
      new PutObjectCommand({
        Bucket: this.bucketName,
        Key: key,
        ContentType: input.contentType,
        Metadata: {
          userId: input.userId,
          originalFileName: input.fileName.slice(0, 200),
          size: input.size.toString(),
        },
      }),
      { expiresIn: 300 },
    );

    return {
      key,
      uploadUrl,
      readableUrl: this.getPublicUrl(key),
      contentType: input.contentType,
      mediaType: input.contentType.startsWith("video/") ? "video" : "image",
      expiresIn: 300,
      headers: {
        "Content-Type": input.contentType,
      },
    };
  }

  async getReadableUrl(key: string): Promise<string> {
    if (this.publicBaseUrl) {
      return this.getPublicUrl(key);
    }

    if (!this.bucketName) {
      throw new Error("Missing BUCKET_NAME or AWS_S3_BUCKET in environment.");
    }

    return getSignedUrl(
      this.client,
      new GetObjectCommand({
        Bucket: this.bucketName,
        Key: key,
      }),
      { expiresIn: this.signedUrlTtlSeconds },
    );
  }

  private getPublicUrl(key: string): string {
    const encodedKey = key
      .split("/")
      .map((part) => encodeURIComponent(part))
      .join("/");

    if (this.publicBaseUrl) {
      return `${this.publicBaseUrl.replace(/\/$/, "")}/${encodedKey}`;
    }

    return `https://${this.bucketName}.s3.${this.bucketRegion}.amazonaws.com/${encodedKey}`;
  }

  private extensionFor(contentType: string, fileName: string): string {
    const currentExtension = fileName.match(/\.[a-zA-Z0-9]+$/)?.[0] ?? "";

    if (currentExtension) {
      return "";
    }

    return (
      {
        "image/jpeg": ".jpg",
        "image/png": ".png",
        "image/webp": ".webp",
        "video/mp4": ".mp4",
        "video/quicktime": ".mov",
      }[contentType] ?? ""
    );
  }

  private safeFileName(fileName: string): string {
    const baseName = fileName.replace(/\.[a-zA-Z0-9]+$/, "");
    const normalized = baseName
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 60);

    return normalized || "media";
  }
}
