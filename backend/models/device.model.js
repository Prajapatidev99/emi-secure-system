
const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const DeviceStatus = Object.freeze({
  Active: 'Active',
  Locked: 'Locked',
  Compromised: 'Compromised', // e.g., if rooting is detected
  Released: 'Released', // When all payments are done and ownership is released
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
    unique: true,
    trim: true,
    sparse: true, // Allows multiple null values, but unique if not null
  },
  imei2: {
    type: String,
    trim: true,
    default: null
  },
  simDetails: {
    slot1: {
      phoneNumber: String,
      operator: String,
      simSerial: String,
      country: String
    },
    slot2: {
      phoneNumber: String,
      operator: String,
      simSerial: String,
      country: String
    }
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
  },
  location: {
    latitude: Number,
    longitude: Number,
    accuracy: Number,
    lastUpdated: Date,
  },
  locationHistory: [{
    latitude: { type: Number, required: true },
    longitude: { type: Number, required: true },
    accuracy: Number,
    timestamp: { type: Date, default: Date.now }
  }],
  metadata: {
    isDeviceOwner: { type: Boolean, default: false },
    isAdbEnabled: { type: Boolean, default: false },
    lastSync: Date,
    appVersion: String
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true },
});

// Indexes for performance
deviceSchema.index({ customerId: 1 });
deviceSchema.index({ status: 1 });
deviceSchema.index({ androidId: 1 });
deviceSchema.index({ imei: 1 });
deviceSchema.index({ customerId: 1, status: 1 });

const Device = mongoose.model('Device', deviceSchema);

module.exports = { Device, DeviceStatus };