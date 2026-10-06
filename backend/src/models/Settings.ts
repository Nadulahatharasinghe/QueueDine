import mongoose, { Document, Schema } from 'mongoose';

export interface ISettings extends Document {
  welcomeBackgroundImage?: string;
  welcomeBackgroundImageName?: string;
  createdAt: Date;
  updatedAt: Date;
}

const SettingsSchema: Schema = new Schema(
  {
    welcomeBackgroundImage: {
      type: String,
      default: null,
    },
    welcomeBackgroundImageName: {
      type: String,
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

export default mongoose.model<ISettings>('Settings', SettingsSchema);
