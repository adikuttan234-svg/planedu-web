const mongoose = require("mongoose");

const SubjectSchema = new mongoose.Schema({
    name: { type: String, required: true },
    type: { type: String, enum: ['theory', 'lab'], required: true },
    sem: { type: String, required: true },
    labAssistant: { type: String, default: null },
    weeklyHrs: { type: Number, required: true },
    room: { type: String, default: 'N/A' },
    teacher: { type: String, default: 'TBA' }
});

module.exports = mongoose.model("Subject", SubjectSchema);
