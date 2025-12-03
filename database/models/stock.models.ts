import mongoose, { Schema, model } from "mongoose";

const StockSchema = new Schema({
  symbol: { type: String, unique: true, required: true },
  company: { type: String, required: true },
  exchange: { type: String, required: true },
  logoUrl: {
    type: String,
    required: false, 
  },
});

export const Stock = mongoose.models.Stock || model("Stock", StockSchema);
