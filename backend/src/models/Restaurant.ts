import mongoose, { Document, Schema } from 'mongoose';

export interface IRestaurant extends Document {
  name: string;
  location: string;
  rating: number;
  reviewCount: number;
  imageUrl?: string | null;
  photoFileId?: mongoose.Types.ObjectId | null;
  description: string;
  openingHours: {
    open: string;
    close: string;
  };
  cuisine?: string;
  createdAt: Date;
  updatedAt: Date;
}

const RestaurantSchema: Schema = new Schema(
  {
    name: {
      type: String,
      required: [true, 'Restaurant name is required'],
      trim: true,
    },
    location: {
      type: String,
      required: [true, 'Location is required'],
      trim: true,
    },
    rating: {
      type: Number,
      required: [true, 'Rating is required'],
      min: 0,
      max: 5,
    },
    reviewCount: {
      type: Number,
      required: [true, 'Review count is required'],
      min: 0,
      default: 0,
    },
    imageUrl: {
      type: String,
      default: null,
    },
    photoFileId: {
      type: mongoose.Schema.Types.ObjectId,
      default: null,
      ref: 'restaurant_photos.files',
    },
    description: {
      type: String,
      required: [true, 'Description is required'],
      trim: true,
    },
    openingHours: {
      open: {
        type: String,
        required: [true, 'Opening time is required'],
      },
      close: {
        type: String,
        required: [true, 'Closing time is required'],
      },
    },
    cuisine: {
      type: String,
      trim: true,
    },
  },
  {
    timestamps: true,
  }
);

export default mongoose.model<IRestaurant>('Restaurant', RestaurantSchema);
