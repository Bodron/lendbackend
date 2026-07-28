import { IsIn, IsInt, IsString, Max, Min } from "class-validator";

const allowedContentTypes = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "video/mp4",
  "video/quicktime",
] as const;

export class CreateUploadUrlDto {
  @IsString()
  fileName!: string;

  @IsIn(allowedContentTypes)
  contentType!: (typeof allowedContentTypes)[number];

  @IsInt()
  @Min(1)
  @Max(200 * 1024 * 1024)
  size!: number;
}
