import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose";
import { HydratedDocument } from "mongoose";

export type UserDocument = HydratedDocument<User>;

@Schema({ timestamps: true })
export class User {
  @Prop({ required: true, trim: true })
  fullName!: string;

  @Prop({
    required: true,
    lowercase: true,
    trim: true,
    unique: true,
    index: true,
  })
  email!: string;

  @Prop({ required: true, trim: true })
  phone!: string;

  @Prop({ trim: true })
  avatarKey?: string;

  @Prop({ trim: true })
  avatarUrl?: string;

  @Prop({ trim: true, index: true, sparse: true, unique: true })
  appleSub?: string;

  @Prop({ trim: true, index: true, sparse: true, unique: true })
  googleSub?: string;

  @Prop({
    trim: true,
    enum: ["password", "apple", "google"],
    default: "password",
  })
  authProvider!: "password" | "apple" | "google";

  @Prop({ required: true, select: false })
  passwordHash!: string;
}

export const UserSchema = SchemaFactory.createForClass(User);
