import mongoose from "mongoose";

const messageSchema = new mongoose.Schema({
  type: {
    type: String, 
    enum: ["user", "ai"],
    required: true,
  },
  text: {
    type: String,
    required: true,
  },
});

const chatSchema = new mongoose.Schema(
  {
    title: String,
    messages: [messageSchema],
    createdAt: {
      type: Date,
      default: Date.now,
    },
  },
  { collection: "chats" }
);

export default mongoose.models.Chat || mongoose.model("Chat", chatSchema);
