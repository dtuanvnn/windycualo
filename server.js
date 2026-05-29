const express = require('express');
const path = require('path');
const app = express();
const PORT = process.env.PORT || 3000;

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.use(express.static(path.join(__dirname, 'public')));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Giả lập Database Tin tức cho Sub-menu (Khuyến mãi, Ẩm thực, Địa điểm du lịch Cửa Lò)
const newsData = [
  {
    id: 1, cat: 'promo', catVi: 'Khuyến Mãi', catEn: 'Promotion',
    titleVi: 'Combo Đón Hè Rực Rỡ - Giảm Ngay 30% Khi Đặt Phòng Sớm',
    titleEn: 'Early Bird Summer Combo - 30% Off Room Rates',
    excerptVi: 'Đặt phòng trước 15 ngày để hưởng trọn vẹn ưu đãi giá tốt nhất cùng quà tặng đặc sản.',
    excerptEn: 'Book 15 days in advance to get special room rates and complimentary local gifts.',
    date: '29/05/2026', img: 'https://images.unsplash.com/photo-1566073771259-6a8506099945?w=600&q=80'
  },
  {
    id: 2, cat: 'food', catVi: 'Ẩm Thực', catEn: 'Cuisine',
    titleVi: 'Đêm Hội Hải Sản Tươi Sống Ngay Tại Hệ Thống Nhà Hàng Windy',
    titleEn: 'Fresh Seafood Premium Night at Windy Restaurant',
    excerptVi: 'Thưởng thức mực nhảy, tôm hùm, ghẹ biển Cửa Lò tươi ngon được chế biến từ các đầu bếp 5 sao.',
    excerptEn: 'Enjoy local jumping squids, lobsters, and fresh crabs caught within the day.',
    date: '28/05/2026', img: 'https://images.unsplash.com/photo-1565299624946-b28f40a0ae38?w=600&q=80'
  },
  {
    id: 3, cat: 'travel', catVi: 'Du Lịch Cửa Lò', catEn: 'Cua Lo Attractions',
    titleVi: 'Kinh Nghiệm Đi Đảo Ngư Cửa Lò Tự Túc Trọn Gói Từ A Đến Z',
    titleEn: 'Song Ngu Island Detailed Travel Guide From A To Z',
    excerptVi: 'Khám phá hòn đảo hoang sơ huyền bí với bãi sỏi sắc màu, chỉ cách bãi tắm Cửa Lò hơn 4km.',
    excerptEn: 'Discover the pristine Song Ngu island with spectacular colorful pebble beaches.',
    date: '25/05/2026', img: 'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=600&q=80'
  }
];

app.get('/', (req, res) => {
  res.render('index', { news: newsData });
});

app.post('/api/booking', (req, res) => {
  console.log('Yêu cầu đặt phòng:', req.body);
  res.json({
    success: true,
    messageVi: 'Gửi yêu cầu kiểm tra phòng thành công! Chúng tôi sẽ liên hệ lại ngay.',
    messageEn: 'Booking request sent successfully! We will contact you shortly.'
  });
});

app.listen(PORT, () => {
  console.log('Server Windy Hotel Cửa Lò đang chạy tại: http://localhost:' + PORT);
});