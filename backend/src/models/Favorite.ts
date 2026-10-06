import mongoose, { Document, Schema } from 'mongoose';

export interface IFavorite extends Document {
  userId: mongoose.Types.ObjectId;
  restaurantId: mongoose.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const FavoriteSchema: Schema = new Schema(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'User ID is required'],
      index: true,
    },
    restaurantId: {
      type: Schema.Types.ObjectId,
      ref: 'Restaurant',
      required: [true, 'Restaurant ID is required'],
      index: true,
    },
  },
  {
    timestamps: true,
  }
);

FavoriteSchema.index({ userId: 1, restaurantId: 1 }, { unique: true });

export default mongoose.model<IFavorite>('Favorite', FavoriteSchema);
