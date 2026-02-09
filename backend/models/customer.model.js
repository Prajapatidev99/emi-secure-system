const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const kycDocumentSchema = new Schema({
  docType: {
    type: String,
    required: true,
  },
  docUrl: {
    type: String, // URL to the document
    required: true,
  }
}, { _id: false });

const customerSchema = new Schema({
  userId: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true, // Index for faster queries
  },
  name: {
    type: String,
    required: true,
    trim: true,
  },
  phone: {
    type: String,
    required: true,
    trim: true,
  },
  address: {
    type: String,
    required: true,
  },
  kycDocs: [kycDocumentSchema],
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true },
});

// Compound index: userId + phone (unique per user)
customerSchema.index({ userId: 1, phone: 1 }, { unique: true });

const Customer = mongoose.model('Customer', customerSchema);

module.exports = Customer;