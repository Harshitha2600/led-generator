const mongoose = require('mongoose');

const lineSchema = new mongoose.Schema({
  text:          { type: String, required: true },
  fontSize:      { type: Number, default: 80 },
  fontFamily:    { type: String, default: 'Arial, sans-serif' },
  color:         { type: String, default: '#ffffff' },
  bold:          { type: Boolean, default: false },
  italic:        { type: Boolean, default: false },
  underline:     { type: Boolean, default: false },
  align:         { type: String, enum: ['left','center','right'], default: 'center' },
  letterSpacing: { type: Number, default: 0 },
});

const boardSchema = new mongoose.Schema({
  slug:          { type: String, unique: true, required: true },
  widthFt:       { type: Number, required: true },
  heightFt:      { type: Number, required: true },
  pixelPitch:    { type: Number, default: 10 },   // mm  e.g. 10 = P10
  pitchCode:     { type: String, default: 'P10' }, // e.g. "P10"
  imageData:     { type: String },
  lines:         [lineSchema],
  generatedHTML: { type: String },
  views:         { type: Number, default: 0 },
  createdAt:     { type: Date,   default: Date.now },
  updatedAt:     { type: Date,   default: Date.now },
});

boardSchema.pre('save', function(next) { this.updatedAt = Date.now(); next(); });

module.exports = mongoose.model('Board', boardSchema);
