import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Headers,
  Post,
  Query,
  UnauthorizedException,
} from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import { Model } from "mongoose";
import { AuthService } from "../auth/auth.service";
import {
  LegalAcceptance,
  LegalAcceptanceDocument,
} from "./legal-acceptance.schema";
import { legalDocuments, LegalLanguage } from "./legal-documents";

type AcceptedDocument = { id: string; version: string; hash: string };

@Controller("legal")
export class LegalController {
  constructor(
    private readonly authService: AuthService,
    @InjectModel(LegalAcceptance.name)
    private readonly acceptanceModel: Model<LegalAcceptanceDocument>,
  ) {}

  @Get("documents")
  documents(@Query("lang") lang?: string) {
    const language: LegalLanguage = lang === "en" ? "en" : "ro";
    return legalDocuments.map((document) => ({
      id: document.id,
      version: document.version,
      hash: document.hash,
      title: document.title[language],
      body: document.body[language],
    }));
  }

  @Get("status")
  async status(@Headers("authorization") authorization?: string) {
    const userId = this.userId(authorization);
    const acceptances = await this.acceptanceModel
      .find({ userId })
      .sort({ acceptedAt: -1 })
      .lean()
      .exec();
    const accepted = legalDocuments.map((document) => {
      const record = acceptances.find(
        (item) =>
          item.documentId === document.id &&
          item.version === document.version &&
          item.hash === document.hash,
      );
      return {
        id: document.id,
        version: document.version,
        hash: document.hash,
        acceptedAt: record?.acceptedAt ?? null,
      };
    });
    return {
      current: accepted.every((item) => item.acceptedAt !== null),
      documents: accepted,
    };
  }

  @Post("accept")
  async accept(
    @Headers("authorization") authorization: string | undefined,
    @Body() body: { documents?: AcceptedDocument[] },
  ) {
    const userId = this.userId(authorization);
    if (
      !Array.isArray(body?.documents) ||
      body.documents.length !== legalDocuments.length ||
      !legalDocuments.every((document) =>
        body.documents?.some(
          (item) =>
            item?.id === document.id &&
            item.version === document.version &&
            item.hash === document.hash,
        ),
      )
    ) {
      throw new BadRequestException("Versiunea documentelor nu este actuală.");
    }

    const acceptedAt = new Date();
    await this.acceptanceModel.bulkWrite(
      legalDocuments.map((document) => ({
        updateOne: {
          filter: {
            userId,
            documentId: document.id,
            version: document.version,
            hash: document.hash,
          },
          update: {
            $setOnInsert: {
              userId,
              documentId: document.id,
              version: document.version,
              hash: document.hash,
              acceptedAt,
            },
          },
          upsert: true,
        },
      })),
    );
    return this.status(authorization);
  }

  private userId(authorization?: string) {
    const [type, token] = authorization?.split(" ") ?? [];
    if (type !== "Bearer" || !token) {
      throw new UnauthorizedException("Lipsește autentificarea.");
    }
    return this.authService.verifyToken(token).sub;
  }
}
