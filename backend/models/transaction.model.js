const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const TransactionType = Object.freeze({
  Recharge: 'Recharge',
  Deduction: 'Deduction',
});

const transactionSchema = new Schema({
  shopkeeperId: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true,
  },
  type: {
    type: String,
    enum: Object.values(TransactionType),
    required: true,
  },
  amount: {
    type: Number,
    required: true,
    min: 0,
  },
  balanceAfter: {
    type: Number, // Snapshot of the wallet balance AFTER this transaction
    required: true,
  },
  description: {
    type: String,
    required: true,
  },
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true },
});

transactionSchema.index({ shopkeeperId: 1, createdAt: -1 });

const Transaction = mongoose.model('Transaction', transactionSchema);

module.exports = { Transaction, TransactionType };
