import { Module } from "@nestjs/common";
import { ConfigModule, ConfigService } from "@nestjs/config";
import { MongooseModule } from "@nestjs/mongoose";
import { AppController } from "./app.controller";
import { AppService } from "./app.service";
import { AuthModule } from "./auth/auth.module";
import { CategoriesModule } from "./categories/categories.module";
import { PaymentsModule } from "./payments/payments.module";
import { ProductsModule } from "./products/products.module";
import { RentalOrdersModule } from "./rental-orders/rental-orders.module";
import { StorageModule } from "./storage/storage.module";
import { UsersModule } from "./users/users.module";
import { MessagesModule } from "./messages/messages.module";
import { ReviewsModule } from "./reviews/reviews.module";
import { RoommatePostsModule } from "./roommate-posts/roommate-posts.module";
import { ViewingsModule } from "./viewings/viewings.module";

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
    StorageModule,
    PaymentsModule,
    ProductsModule,
    RentalOrdersModule,
    MessagesModule,
    ReviewsModule,
    RoommatePostsModule,
    ViewingsModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
