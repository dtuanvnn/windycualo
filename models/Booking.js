const mongoose = require('mongoose');

const bookingSchema = new mongoose.Schema({
  fullName: {
    type: String,
    required: [true, 'Họ và tên không được để trống'],
    trim: true
  },
  phone: {
    type: String,
    required: [true, 'Số điện thoại không được để trống'],
    match: [/^\+?[\d\s\-()]{7,20}$/, 'Số điện thoại không hợp lệ']
  },
  email: {
    type: String,
    trim: true,
    lowercase: true
  },
  roomName: {
    type: String,
    required: [true, 'Vui lòng chọn loại phòng'],
    enum: ['Standard', 'Deluxe', 'Family', 'Suite'] // Map theo các phòng của khách sạn
  },
  checkIn: {
    type: Date,
    required: [true, 'Ngày nhận phòng không được để trống']
  },
  checkOut: {
    type: Date,
    required: [true, 'Ngày trả phòng không được để trống']
  },
  guests: {
    type: Number,
    required: true,
    min: 1,
    default: 1
  },
  status: {
    type: String,
    enum: ['Pending', 'Confirmed', 'Cancelled', 'CheckedIn', 'CheckedOut'],
    default: 'Pending'
  },
  notes: String,
  source: {
    type: String,
    enum: ['Website', 'Booking.com', 'Facebook'],
    default: 'Website'
  },
  externalBookingId: {
    type: String,
    default: null,
    sparse: true,
    unique: true
  }
}, { timestamps: true });

// Kiểm tra logic ngày trước khi lưu
bookingSchema.pre('save', async function() {
  if (this.checkIn >= this.checkOut) {
    throw new Error('Ngày trả phòng phải sau ngày nhận phòng!');
  }
});

module.exports = mongoose.model('Booking', bookingSchema);