const mongoose = require('mongoose');
const Schema = mongoose.Schema;

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
  kycDocs: [{
    type: String, // URLs to documents
  }],
}, {
  timestamps: true,
});

// CRITICAL FIX: Ensure that when the document is converted to JSON for API responses,
// it includes a virtual 'id' field and removes the internal '_id' and '__v' fields.
// This makes the API output consistent and predictable for the frontend.
customerSchema.set('toJSON', {
  virtuals: true,
  versionKey: false,
  transform: function (doc, ret) {
    delete ret._id;
  }
});


const Customer = mongoose.model('Customer', customerSchema);

module.exports = Customer;