
import mongoose, { Schema, Document, Model } from 'mongoose';
import type { ProductSchedulingRules, SpecificDayRule } from '@/lib/types';

// Sub-schema for SpecificDayRule within ProductSchedulingRules
const ProductSpecificDayRuleSchema: Schema<Omit<SpecificDayRule, 'id'>> = new Schema({
  date: { type: String, required: true }, // "YYYY-MM-DD"
  isOff: { type: Boolean },
  workingHours: [{ type: String }], // ["HH:MM", "HH:MM"]
  numberOfStaff: { type: Number, min: 0 },
  serviceDurationMinutes: { type: Number, min: 5 },
}, { _id: false }); // _id is false as it's embedded

// Sub-schema for ProductSchedulingRules
const ProductSchedulingRulesSchema: Schema<ProductSchedulingRules> = new Schema({
  numberOfStaff: { type: Number, min: 0 },
  serviceDurationMinutes: { type: Number, min: 5 },
  workingHours: [{ type: String }],
  weeklyOffDays: [{ type: Number, min: 0, max: 6 }],
  oneTimeOffDates: [{ type: String }], // "YYYY-MM-DD"
  specificDayRules: [ProductSpecificDayRuleSchema],
}, { _id: false }); // _id is false as it's embedded


export interface IProduct extends Document {
  name: string;
  description: string;
  price: number;
  category: string;
  imageUrl?: string;
  isActive: boolean;
  isSchedulable?: boolean; // New
  schedulingRules?: ProductSchedulingRules; // New
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
    isSchedulable: { type: Boolean, default: true }, // Default to true, admin can disable
    schedulingRules: { type: ProductSchedulingRulesSchema, default: {} }, // Default to empty object
  },
  { timestamps: true }
);

const ProductModel: Model<IProduct> = mongoose.models.Product as Model<IProduct> || mongoose.model<IProduct>('Product', ProductSchema);

export default ProductModel;
