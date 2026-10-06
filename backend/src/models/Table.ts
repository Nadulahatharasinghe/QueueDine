import mongoose, { Document, Schema } from 'mongoose';

export type TableStatus = 'available' | 'reserved' | 'occupied';

export interface ITable extends Document {
  restaurantId: mongoose.Types.ObjectId;
  tableNumber: number;
  capacity: number;
  status: TableStatus;
  createdAt: Date;
  updatedAt: Date;
}

const TableSchema: Schema = new Schema(
  {
    restaurantId: {
      type: Schema.Types.ObjectId,
      ref: 'Restaurant',
      required: [true, 'Restaurant ID is required'],
      index: true,
    },
    tableNumber: {
      type: Number,
      required: [true, 'Table number is required'],
      min: 1,
    },
    capacity: {
      type: Number,
      required: [true, 'Table capacity is required'],
      min: 1,
      max: 20,
    },
    status: {
      type: String,
      enum: ['available', 'reserved', 'occupied'],
      default: 'available',
      index: true,
    },
  },
  {
    timestamps: true,
  }
);

TableSchema.index({ restaurantId: 1, tableNumber: 1 }, { unique: true });

export default mongoose.model<ITable>('Table', TableSchema);
