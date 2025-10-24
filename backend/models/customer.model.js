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
  name: {
    type: String,
    required: true,
    trim: true,
  },
  phone: {
    type: String,
    required: true,
    unique: true,
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

const Customer = mongoose.model('Customer', customerSchema);

module.exports = Customer;