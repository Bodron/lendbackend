import { Test, TestingModule } from "@nestjs/testing";
import { AppController } from "./app.controller";
import { AppService } from "./app.service";
import { ConfigService } from "@nestjs/config";

describe("AppController", () => {
  let appController: AppController;

  beforeEach(async () => {
    const app: TestingModule = await Test.createTestingModule({
      controllers: [AppController],
      providers: [AppService, ConfigService],
    }).compile();

    appController = app.get<AppController>(AppController);
  });

  describe("getHealth", () => {
    it("returns service health", () => {
      expect(appController.getHealth()).toMatchObject({
        status: "ok",
        service: "lend-backend",
      });
    });
  });

  describe("getAppVersion", () => {
    it("returns empty version settings until configured", () => {
      expect(appController.getAppVersion()).toEqual({
        android: { latestVersion: "", minimumVersion: "", updateUrl: "" },
        ios: { latestVersion: "", minimumVersion: "", updateUrl: "" },
      });
    });
  });
});
