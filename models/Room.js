const mongoose = require('mongoose');

const roomSchema = new mongoose.Schema({
  roomName: {
    type: String,
    required: [true, 'Tên loại phòng không được để trống'],
    unique: true,
    enum: ['Standard', 'Deluxe', 'Family', 'Suite']
  },
  totalRooms: {
    type: Number,
    required: [true, 'Tổng số phòng không được để trống'],
    min: [0, 'Số phòng không được âm']
  },
  available: {
    type: Number,
    required: true,
    min: 0,
    default: 0
  },
  occupied: {
    type: Number,
    min: 0,
    default: 0
  },
  maintenance: {
    type: Number,
    min: 0,
    default: 0
  },
  cleaning: {
    type: Number,
    min: 0,
    default: 0
  },
  pricePerNight: {
    type: Number,
    required: [true, 'Giá phòng không được để trống'],
    min: [0, 'Giá phòng không được âm']
  },
  description: String
}, { timestamps: true });

roomSchema.pre('save', function () {
  const sum = this.available + this.occupied + this.maintenance + this.cleaning;
  if (sum !== this.totalRooms) {
    throw new Error(`Tổng trạng thái (${sum}) phải bằng tổng số phòng (${this.totalRooms})`);
  }
});

module.exports = mongoose.model('Room', roomSchema);
