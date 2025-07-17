import mongoose from "mongoose";

const documentSchema = new mongoose.Schema({
  name: String,
  content: String, 
  uploadedAt: { type: Date, default: Date.now },
});

export default mongoose.models.Document || mongoose.model("Document", documentSchema);
