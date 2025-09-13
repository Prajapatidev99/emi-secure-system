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
});

const Payment = mongoose.model('Payment', paymentSchema);

module.exports = { Payment, PaymentStatus };