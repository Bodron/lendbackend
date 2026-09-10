import { Module } from "@nestjs/common";
import { MongooseModule } from "@nestjs/mongoose";
import { AuthModule } from "../auth/auth.module";
import { PushController } from "./push.controller";
import { PushService, PushDevice, PushDeviceSchema } from "./push.service";

@Module({
  imports: [AuthModule, MongooseModule.forFeature([{ name: PushDevice.name, schema: PushDeviceSchema }])],
  controllers: [PushController],
  providers: [PushService],
  exports: [PushService],
})
export class PushModule {}
