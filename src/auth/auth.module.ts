import { Module } from "@nestjs/common";
import { ConfigModule, ConfigService } from "@nestjs/config";
import { JwtModule } from "@nestjs/jwt";
import type { StringValue } from "ms";
import { StorageCoreModule } from "../storage/storage-core.module";
import { UsersModule } from "../users/users.module";
import { AuthController } from "./auth.controller";
import { AuthService } from "./auth.service";

@Module({
  imports: [
    UsersModule,
    StorageCoreModule,
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => {
        const secret = configService.get<string>("JWT_SECRET", "change-this-secret");
        if (process.env.NODE_ENV === "production" && (!secret || secret === "change-this-secret")) {
          throw new Error("Set a strong JWT_SECRET before starting the production API.");
        }
        return {
          secret,
          signOptions: {
            expiresIn: configService.get<StringValue>("JWT_EXPIRES_IN", "7d"),
          },
        };
      },
    }),
  ],
  controllers: [AuthController],
  providers: [AuthService],
  exports: [AuthService],
})
export class AuthModule {}
