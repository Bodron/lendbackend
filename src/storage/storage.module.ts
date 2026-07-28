import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module";
import { S3StorageService } from "./s3-storage.service";
import { StorageController } from "./storage.controller";

@Module({
  imports: [AuthModule],
  controllers: [StorageController],
  providers: [S3StorageService],
  exports: [S3StorageService],
})
export class StorageModule {}
