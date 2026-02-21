const mongoose = require('mongoose');

const DeadlineSchema = new mongoose.Schema({
    title: { type: String, required: true },
    description: { type: String },
    subject: { type: String, required: true },
    dueDate: { type: Date, required: true },
    sem: { type: String, required: true },
    priority: { type: String, enum: ['LOW', 'MEDIUM', 'HIGH'], default: 'MEDIUM' },
    createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Deadline', DeadlineSchema);
