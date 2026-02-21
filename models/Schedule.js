const mongoose = require('mongoose');

const ScheduleSchema = new mongoose.Schema({
    sem: { type: String, required: true }, // e.g., "1", "2"
    scheduleData: { type: Object, required: true }, // The entire JSON object for the week
    createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Schedule', ScheduleSchema);
