const mongoose = require("mongoose");

const FacultySchema = new mongoose.Schema({
    name: { type: String, required: true },
    dept: { type: String, required: true },
    hours: { type: Number, required: true, default: 0 }
});

module.exports = mongoose.model("Faculty", FacultySchema);
