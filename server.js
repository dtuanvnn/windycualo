require('dotenv').config();
const express = require('express');
const path = require('path');
const nodemailer = require('nodemailer');
const app = express();
const PORT = process.env.PORT || 3000;

const mongoose = require('mongoose');
const session = require('express-session'); // <--- Thêm thư viện session
const Booking = require('./models/Booking'); // <--- Đảm bảo đã import Model Booking từ database của bạn

console.log('🔌 Kiểm tra kết nối URL:', process.env.MONGO_URI); // <-- Thêm dòng này để test
// Thay thế bằng chuỗi kết nối của bạn (Local hoặc Cloud Atlas)
const MONGO_URI = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/windy_hotel';
const clientOptions = { serverApi: { version: '1', strict: true, deprecationErrors: true } };
mongoose.connect(MONGO_URI, clientOptions)
  .then(() => console.log('✅ Kết nối thành công tới MongoDB!'))
  .catch(err => console.error('❌ Lỗi kết nối MongoDB ban đầu:', err));

// Thêm đoạn này để theo dõi các lỗi kết nối phát sinh sau khi chạy
mongoose.connection.on('error', err => {
  console.error('❌ Lỗi kết nối MongoDB trong quá trình chạy:', err);
});

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.use(express.static(path.join(__dirname, 'public')));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// --- CẤU HÌNH GỬI MAIL (GMAIL) ---
const transporter = nodemailer.createTransport({
  host: 'smtp.gmail.com',
  port: 587,
  secure: false, // Bắt buộc phải là false đối với cổng 587
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS // <--- Điền 16 ký tự "Mật khẩu ứng dụng" của Google vào đây
  },
  tls: {
    rejectUnauthorized: false // Bỏ qua kiểm tra chứng chỉ nếu chạy ở local/môi trường dev
  }
});

// 1. Cấu hình Middleware Session (Đặt phía trên các router)
app.use(session({
  secret: 'windy-hotel-secret-key-2026', // Chuỗi ký tự bất kỳ để mã hóa session
  resave: false,
  saveUninitialized: true,
  cookie: { maxAge: 3600000 } // Phiên đăng nhập có hiệu lực trong 1 tiếng (3.600.000 ms)
}));

// 2. Cài đặt mật khẩu truy cập (Bạn có thể đổi mật khẩu này theo ý muốn)
const ADMIN_PASSWORD = 'WindyCuaLo2026'; 

// 3. Middleware kiểm tra quyền truy cập (Guard)
const requireAdmin = (req, res, next) => {
  if (req.session.isAdmin) {
    next(); // Nếu đã đăng nhập đúng mật khẩu, cho phép đi tiếp
  } else {
    res.redirect('/admin/login'); // Nếu chưa, đá về trang đăng nhập
  }
};

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

app.post('/api/booking', async (req, res) => {
  const { fullName, phone, checkin, checkout, roomType } = req.body;

  // ─── THÊM VÀO ĐÂY: VALIDATE PHÍA SERVER ───
  const vnmPhoneRegex = /^(0|\+84)(3|5|7|8|9)\d{8}$/;
  
  if (!phone || !vnmPhoneRegex.test(phone.trim())) {
    console.log(`❌ Yêu cầu bị chặn do SĐT không hợp lệ: ${phone}`);
    return res.status(400).json({ 
      success: false, 
      error: 'Số điện thoại không đúng định dạng di động Việt Nam!' 
    });
  }
  // ──────────────────────────────────────────

  console.log('📬 Nhận yêu cầu đặt phòng mới từ:', fullName, '-', phone);

  try {
    // 🔥 BƯỚC 1: TẠO VÀ LƯU DỮ LIỆU VÀO MONGODB ATLAS
    const newBooking = new Booking({
      fullName: fullName,
      phone: phone,
      checkIn: checkin,   // 👉 Đổi chữ i thường thành I hoa để khớp với Schema (checkIn)
      checkOut: checkout, // 👉 Đổi chữ o thường thành O hoa để khớp với Schema (checkOut)
      roomName: roomType  // 👉 Đổi từ trường roomType sang trường roomName mà Schema yêu cầu
    });

    // Chờ Mongoose lưu thành công lên Cloud
    const savedBooking = await newBooking.save();
    console.log('✅ Đã lưu thành công đơn đặt phòng vào MongoDB Atlas. ID:', savedBooking._id);

    // Thiết lập nội dung Email thông báo
    const mailOptions = {
      from: process.env.EMAIL_USER,
      to: process.env.EMAIL_USER, // Gửi về chính mình để quản lý khách sạn tiếp nhận
      subject: `[WEBSITE ĐẶT PHÒNG] - Khách hàng: ${fullName.toUpperCase()}`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; border: 1px solid #C9922B; padding: 20px;">
          <h2 style="color: #8B1A1A; border-bottom: 2px solid #C9922B; padding-bottom: 10px;">YÊU CẦU ĐẶT PHÒNG MỚI</h2>
          <p><b>Họ và tên khách hàng:</b> ${fullName}</p>
          <p><b>Số điện thoại:</b> <a href="tel:${phone}">${phone}</a></p>
          <p><b>Hạng phòng lựa chọn:</b> ${roomType}</p>
          <p><b>Ngày nhận phòng (Check-in):</b> ${checkin}</p>
          <p><b>Ngày trả phòng (Check-out):</b> ${checkout}</p>
          <hr style="border: 0; border-top: 1px solid #eee;">
          <p style="font-size: 12px; color: #666;">Hệ thống thông báo tự động từ Website Windy Hotel Cửa Lò.</p>
        </div>
      `
    };

    // Thực hiện gửi thư bất đồng bộ
    transporter.sendMail(mailOptions, (error, info) => {
      if (error) {
        console.error('❌ Lỗi gửi email thông báo:', error);
        // Bạn vẫn có thể báo thành công cho khách hoặc báo lỗi hệ thống tùy ý
      } else {
        console.log('🚀 Email thông báo đặt phòng đã gửi thành công:', info.response);
      }
    });

    // Trả về kết quả dạng JSON để file main.js nhận được và hiển thị alert cho khách
    res.json({
      success: true,
      messageVi: 'Cảm ơn bạn! Yêu cầu đặt phòng đã được hệ thống ghi nhận. Chúng tôi sẽ liên hệ lại qua điện thoại trong ít phút.',
      messageEn: 'Thank you! Your booking request has been sent. We will contact you via phone shortly.'
    });
  } catch (dbError) {
    // Nếu có lỗi trong quá trình kết nối hoặc lưu DB (ví dụ sập mạng, sai schema)
    console.error('❌ Lỗi nghiêm trọng không thể lưu dữ liệu vào MongoDB:', dbError);
    
    return res.status(500).json({
      success: false,
      error: 'Hệ thống database đang bận, vui lòng thử lại sau hoặc liên hệ Hotline!'
    });
  }
});

// ─── CÁC ROUTE QUẢN TRỊ ĐẶT PHÒNG ───

// GET: Trang hiển thị form điền mật khẩu
app.get('/admin/login', (req, res) => {
  res.render('admin-login', { error: null });
});

// POST: Xử lý kiểm tra mật khẩu khi bấm nút Đăng nhập
app.post('/admin/login', (req, res) => {
  const { password } = req.body;
  
  if (password === ADMIN_PASSWORD) {
    req.session.isAdmin = true; // Lưu trạng thái đã đăng nhập vào phiên làm việc
    res.redirect('/admin/bookings');
  } else {
    res.render('admin-login', { error: 'Mật khẩu không chính xác! Vui lòng thử lại.' });
  }
});

// GET: Trang xem danh sách đặt phòng (Được bảo vệ bởi requireAdmin)
app.get('/admin/bookings', requireAdmin, async (req, res) => {
  try {
    // Lấy toàn bộ danh sách đặt phòng từ database, xếp đơn mới nhất lên đầu
    const bookings = await Booking.find().sort({ createdAt: -1 }); 
    res.render('admin-bookings', { bookings });
  } catch (error) {
    console.error('Lỗi truy vấn DB:', error);
    res.status(500).send('Đã có lỗi xảy ra khi tải dữ liệu từ Database.');
  }
});

// GET: Đường dẫn đăng xuất
app.get('/admin/logout', (req, res) => {
  req.session.destroy(); // Hủy phiên làm việc
  res.redirect('/admin/login');
});

app.listen(PORT, () => {
  console.log('Server Windy Hotel Cửa Lò đang chạy tại: http://localhost:' + PORT);
});