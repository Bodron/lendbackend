import { Module } from "@nestjs/common";
import { MongooseModule } from "@nestjs/mongoose";
import { AuthModule } from "../auth/auth.module";
import {
  LegalAcceptance,
  LegalAcceptanceSchema,
} from "./legal-acceptance.schema";
import { LegalController } from "./legal.controller";

@Module({
  imports: [
    AuthModule,
    MongooseModule.forFeature([
      { name: LegalAcceptance.name, schema: LegalAcceptanceSchema },
    ]),
  ],
  controllers: [LegalController],
})
export class LegalModule {}
