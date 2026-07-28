import { ConflictException, Injectable } from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import { Model } from "mongoose";
import { User, UserDocument } from "./schemas/user.schema";

export type SafeUser = {
  id: string;
  fullName: string;
  email: string;
  phone: string;
  createdAt?: Date;
  updatedAt?: Date;
};

type CreateUserInput = {
  fullName: string;
  email: string;
  phone: string;
  passwordHash: string;
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

  async findById(id: string): Promise<SafeUser | null> {
    const user = await this.userModel.findById(id).exec();
    return user ? this.toSafeUser(user) : null;
  }

  toSafeUser(user: UserDocument): SafeUser {
    const createdAt = user.get("createdAt") as Date | undefined;
    const updatedAt = user.get("updatedAt") as Date | undefined;

    return {
      id: user._id.toString(),
      fullName: user.fullName,
      email: user.email,
      phone: user.phone,
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
