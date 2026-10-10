import { Controller, Get } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { AppService } from "./app.service";

@Controller()
export class AppController {
  constructor(
    private readonly appService: AppService,
    private readonly configService: ConfigService,
  ) {}

  @Get("health")
  getHealth() {
    return this.appService.getHealth();
  }

  @Get("app-version")
  getAppVersion() {
    const platform = (name: "ANDROID" | "IOS") => ({
      latestVersion: this.configService.get<string>(
        `APP_LATEST_VERSION_${name}`,
        "",
      ),
      minimumVersion: this.configService.get<string>(
        `APP_MINIMUM_VERSION_${name}`,
        "",
      ),
      updateUrl: this.configService.get<string>(`APP_UPDATE_URL_${name}`, ""),
    });

    return {
      android: platform("ANDROID"),
      ios: platform("IOS"),
    };
  }
}
