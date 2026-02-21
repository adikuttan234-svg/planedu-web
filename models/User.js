const mongoose = require("mongoose");

const UserSchema = new mongoose.Schema({
  name: String,
  email: { type: String, unique: true },
  password: String,
  role: String,
  isApproved: { type: Boolean, default: true } // Students=true, Faculty=false
});

module.exports = mongoose.model("User", UserSchema);
