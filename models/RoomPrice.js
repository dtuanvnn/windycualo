const mongoose = require('mongoose');

const roomPriceSchema = new mongoose.Schema({
  roomName: {
    type: String,
    required: [true, 'Loại phòng không được để trống'],
    enum: ['Standard', 'Deluxe', 'Family', 'Suite']
  },
  tierType: {
    type: String,
    required: [true, 'Loại giá không được để trống'],
    enum: ['normal', 'weekend', 'holiday']
  },
  price: {
    type: Number,
    required: [true, 'Giá không được để trống'],
    min: [0, 'Giá không được âm']
  },
  holidayName: {
    type: String,
    default: null
  },
  startDate: {
    type: Date,
    default: null
  },
  endDate: {
    type: Date,
    default: null
  }
}, { timestamps: true });

roomPriceSchema.pre('save', function () {
  if (this.tierType === 'holiday') {
    if (!this.holidayName) throw new Error('Tên dịp lễ không được để trống');
    if (!this.startDate || !this.endDate) throw new Error('Ngày bắt đầu và kết thúc không được để trống');
    if (this.startDate >= this.endDate) throw new Error('Ngày kết thúc phải sau ngày bắt đầu');
  }
});

roomPriceSchema.index(
  { roomName: 1, tierType: 1, startDate: 1, endDate: 1 },
  { unique: true }
);

module.exports = mongoose.model('RoomPrice', roomPriceSchema);
