const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const RechargeRequestStatus = Object.freeze({
  Pending: 'Pending',
  Approved: 'Approved',
  Rejected: 'Rejected',
});

const rechargeRequestSchema = new Schema({
  shopkeeperId: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true,
  },
  amount: {
    type: Number,
    required: true,
    min: 1,
  },
  transactionId: {
    type: String,
    required: true,
    unique: true, // Prevent duplicate UTRs
    trim: true,
  },
  status: {
    type: String,
    enum: Object.values(RechargeRequestStatus),
    default: RechargeRequestStatus.Pending,
  },
  adminNote: {
    type: String,
    trim: true,
  },
}, {
  timestamps: true,
});

// Compound index for quick lookup of shopkeeper's history
rechargeRequestSchema.index({ shopkeeperId: 1, createdAt: -1 });

const RechargeRequest = mongoose.model('RechargeRequest', rechargeRequestSchema);

module.exports = { RechargeRequest, RechargeRequestStatus };
