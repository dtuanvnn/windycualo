const mongoose = require('mongoose');

const customerSchema = new mongoose.Schema({
  customerId: {
    type: String,
    unique: true
  },
  name: {
    type: String,
    required: [true, 'Họ và tên không được để trống'],
    trim: true
  },
  phone: {
    type: String,
    required: [true, 'Số điện thoại không được để trống'],
    unique: true,
    trim: true
  },
  email: {
    type: String,
    trim: true,
    lowercase: true
  },
  identityCard: {
    type: String,
    trim: true
  },
  source: {
    type: String,
    enum: ['Walk-in', 'Website', 'Direct Phone', 'FB Messenger', 'Booking.com', 'Agoda', 'Traveloka', 'Other'],
    default: 'Walk-in'
  },
  notes: String
}, { timestamps: true });

customerSchema.statics.normalizePhone = function(phone) {
  if (!phone) return '';
  let normalized = phone.replace(/[\s\-()]/g, '');
  if (normalized.startsWith('+84')) {
    normalized = '0' + normalized.slice(3);
  }
  return normalized;
};

customerSchema.pre('save', async function() {
  this.phone = this.constructor.normalizePhone(this.phone);

  if (this.isNew && !this.customerId) {
    const last = await this.constructor.findOne({}, { customerId: 1 })
      .sort({ customerId: -1 });
    let nextNum = 1;
    if (last && last.customerId) {
      nextNum = parseInt(last.customerId.replace('KH', ''), 10) + 1;
    }
    this.customerId = 'KH' + String(nextNum).padStart(4, '0');
  }
});

module.exports = mongoose.model('Customer', customerSchema);
