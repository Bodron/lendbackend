import { Module } from "@nestjs/common";
import { ConfigModule, ConfigService } from "@nestjs/config";
import { MongooseModule } from "@nestjs/mongoose";
import { AppController } from "./app.controller";
import { AppService } from "./app.service";
import { AuthModule } from "./auth/auth.module";
import { CategoriesModule } from "./categories/categories.module";
import { ProductsModule } from "./products/products.module";
import { RentalOrdersModule } from "./rental-orders/rental-orders.module";
import { UsersModule } from "./users/users.module";

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ".env",
    }),
    MongooseModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => {
        const uri = configService.get<string>("MONGODB_URI");

        if (!uri) {
          throw new Error(
            "Missing MONGODB_URI. Configure the cloud database in .env.",
          );
        }

        return {
          uri,
          dbName: configService.get<string>("MONGODB_DB", "lend"),
        };
      },
    }),
    UsersModule,
    AuthModule,
    CategoriesModule,
    ProductsModule,
    RentalOrdersModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
