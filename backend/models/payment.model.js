const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const PaymentStatus = Object.freeze({
  Paid: 'Paid',
  Pending: 'Pending',
  Overdue: 'Overdue',
});

const paymentSchema = new Schema({
  customerId: {
    type: Schema.Types.ObjectId,
    ref: 'Customer',
    required: true,
  },
  deviceId: {
    type: Schema.Types.ObjectId,
    ref: 'Device',
    required: true,
  },
  amount: {
    type: Number,
    required: true,
  },
  dueDate: {
    type: Date,
    required: true,
  },
  status: {
    type: String,
    enum: Object.values(PaymentStatus),
    default: PaymentStatus.Pending,
  },
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true },
});

// Check for overdue payments before finding
paymentSchema.pre('find', function () {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  this.model.updateMany(
    { dueDate: { $lt: today }, status: 'Pending' },
    { $set: { status: 'Overdue' } }
  ).exec();
});

// Indexes for performance
paymentSchema.index({ customerId: 1, status: 1 });
paymentSchema.index({ deviceId: 1, dueDate: 1 });
paymentSchema.index({ dueDate: 1, status: 1 });
paymentSchema.index({ status: 1 });


const Payment = mongoose.model('Payment', paymentSchema);

module.exports = { Payment, PaymentStatus };