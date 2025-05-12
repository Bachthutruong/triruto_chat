import mongoose, { Schema, Document, Model } from 'mongoose';

export interface IProduct extends Document {
  name: string;
  description: string;
  price: number;
  category: string;
  imageUrl?: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const ProductSchema = new Schema<IProduct>(
  {
    name: { type: String, required: true },
    description: { type: String, required: true },
    price: { type: Number, required: true },
    category: { type: String, required: true },
    imageUrl: { type: String },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

// Create or return existing model
const ProductModel: Model<IProduct> = mongoose.models.Product as Model<IProduct> || mongoose.model<IProduct>('Product', ProductSchema);

export default ProductModel; 