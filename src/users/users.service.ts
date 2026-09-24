import { ConflictException, Injectable } from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import { Model } from "mongoose";
import { User, UserDocument } from "./schemas/user.schema";

export type SafeUser = {
  id: string;
  fullName: string;
  email: string;
  phone: string;
  avatarUrl?: string;
  avatarKey?: string;
  city?: string;
  latitude?: number;
  longitude?: number;
  stripeAccountId?: string;
  identityVerifiedAt?: Date;
  identityVerificationMode?: "test" | "live";
  stripePayoutsEnabled?: boolean;
  stripeDetailsSubmitted?: boolean;
  createdAt?: Date;
  updatedAt?: Date;
};

type CreateUserInput = {
  fullName: string;
  email: string;
  phone: string;
  passwordHash: string;
  appleSub?: string;
  googleSub?: string;
  authProvider?: "password" | "apple" | "google";
};

@Injectable()
export class UsersService {
  constructor(
    @InjectModel(User.name) private readonly userModel: Model<UserDocument>,
  ) {}

  async create(input: CreateUserInput): Promise<SafeUser> {
    try {
      const user = await this.userModel.create({
        ...input,
        email: input.email.toLowerCase(),
      });

      return this.toSafeUser(user);
    } catch (error) {
      if (this.isDuplicateKeyError(error)) {
        throw new ConflictException("Există deja un cont cu acest email.");
      }

      throw error;
    }
  }

  async findByEmailWithPassword(email: string): Promise<UserDocument | null> {
    return this.userModel
      .findOne({ email: email.toLowerCase() })
      .select("+passwordHash")
      .exec();
  }

  async findByAppleSub(appleSub: string): Promise<SafeUser | null> {
    const user = await this.userModel.findOne({ appleSub }).exec();
    return user ? this.toSafeUser(user) : null;
  }

  async findByGoogleSub(googleSub: string): Promise<SafeUser | null> {
    const user = await this.userModel.findOne({ googleSub }).exec();
    return user ? this.toSafeUser(user) : null;
  }

  async findByEmail(email: string): Promise<SafeUser | null> {
    const user = await this.userModel
      .findOne({ email: email.toLowerCase() })
      .exec();
    return user ? this.toSafeUser(user) : null;
  }

  async findById(id: string): Promise<SafeUser | null> {
    const user = await this.userModel.findById(id).exec();
    return user ? this.toSafeUser(user) : null;
  }

  async updateAvatar(input: {
    userId: string;
    avatarUrl: string;
    avatarKey?: string;
  }): Promise<SafeUser | null> {
    const user = await this.userModel
      .findByIdAndUpdate(
        input.userId,
        {
          avatarUrl: input.avatarUrl,
          avatarKey: input.avatarKey,
        },
        { new: true },
      )
      .exec();

    return user ? this.toSafeUser(user) : null;
  }

  async updateLocation(input: {
    userId: string;
    city: string;
    latitude?: number;
    longitude?: number;
  }): Promise<SafeUser | null> {
    const user = await this.userModel
      .findByIdAndUpdate(
        input.userId,
        {
          city: input.city.trim(),
          latitude: input.latitude,
          longitude: input.longitude,
        },
        { new: true },
      )
      .exec();

    return user ? this.toSafeUser(user) : null;
  }

  async requestAccountDeletion(userId: string) {
    const user = await this.userModel
      .findByIdAndUpdate(
        userId,
        {
          deletionRequestedAt: new Date(),
          deletionRequestStatus: "pending",
        },
        { new: true },
      )
      .exec();

    if (!user) return null;
    return {
      requested: true,
      status: user.deletionRequestStatus,
      requestedAt: user.deletionRequestedAt,
    };
  }

  async linkAppleAccount(input: {
    userId: string;
    appleSub: string;
  }): Promise<SafeUser | null> {
    const user = await this.userModel
      .findByIdAndUpdate(
        input.userId,
        {
          appleSub: input.appleSub,
          authProvider: "apple",
        },
        { new: true },
      )
      .exec();

    return user ? this.toSafeUser(user) : null;
  }

  async linkGoogleAccount(input: {
    userId: string;
    googleSub: string;
  }): Promise<SafeUser | null> {
    const user = await this.userModel
      .findByIdAndUpdate(
        input.userId,
        {
          googleSub: input.googleSub,
          authProvider: "google",
        },
        { new: true },
      )
      .exec();

    return user ? this.toSafeUser(user) : null;
  }

  async updateStripeAccount(input: {
    userId: string;
    stripeAccountId: string;
    stripePayoutsEnabled?: boolean;
    stripeDetailsSubmitted?: boolean;
  }): Promise<SafeUser | null> {
    const user = await this.userModel
      .findByIdAndUpdate(
        input.userId,
        {
          stripeAccountId: input.stripeAccountId,
          ...(input.stripePayoutsEnabled !== undefined
            ? { stripePayoutsEnabled: input.stripePayoutsEnabled }
            : {}),
          ...(input.stripeDetailsSubmitted !== undefined
            ? { stripeDetailsSubmitted: input.stripeDetailsSubmitted }
            : {}),
        },
        { new: true },
      )
      .exec();

    return user ? this.toSafeUser(user) : null;
  }

  async setIdentitySession(
    userId: string,
    sessionId: string,
    mode: "test" | "live",
  ) {
    return this.userModel
      .findByIdAndUpdate(userId, {
        $set: {
          identityVerificationSessionId: sessionId,
          identityVerificationMode: mode,
        },
        $unset: { identityVerifiedAt: 1 },
      })
      .exec();
  }

  async findByIdentitySession(sessionId: string) {
    return this.userModel
      .findOne({ identityVerificationSessionId: sessionId })
      .exec();
  }

  async markIdentityVerified(sessionId: string) {
    return this.userModel
      .findOneAndUpdate(
        { identityVerificationSessionId: sessionId },
        { identityVerifiedAt: new Date() },
        { new: true },
      )
      .exec();
  }

  async getVerificationState(userId: string) {
    return this.userModel
      .findById(userId)
      .select(
        "identityVerificationSessionId identityVerificationMode identityVerifiedAt email",
      )
      .exec();
  }

  toSafeUser(user: UserDocument): SafeUser {
    const createdAt = user.get("createdAt") as Date | undefined;
    const updatedAt = user.get("updatedAt") as Date | undefined;

    return {
      id: user._id.toString(),
      fullName: user.fullName,
      email: user.email,
      phone: user.phone,
      avatarUrl: user.avatarUrl,
      avatarKey: user.avatarKey,
      city: user.city,
      latitude: user.latitude,
      longitude: user.longitude,
      stripeAccountId: user.stripeAccountId,
      identityVerifiedAt: user.identityVerifiedAt,
      identityVerificationMode: user.identityVerificationMode,
      stripePayoutsEnabled: user.stripePayoutsEnabled,
      stripeDetailsSubmitted: user.stripeDetailsSubmitted,
      createdAt,
      updatedAt,
    };
  }

  private isDuplicateKeyError(error: unknown): boolean {
    return (
      typeof error === "object" &&
      error !== null &&
      "code" in error &&
      (error as { code?: number }).code === 11000
    );
  }
}
