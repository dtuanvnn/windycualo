const mongoose = require('mongoose');

const ROOM_TYPE_PREFIX = {
  'Standard': 'STD',
  'Deluxe': 'DLX',
  'Family': 'FAM',
  'Suite': 'SUT'
};

const physicalRoomSchema = new mongoose.Schema({
  roomNumber: {
    type: String,
    required: [true, 'Số phòng không được để trống'],
    unique: true,
    trim: true
  },
  floor: {
    type: Number,
    required: [true, 'Tầng không được để trống'],
    min: [1, 'Tầng phải lớn hơn 0'],
    max: [10, 'Tầng tối đa là 10']
  },
  roomIndex: {
    type: Number,
    required: true,
    min: 1
  },
  roomType: {
    type: String,
    required: [true, 'Loại phòng không được để trống'],
    enum: ['Standard', 'Deluxe', 'Family', 'Suite'],
    default: 'Standard'
  },
  status: {
    type: String,
    enum: ['available', 'reserved', 'occupied', 'maintenance', 'cleaning'],
    default: 'available'
  },
  label: {
    type: String,
    trim: true,
    default: ''
  },
  notes: {
    type: String,
    default: ''
  },
  currentBooking: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Booking',
    default: null
  }
}, { timestamps: true });

physicalRoomSchema.index({ floor: 1, roomIndex: 1 });

physicalRoomSchema.statics.generateRoomNumber = function (roomType, floor, roomIndex) {
  const prefix = ROOM_TYPE_PREFIX[roomType] || 'STD';
  return `${prefix}${floor}${String(roomIndex).padStart(2, '0')}`;
};

module.exports = mongoose.model('PhysicalRoom', physicalRoomSchema);
module.exports.ROOM_TYPE_PREFIX = ROOM_TYPE_PREFIX;
