import { Injectable } from "@nestjs/common";

@Injectable()
export class AppService {
  getHealth() {
    return {
      status: "ok",
      service: "lend-backend",
      timestamp: new Date().toISOString(),
    };
  }
}
