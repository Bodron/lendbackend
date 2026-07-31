import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module";
import { StorageCoreModule } from "./storage-core.module";
import { StorageController } from "./storage.controller";

@Module({
  imports: [AuthModule, StorageCoreModule],
  controllers: [StorageController],
  exports: [StorageCoreModule],
})
export class StorageModule {}
