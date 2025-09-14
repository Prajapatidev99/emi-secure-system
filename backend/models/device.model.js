const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const DeviceStatus = Object.freeze({
    Active: 'Active',
    Locked: 'Locked',
    Compromised: 'Compromised', // e.g., if rooting is detected
});

const deviceSchema = new Schema({
  customerId: {
    type: Schema.Types.ObjectId,
    ref: 'Customer',
    required: true,
  },
  imei: {
    type: String,
    required: true,
    unique: true,
    trim: true,
  },
  androidId: {
    type: String,
    required: true,
    unique: true,
    trim: true,
  },
  model: {
    type: String,
    required: true,
  },
  status: {
    type: String,
    enum: Object.values(DeviceStatus),
    default: DeviceStatus.Active,
  },
  fcmToken: {
    type: String,
    trim: true,
    default: null
  },
  unlockKey: {
    type: String,
    // This key will be generated on device registration
  },
  isCompromised: {
    type: Boolean,
    default: false,
  }
}, {
  timestamps: true,
});

const Device = mongoose.model('Device', deviceSchema);

module.exports = { Device, DeviceStatus };