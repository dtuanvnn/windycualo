require('dotenv').config();
const express = require('express');
const crypto = require('crypto');
const path = require('path');
const nodemailer = require('nodemailer');
const app = express();
const PORT = process.env.PORT || 3000;

const mongoose = require('mongoose');
const session = require('express-session'); // <--- Thêm thư viện session
const Booking = require('./models/Booking');
const Room = require('./models/Room');
const RoomPrice = require('./models/RoomPrice');
const PhysicalRoom = require('./models/PhysicalRoom');
const Customer = require('./models/Customer');

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
app.use(express.json({
  verify: (req, res, buf) => { req.rawBody = buf; }
}));
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

app.use(session({
  secret: process.env.SESSION_SECRET || 'windy-hotel-secret-key-2026',
  resave: false,
  saveUninitialized: true,
  cookie: { maxAge: 3600000 } // Phiên đăng nhập có hiệu lực trong 1 tiếng (3.600.000 ms)
}));

const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'WindyCuaLo2026';

// 3. Middleware kiểm tra quyền truy cập (Guard)
const requireAdmin = (req, res, next) => {
  if (req.session.isAdmin) {
    next(); // Nếu đã đăng nhập đúng mật khẩu, cho phép đi tiếp
  } else {
    res.redirect('/admin/login'); // Nếu chưa, đá về trang đăng nhập
  }
};

// ─── HÀM TÍNH GIÁ PHÒNG THEO NGÀY ───

async function getEffectivePrice(roomName, date) {
  const utcDate = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const holidayPrice = await RoomPrice.findOne({
    roomName,
    tierType: 'holiday',
    startDate: { $lte: utcDate },
    endDate: { $gte: utcDate }
  }).sort({ price: -1 });
  if (holidayPrice) {
    return { price: holidayPrice.price, tierType: 'holiday', holidayName: holidayPrice.holidayName };
  }

  const dayOfWeek = date.getDay();
  if (dayOfWeek === 0 || dayOfWeek === 6) {
    const weekendPrice = await RoomPrice.findOne({ roomName, tierType: 'weekend' });
    if (weekendPrice) {
      return { price: weekendPrice.price, tierType: 'weekend', holidayName: null };
    }
  }

  const normalPrice = await RoomPrice.findOne({ roomName, tierType: 'normal' });
  if (normalPrice) {
    return { price: normalPrice.price, tierType: 'normal', holidayName: null };
  }

  const room = await Room.findOne({ roomName });
  return { price: room ? room.pricePerNight : 0, tierType: 'fallback', holidayName: null };
}

async function calculateStayPrice(roomName, checkIn, checkOut) {
  const nights = [];
  let totalPrice = 0;
  const current = new Date(checkIn);

  while (current < checkOut) {
    const result = await getEffectivePrice(roomName, current);
    nights.push({
      date: new Date(current),
      price: result.price,
      tierType: result.tierType,
      holidayName: result.holidayName
    });
    totalPrice += result.price;
    current.setDate(current.getDate() + 1);
  }

  return { totalPrice, nights, nightCount: nights.length };
}

async function autoLinkBookingToCustomer(booking) {
  if (booking.customer) return;
  const phone = Customer.normalizePhone(booking.phone);
  if (!phone || phone === 'N/A') return;
  const customer = await Customer.findOne({ phone });
  if (customer) {
    booking.customer = customer._id;
    await booking.save();
  }
}

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

app.get('/', async (req, res) => {
  try {
    const rooms = await Room.find().sort({ roomName: 1 });
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const roomPrices = {};
    for (const room of rooms) {
      const info = await getEffectivePrice(room.roomName, today);
      roomPrices[room.roomName] = info.price;
    }
    res.render('index', { news: newsData, roomPrices });
  } catch (error) {
    res.render('index', { news: newsData, roomPrices: {} });
  }
});

app.get('/api/rooms/availability', async (req, res) => {
  const { check_in, check_out, night, available_only, format, messenger_user_id } = req.query;

  if (!check_in) {
    return res.status(400).json({ success: false, error: 'Thiếu tham số check_in' });
  }
  if (!check_out && !night) {
    return res.status(400).json({ success: false, error: 'Cần truyền check_out hoặc night' });
  }

  function parseDateDMY(str) {
    const parts = str.split('/');
    if (parts.length === 3) return new Date(parts[2], parts[1] - 1, parts[0]);
    return new Date(str);
  }

  const checkIn = parseDateDMY(check_in);
  if (isNaN(checkIn.getTime())) {
    return res.status(400).json({ success: false, error: 'Định dạng ngày check_in không hợp lệ (dd/mm/yyyy)' });
  }

  let checkOut;
  if (night) {
    const nights = parseInt(night);
    if (isNaN(nights) || nights < 1) {
      return res.status(400).json({ success: false, error: 'Số đêm (night) phải là số nguyên >= 1' });
    }
    checkOut = new Date(checkIn);
    checkOut.setDate(checkOut.getDate() + nights);
  } else {
    checkOut = parseDateDMY(check_out);
    if (isNaN(checkOut.getTime())) {
      return res.status(400).json({ success: false, error: 'Định dạng ngày check_out không hợp lệ (dd/mm/yyyy)' });
    }
  }

  if (checkIn >= checkOut) {
    return res.status(400).json({ success: false, error: 'Ngày check-out phải sau ngày check-in' });
  }

  try {
    const rooms = await Room.find();

    const overlapping = await Booking.aggregate([
      {
        $match: {
          status: { $in: ['Confirmed', 'CheckedIn'] },
          checkIn: { $lt: checkOut },
          checkOut: { $gt: checkIn }
        }
      },
      {
        $group: {
          _id: '$roomName',
          count: { $sum: 1 }
        }
      }
    ]);

    const bookedMap = {};
    overlapping.forEach(item => { bookedMap[item._id] = item.count; });

    const fmtDMY = d => `${String(d.getDate()).padStart(2,'0')}/${String(d.getMonth()+1).padStart(2,'0')}/${d.getFullYear()}`;
    const checkInStr = check_in;
    const checkOutStr = check_out || fmtDMY(checkOut);
    const numNights = Math.round((checkOut - checkIn) / (1000 * 60 * 60 * 24));

    const availability = await Promise.all(rooms.map(async (room) => {
      const booked = bookedMap[room.roomName] || 0;
      const unavailable = room.maintenance + room.cleaning;
      const availableRooms = Math.max(0, room.totalRooms - unavailable - booked);

      const priceInfo = await getEffectivePrice(room.roomName, checkIn);
      const stayInfo = await calculateStayPrice(room.roomName, checkIn, checkOut);

      return {
        roomName: room.roomName,
        totalRooms: room.totalRooms,
        available: availableRooms,
        booked,
        unavailable,
        pricePerNight: priceInfo.price,
        priceTier: priceInfo.tierType,
        holidayName: priceInfo.holidayName,
        totalPrice: stayInfo.totalPrice,
        priceBreakdown: stayInfo.nights,
        basePricePerNight: room.pricePerNight,
        description: room.description
      };
    }));

    const filtered = available_only === 'true'
      ? availability.filter(r => r.available > 0)
      : availability;

    if (format === 'chatbot') {
      const ROOM_IMAGES = {
        'Standard': 'https://images.unsplash.com/photo-1611892440504-42a792e24d32?w=500&q=80',
        'Deluxe': 'https://images.unsplash.com/photo-1590490360182-c33d57733427?w=500&q=80',
        'Family': 'https://images.unsplash.com/photo-1566073771259-6a8506099945?w=500&q=80',
        'Suite': 'https://images.unsplash.com/photo-1582719478250-c89cae4dc85b?w=500&q=80'
      };

      const availableRooms = filtered.filter(r => r.available > 0);

      if (availableRooms.length === 0) {
        return res.json({
          ...(messenger_user_id && { messenger_user_id }),
          messages: [{ text: `Rất tiếc, không còn phòng trống từ ${checkInStr} đến ${checkOutStr} (${numNights} đêm). Quý khách vui lòng chọn ngày khác hoặc liên hệ Hotline.` }]
        });
      }

      const elements = availableRooms.map(room => ({
        title: `Phòng ${room.roomName}`,
        image_url: ROOM_IMAGES[room.roomName] || ROOM_IMAGES['Standard'],
        subtitle: `Giá: ${room.pricePerNight.toLocaleString('vi-VN')}đ/đêm${room.priceTier === 'holiday' ? ' (' + room.holidayName + ')' : room.priceTier === 'weekend' ? ' (cuối tuần)' : ''}. Tổng ${numNights} đêm: ${room.totalPrice.toLocaleString('vi-VN')}đ. Còn ${room.available} phòng.`,
        // buttons: [
        //   {
        //     type: 'show_block',
        //     block_name: 'Đặt phòng',
        //     title: 'Đặt phòng',
        //     set_attributes: [
        //       {
        //         room_type: JSON.stringify(room.roomName)
        //       }
        //     ]
        //   }
        // ]
        quick_replies: [
        {
          title: "Đặt phòng",
          block_name: "Place Booking",
          set_attributes: {
            room_type: JSON.stringify(room.roomName)
          }
        }]
      }));

      return res.json({
        messages: [
          {
            attachment: {
              type: 'template',
              payload: {
                template_type: 'generic',
                elements
              }
            }
          }
        ],
        ...(messenger_user_id && { messenger_user_id })
      });
    }

    return res.json({
      success: true,
      checkIn: checkInStr,
      checkOut: checkOutStr,
      nights: numNights,
      data: filtered
    });
  } catch (error) {
    return res.status(500).json({ success: false, error: error.message });
  }
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

    await autoLinkBookingToCustomer(savedBooking);

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

// ─── WEBHOOK BOOKING.COM ───

const ROOM_TYPE_MAP = {
  'standard': 'Standard',
  'standard room': 'Standard',
  'standard cozy': 'Standard',
  'deluxe': 'Deluxe',
  'deluxe room': 'Deluxe',
  'deluxe ocean view': 'Deluxe',
  'double deluxe sea view': 'Deluxe',
  'family': 'Family',
  'family room': 'Family',
  'family suite': 'Family',
  'suite': 'Suite',
  'premium suite': 'Suite',
  'executive suite': 'Suite'
};

function mapRoomType(externalRoomType) {
  if (!externalRoomType) return null;
  return ROOM_TYPE_MAP[externalRoomType.trim().toLowerCase()] || null;
}

app.post('/api/webhook/booking-com', async (req, res) => {
  const apiKey = req.headers['x-api-key'];
  if (!apiKey || apiKey !== process.env.BOOKINGCOM_API_KEY) {
    return res.status(401).json({ success: false, error: 'Unauthorized' });
  }

  const { booking_id, guest_name, guest_phone, guest_email, room_type, checkin_date, checkout_date, num_guests, notes } = req.body;

  if (!booking_id || !guest_name || !room_type || !checkin_date || !checkout_date) {
    return res.status(400).json({
      success: false,
      error: 'Thiếu trường bắt buộc: booking_id, guest_name, room_type, checkin_date, checkout_date'
    });
  }

  const mappedRoomType = mapRoomType(room_type);
  if (!mappedRoomType) {
    return res.status(400).json({
      success: false,
      error: `Loại phòng không nhận diện được: "${room_type}". Các tên hợp lệ: ${Object.keys(ROOM_TYPE_MAP).join(', ')}`
    });
  }

  try {
    const existingBooking = await Booking.findOne({ externalBookingId: booking_id });
    if (existingBooking) {
      return res.status(409).json({
        success: false,
        error: 'Đơn đặt phòng đã tồn tại',
        existingBookingId: existingBooking._id
      });
    }

    const newBooking = new Booking({
      fullName: guest_name.trim(),
      phone: guest_phone ? guest_phone.trim() : 'N/A',
      email: guest_email || undefined,
      roomName: mappedRoomType,
      checkIn: new Date(checkin_date),
      checkOut: new Date(checkout_date),
      guests: num_guests || 1,
      status: 'Confirmed',
      source: 'Booking.com',
      externalBookingId: booking_id,
      notes: notes || undefined
    });

    const savedBooking = await newBooking.save();
    console.log(`✅ [BOOKING.COM] Đã lưu đơn ${booking_id} → MongoDB ID: ${savedBooking._id}`);

    await autoLinkBookingToCustomer(savedBooking);

    const mailOptions = {
      from: process.env.EMAIL_USER,
      to: process.env.EMAIL_USER,
      subject: `[BOOKING.COM] - Khách hàng: ${guest_name.toUpperCase()} (${booking_id})`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; border: 1px solid #003580; padding: 20px;">
          <h2 style="color: #003580; border-bottom: 2px solid #003580; padding-bottom: 10px;">ĐẶT PHÒNG MỚI TỪ BOOKING.COM</h2>
          <p><b>Mã đặt phòng Booking.com:</b> ${booking_id}</p>
          <p><b>Họ và tên khách hàng:</b> ${guest_name}</p>
          <p><b>Số điện thoại:</b> ${guest_phone || 'Không có'}</p>
          <p><b>Email:</b> ${guest_email || 'Không có'}</p>
          <p><b>Hạng phòng:</b> ${mappedRoomType} (gốc: ${room_type})</p>
          <p><b>Ngày nhận phòng (Check-in):</b> ${checkin_date}</p>
          <p><b>Ngày trả phòng (Check-out):</b> ${checkout_date}</p>
          <p><b>Số khách:</b> ${num_guests || 1}</p>
          ${notes ? `<p><b>Ghi chú:</b> ${notes}</p>` : ''}
          <hr style="border: 0; border-top: 1px solid #eee;">
          <p style="font-size: 12px; color: #666;">Hệ thống thông báo tự động - Đơn đã được XÁC NHẬN tự động từ Booking.com.</p>
        </div>
      `
    };

    transporter.sendMail(mailOptions, (error, info) => {
      if (error) {
        console.error('❌ Lỗi gửi email thông báo Booking.com:', error);
      } else {
        console.log('🚀 Email thông báo Booking.com đã gửi thành công:', info.response);
      }
    });

    return res.json({ success: true, bookingId: savedBooking._id });
  } catch (error) {
    console.error('❌ Lỗi xử lý webhook Booking.com:', error);
    return res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

// ─── WEBHOOK FACEBOOK LEAD ADS ───

function verifyFacebookSignature(req) {
  const signature = req.headers['x-hub-signature-256'];
  if (!signature || !process.env.FB_APP_SECRET) return false;
  const expected = 'sha256=' + crypto.createHmac('sha256', process.env.FB_APP_SECRET)
    .update(req.rawBody)
    .digest('hex');
  return crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected));
}

function extractLeadField(fieldData, fieldName) {
  const field = fieldData.find(f => f.name === fieldName);
  return field && field.values && field.values[0] ? field.values[0] : null;
}

app.get('/api/webhook/facebook', (req, res) => {
  const mode = req.query['hub.mode'];
  const token = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];

  if (mode === 'subscribe' && token === process.env.FB_VERIFY_TOKEN) {
    console.log('✅ [FACEBOOK] Webhook verification thành công');
    return res.status(200).send(challenge);
  }
  return res.status(403).send('Forbidden');
});

app.post('/api/webhook/facebook', async (req, res) => {
  if (process.env.FB_APP_SECRET && process.env.FB_APP_SECRET !== 'your_facebook_app_secret_here') {
    if (!verifyFacebookSignature(req)) {
      console.log('❌ [FACEBOOK] Chữ ký không hợp lệ');
      return res.status(401).send('Invalid signature');
    }
  }

  res.status(200).send('EVENT_RECEIVED');

  try {
    const entries = req.body.entry || [];
    for (const entry of entries) {
      const changes = entry.changes || [];
      for (const change of changes) {
        if (change.field !== 'leadgen') continue;
        const leadgenId = change.value && change.value.leadgen_id;
        if (!leadgenId) continue;

        const existing = await Booking.findOne({ externalBookingId: `fb-${leadgenId}` });
        if (existing) {
          console.log(`⏭️ [FACEBOOK] Lead ${leadgenId} đã tồn tại, bỏ qua`);
          continue;
        }

        console.log(`📥 [FACEBOOK] Nhận lead mới: ${leadgenId}`);

        const graphUrl = `https://graph.facebook.com/v21.0/${leadgenId}?access_token=${process.env.FB_PAGE_ACCESS_TOKEN}`;
        const graphRes = await fetch(graphUrl);
        if (!graphRes.ok) {
          console.error(`❌ [FACEBOOK] Lỗi Graph API: ${graphRes.status} ${graphRes.statusText}`);
          continue;
        }

        const leadData = await graphRes.json();
        const fieldData = leadData.field_data || [];

        const fullName = extractLeadField(fieldData, 'full_name') || 'Khách Facebook';
        const phone = extractLeadField(fieldData, 'phone_number') || 'N/A';
        const email = extractLeadField(fieldData, 'email') || undefined;
        const roomTypeRaw = extractLeadField(fieldData, 'room_type');
        const checkinRaw = extractLeadField(fieldData, 'check_in_date');
        const checkoutRaw = extractLeadField(fieldData, 'check_out_date');

        const mappedRoom = mapRoomType(roomTypeRaw) || 'Standard';
        const today = new Date();
        const tomorrow = new Date(today);
        tomorrow.setDate(tomorrow.getDate() + 1);
        const checkIn = checkinRaw ? new Date(checkinRaw) : today;
        const checkOut = checkoutRaw ? new Date(checkoutRaw) : tomorrow;

        const noteParts = [];
        if (!roomTypeRaw) noteParts.push('Loại phòng mặc định (chưa chọn)');
        if (!checkinRaw) noteParts.push('Ngày nhận phòng mặc định (chưa chọn)');

        const newBooking = new Booking({
          fullName: fullName.trim(),
          phone: phone.trim(),
          email,
          roomName: mappedRoom,
          checkIn,
          checkOut,
          guests: 1,
          status: 'Pending',
          source: 'Facebook',
          externalBookingId: `fb-${leadgenId}`,
          notes: noteParts.length > 0 ? noteParts.join('. ') : undefined
        });

        const saved = await newBooking.save();
        console.log(`✅ [FACEBOOK] Đã lưu lead ${leadgenId} → MongoDB ID: ${saved._id}`);

        await autoLinkBookingToCustomer(saved);

        const mailOptions = {
          from: process.env.EMAIL_USER,
          to: process.env.EMAIL_USER,
          subject: `[FACEBOOK] - Khách hàng: ${fullName.toUpperCase()} (Lead ${leadgenId})`,
          html: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; border: 1px solid #1877F2; padding: 20px;">
              <h2 style="color: #1877F2; border-bottom: 2px solid #1877F2; padding-bottom: 10px;">KHÁCH HÀNG MỚI TỪ FACEBOOK</h2>
              <p><b>Mã Lead Facebook:</b> ${leadgenId}</p>
              <p><b>Họ và tên:</b> ${fullName}</p>
              <p><b>Số điện thoại:</b> ${phone !== 'N/A' ? phone : 'Không có'}</p>
              <p><b>Email:</b> ${email || 'Không có'}</p>
              <p><b>Hạng phòng:</b> ${mappedRoom}${roomTypeRaw ? ` (gốc: ${roomTypeRaw})` : ' (mặc định)'}</p>
              <p><b>Ngày nhận phòng:</b> ${checkinRaw || 'Chưa chọn - cần liên hệ khách'}</p>
              <p><b>Ngày trả phòng:</b> ${checkoutRaw || 'Chưa chọn - cần liên hệ khách'}</p>
              <hr style="border: 0; border-top: 1px solid #eee;">
              <p style="font-size: 12px; color: #666;">Hệ thống thông báo tự động - Vui lòng GỌI ĐIỆN xác nhận với khách hàng.</p>
            </div>
          `
        };

        transporter.sendMail(mailOptions, (error, info) => {
          if (error) {
            console.error('❌ Lỗi gửi email thông báo Facebook:', error);
          } else {
            console.log('🚀 Email thông báo Facebook đã gửi thành công:', info.response);
          }
        });
      }
    }
  } catch (error) {
    console.error('❌ Lỗi xử lý webhook Facebook:', error);
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

// ─────────────────────────────────────────────────────────────────
// CHỨC NĂNG DÀNH CHO ADMIN
// ─────────────────────────────────────────────────────────────────

// 1. API: Lấy danh sách TOÀN BỘ đơn đặt phòng để hiển thị ra bảng Admin
app.get('/api/admin/bookings', requireAdmin, async (req, res) => {
  try {
    // Sắp xếp đơn mới nhất (createdAt: -1) lên đầu bảng
    const bookings = await Booking.find().populate('customer', 'customerId name').sort({ createdAt: -1 });
    return res.json({ success: true, data: bookings });
  } catch (error) {
    return res.status(500).json({ success: false, error: error.message });
  }
});

// 2. API: Cập nhật trạng thái đơn (Duyệt / Hủy / Nhận phòng...)
app.patch('/api/admin/bookings/:id/status', requireAdmin, async (req, res) => {
  const { id } = req.params;      // Lấy ID đơn từ đường dẫn URL
  const { status } = req.body;    // Lấy trạng thái mới truyền lên (ví dụ: 'Confirmed' hoặc 'Cancelled')

  // Kiểm tra trạng thái gửi lên có nằm trong danh sách Enum của Booking.js không
  const validStatuses = ['Pending', 'Confirmed', 'Cancelled', 'CheckedIn', 'CheckedOut'];
  if (!validStatuses.includes(status)) {
    return res.status(400).json({ success: false, error: 'Trạng thái chuyển đổi không hợp lệ!' });
  }

  try {
    // Tìm đơn theo ID và cập nhật status mới
    const updatedBooking = await Booking.findByIdAndUpdate(
      id,
      { status: status },
      { new: true, runValidators: true } // {new: true} để trả về data mới nhất sau khi sửa
    );

    if (!updatedBooking) {
      return res.status(404).json({ success: false, error: 'Không tìm thấy đơn đặt phòng này!' });
    }

    console.log(`🔄 [ADMIN] Đã đổi trạng thái đơn [${id}] sang thành công: ${status}`);

    // Tự động cập nhật trạng thái phòng khi booking thay đổi
    const assignedRoom = await PhysicalRoom.findOne({ currentBooking: id });
    if (assignedRoom) {
      if (status === 'CheckedIn') {
        assignedRoom.status = 'occupied';
        await assignedRoom.save();
        console.log(`🏨 [PHÒNG] ${assignedRoom.roomNumber} → occupied (khách nhận phòng)`);
      } else if (status === 'CheckedOut') {
        assignedRoom.status = 'cleaning';
        assignedRoom.currentBooking = null;
        await assignedRoom.save();
        console.log(`🧹 [PHÒNG] ${assignedRoom.roomNumber} → cleaning (khách trả phòng)`);
      } else if (status === 'Cancelled') {
        assignedRoom.status = 'available';
        assignedRoom.currentBooking = null;
        await assignedRoom.save();
        console.log(`🔓 [PHÒNG] ${assignedRoom.roomNumber} → available (booking bị hủy)`);
      }
    }

    if (status === 'Confirmed' && updatedBooking.email) {
       console.log(`📧 Đang gửi email xác nhận cho khách hàng: ${updatedBooking.email}`);
    }

    return res.json({
      success: true,
      message: `Đã cập nhật trạng thái đơn thành công sang: ${status}`,
      data: updatedBooking
    });

  } catch (error) {
    console.error('❌ Lỗi duyệt đơn:', error.message);
    return res.status(500).json({ success: false, error: error.message });
  }
});

// ─────────────────────────────────────────────────────────────────
// QUẢN LÝ PHÒNG
// ─────────────────────────────────────────────────────────────────

const DEFAULT_ROOMS = [
  { roomName: 'Standard', totalRooms: 10, available: 10, pricePerNight: 500000, description: 'Phòng tiêu chuẩn' },
  { roomName: 'Deluxe', totalRooms: 8, available: 8, pricePerNight: 800000, description: 'Phòng cao cấp view biển' },
  { roomName: 'Family', totalRooms: 5, available: 5, pricePerNight: 1200000, description: 'Phòng gia đình rộng rãi' },
  { roomName: 'Suite', totalRooms: 3, available: 3, pricePerNight: 2000000, description: 'Phòng hạng sang VIP' }
];

app.get('/admin/rooms', requireAdmin, async (req, res) => {
  try {
    let rooms = await Room.find().sort({ roomName: 1 });
    if (rooms.length === 0) {
      rooms = await Room.insertMany(DEFAULT_ROOMS);
      console.log('✅ Đã tạo dữ liệu phòng mặc định');
    }
    res.render('admin-rooms', { rooms });
  } catch (error) {
    console.error('Lỗi tải dữ liệu phòng:', error);
    res.status(500).send('Đã có lỗi xảy ra khi tải dữ liệu phòng.');
  }
});

app.get('/api/admin/rooms', requireAdmin, async (req, res) => {
  try {
    const rooms = await Room.find().sort({ roomName: 1 });
    return res.json({ success: true, data: rooms });
  } catch (error) {
    return res.status(500).json({ success: false, error: error.message });
  }
});

app.post('/api/admin/rooms', requireAdmin, async (req, res) => {
  const { roomName, totalRooms, pricePerNight, description } = req.body;

  if (!roomName || totalRooms == null || pricePerNight == null) {
    return res.status(400).json({ success: false, error: 'Thiếu thông tin bắt buộc' });
  }

  try {
    const existing = await Room.findOne({ roomName });
    if (existing) {
      const diff = totalRooms - existing.totalRooms;
      existing.totalRooms = totalRooms;
      existing.available = Math.max(0, existing.available + diff);
      existing.pricePerNight = pricePerNight;
      if (description !== undefined) existing.description = description;
      const saved = await existing.save();
      return res.json({ success: true, message: 'Đã cập nhật loại phòng', data: saved });
    }

    const newRoom = new Room({
      roomName,
      totalRooms,
      available: totalRooms,
      occupied: 0,
      maintenance: 0,
      cleaning: 0,
      pricePerNight,
      description
    });
    const saved = await newRoom.save();
    return res.json({ success: true, message: 'Đã thêm loại phòng mới', data: saved });
  } catch (error) {
    return res.status(500).json({ success: false, error: error.message });
  }
});

app.patch('/api/admin/rooms/:id/status', requireAdmin, async (req, res) => {
  const { id } = req.params;
  const { from, to, count } = req.body;

  const validStatuses = ['available', 'occupied', 'maintenance', 'cleaning'];
  if (!validStatuses.includes(from) || !validStatuses.includes(to)) {
    return res.status(400).json({ success: false, error: 'Trạng thái không hợp lệ' });
  }
  if (from === to) {
    return res.status(400).json({ success: false, error: 'Trạng thái nguồn và đích phải khác nhau' });
  }
  if (!count || count < 1) {
    return res.status(400).json({ success: false, error: 'Số lượng phải lớn hơn 0' });
  }

  try {
    const room = await Room.findById(id);
    if (!room) {
      return res.status(404).json({ success: false, error: 'Không tìm thấy loại phòng' });
    }
    if (room[from] < count) {
      return res.status(400).json({
        success: false,
        error: `Không đủ phòng để chuyển: ${from} hiện có ${room[from]}, yêu cầu ${count}`
      });
    }

    room[from] -= count;
    room[to] += count;
    const saved = await room.save();
    console.log(`🔄 [PHÒNG] Chuyển ${count} phòng ${room.roomName}: ${from} → ${to}`);
    return res.json({ success: true, message: `Đã chuyển ${count} phòng từ ${from} sang ${to}`, data: saved });
  } catch (error) {
    return res.status(500).json({ success: false, error: error.message });
  }
});

app.delete('/api/admin/rooms/:id', requireAdmin, async (req, res) => {
  try {
    const deleted = await Room.findByIdAndDelete(req.params.id);
    if (!deleted) {
      return res.status(404).json({ success: false, error: 'Không tìm thấy loại phòng' });
    }
    console.log(`🗑️ [PHÒNG] Đã xóa loại phòng: ${deleted.roomName}`);
    return res.json({ success: true, message: `Đã xóa loại phòng ${deleted.roomName}` });
  } catch (error) {
    return res.status(500).json({ success: false, error: error.message });
  }
});

// ─────────────────────────────────────────────────────────────────
// QUẢN LÝ BẢNG GIÁ PHÒNG
// ─────────────────────────────────────────────────────────────────

app.get('/admin/prices', requireAdmin, async (req, res) => {
  try {
    let prices = await RoomPrice.find().sort({ roomName: 1, tierType: 1, startDate: 1 });

    if (prices.length === 0) {
      const rooms = await Room.find();
      const defaults = rooms.map(r => ({
        roomName: r.roomName,
        tierType: 'normal',
        price: r.pricePerNight
      }));
      if (defaults.length > 0) {
        prices = await RoomPrice.insertMany(defaults);
        console.log('✅ Đã tạo bảng giá mặc định từ giá phòng hiện tại');
      }
    }

    res.render('admin-prices', { prices });
  } catch (error) {
    console.error('Lỗi tải bảng giá:', error);
    res.status(500).send('Đã có lỗi xảy ra khi tải dữ liệu bảng giá.');
  }
});

app.get('/api/admin/prices', requireAdmin, async (req, res) => {
  try {
    const prices = await RoomPrice.find().sort({ roomName: 1, tierType: 1, startDate: 1 });
    return res.json({ success: true, data: prices });
  } catch (error) {
    return res.status(500).json({ success: false, error: error.message });
  }
});

app.post('/api/admin/prices', requireAdmin, async (req, res) => {
  const { roomName, tierType, price, holidayName, startDate, endDate } = req.body;

  if (!roomName || !tierType || price == null) {
    return res.status(400).json({ success: false, error: 'Thiếu thông tin bắt buộc' });
  }

  try {
    if (tierType === 'normal' || tierType === 'weekend') {
      const result = await RoomPrice.findOneAndUpdate(
        { roomName, tierType },
        { price },
        { new: true, upsert: true, runValidators: true }
      );
      return res.json({ success: true, message: `Đã cập nhật giá ${tierType}`, data: result });
    }

    const newPrice = new RoomPrice({
      roomName, tierType, price, holidayName,
      startDate: startDate ? new Date(startDate) : null,
      endDate: endDate ? new Date(endDate) : null
    });
    const saved = await newPrice.save();
    return res.json({ success: true, message: 'Đã thêm giá dịp lễ', data: saved });
  } catch (error) {
    return res.status(500).json({ success: false, error: error.message });
  }
});

app.put('/api/admin/prices/:id', requireAdmin, async (req, res) => {
  const { id } = req.params;
  const { roomName, tierType, price, holidayName, startDate, endDate } = req.body;

  try {
    const updateData = { roomName, tierType, price };
    if (tierType === 'holiday') {
      updateData.holidayName = holidayName;
      updateData.startDate = startDate ? new Date(startDate) : null;
      updateData.endDate = endDate ? new Date(endDate) : null;
    } else {
      updateData.holidayName = null;
      updateData.startDate = null;
      updateData.endDate = null;
    }

    const updated = await RoomPrice.findByIdAndUpdate(id, updateData, { new: true, runValidators: true });
    if (!updated) {
      return res.status(404).json({ success: false, error: 'Không tìm thấy quy tắc giá' });
    }
    return res.json({ success: true, message: 'Đã cập nhật quy tắc giá', data: updated });
  } catch (error) {
    return res.status(500).json({ success: false, error: error.message });
  }
});

app.delete('/api/admin/prices/:id', requireAdmin, async (req, res) => {
  try {
    const deleted = await RoomPrice.findByIdAndDelete(req.params.id);
    if (!deleted) {
      return res.status(404).json({ success: false, error: 'Không tìm thấy quy tắc giá' });
    }
    console.log(`🗑️ [GIÁ] Đã xóa: ${deleted.roomName} - ${deleted.tierType}`);
    return res.json({ success: true, message: 'Đã xóa quy tắc giá' });
  } catch (error) {
    return res.status(500).json({ success: false, error: error.message });
  }
});

// ─────────────────────────────────────────────────────────────────
// SƠ ĐỒ PHÒNG (ROOM MAP)
// ─────────────────────────────────────────────────────────────────

const DEFAULT_PHYSICAL_ROOMS = [];
for (let floor = 1; floor <= 5; floor++) {
  for (let idx = 1; idx <= 5; idx++) {
    DEFAULT_PHYSICAL_ROOMS.push({
      roomNumber: PhysicalRoom.generateRoomNumber('Standard', floor, idx),
      floor,
      roomIndex: idx,
      roomType: 'Standard',
      status: 'available'
    });
  }
}

app.get('/admin/room-map', requireAdmin, async (req, res) => {
  try {
    let rooms = await PhysicalRoom.find().sort({ floor: 1, roomIndex: 1 }).populate('currentBooking');
    if (rooms.length === 0) {
      rooms = await PhysicalRoom.insertMany(DEFAULT_PHYSICAL_ROOMS);
      console.log('✅ Đã tạo sơ đồ phòng mặc định (25 phòng)');
    }
    res.render('admin-room-map', { rooms });
  } catch (error) {
    console.error('Lỗi tải sơ đồ phòng:', error);
    res.status(500).send('Đã có lỗi xảy ra khi tải sơ đồ phòng.');
  }
});

app.get('/api/admin/room-map', requireAdmin, async (req, res) => {
  try {
    const rooms = await PhysicalRoom.find().sort({ floor: 1, roomIndex: 1 }).populate('currentBooking');
    let statusOverrides = {};

    if (req.query.date) {
      const targetDate = new Date(req.query.date);
      targetDate.setHours(0, 0, 0, 0);
      const nextDay = new Date(targetDate);
      nextDay.setDate(nextDay.getDate() + 1);

      const activeBookings = await Booking.find({
        status: { $in: ['Confirmed', 'CheckedIn'] },
        checkIn: { $lt: nextDay },
        checkOut: { $gt: targetDate }
      });

      const bookingMap = {};
      activeBookings.forEach(b => { bookingMap[b._id.toString()] = b; });

      rooms.forEach(room => {
        if (room.currentBooking) {
          const bId = room.currentBooking._id ? room.currentBooking._id.toString() : room.currentBooking.toString();
          if (bookingMap[bId]) {
            const b = bookingMap[bId];
            statusOverrides[room._id.toString()] = {
              status: b.status === 'CheckedIn' ? 'occupied' : 'reserved',
              booking: { _id: b._id, fullName: b.fullName, checkIn: b.checkIn, checkOut: b.checkOut, roomName: b.roomName, status: b.status }
            };
          }
        }
      });
    }

    return res.json({ success: true, data: rooms, statusOverrides, date: req.query.date || null });
  } catch (error) {
    return res.status(500).json({ success: false, error: error.message });
  }
});

app.post('/api/admin/room-map/seed', requireAdmin, async (req, res) => {
  try {
    await PhysicalRoom.deleteMany({});
    const rooms = await PhysicalRoom.insertMany(DEFAULT_PHYSICAL_ROOMS);
    console.log('✅ Đã khởi tạo lại sơ đồ phòng mặc định');
    return res.json({ success: true, message: `Đã khởi tạo lại ${rooms.length} phòng mặc định`, count: rooms.length });
  } catch (error) {
    return res.status(500).json({ success: false, error: error.message });
  }
});

app.patch('/api/admin/room-map/:id/config', requireAdmin, async (req, res) => {
  const { roomType, label, notes } = req.body;

  try {
    const room = await PhysicalRoom.findById(req.params.id);
    if (!room) {
      return res.status(404).json({ success: false, error: 'Không tìm thấy phòng' });
    }

    if (roomType && roomType !== room.roomType) {
      room.roomType = roomType;
      room.roomNumber = PhysicalRoom.generateRoomNumber(roomType, room.floor, room.roomIndex);
    }
    if (label !== undefined) room.label = label;
    if (notes !== undefined) room.notes = notes;

    const saved = await room.save();
    return res.json({ success: true, message: 'Đã cập nhật cấu hình phòng', data: saved });
  } catch (error) {
    return res.status(500).json({ success: false, error: error.message });
  }
});

app.patch('/api/admin/room-map/:id/status', requireAdmin, async (req, res) => {
  const { status } = req.body;
  const validStatuses = ['available', 'reserved', 'occupied', 'maintenance', 'cleaning'];
  if (!validStatuses.includes(status)) {
    return res.status(400).json({ success: false, error: 'Trạng thái không hợp lệ' });
  }

  try {
    const room = await PhysicalRoom.findById(req.params.id);
    if (!room) {
      return res.status(404).json({ success: false, error: 'Không tìm thấy phòng' });
    }

    room.status = status;
    if (status === 'available') room.currentBooking = null;
    if (status === 'reserved' && !room.currentBooking) room.status = 'available';
    const saved = await room.save();
    return res.json({ success: true, message: `Đã cập nhật trạng thái phòng ${room.roomNumber}`, data: saved });
  } catch (error) {
    return res.status(500).json({ success: false, error: error.message });
  }
});

app.get('/api/admin/room-map/:id/eligible-bookings', requireAdmin, async (req, res) => {
  try {
    const room = await PhysicalRoom.findById(req.params.id);
    if (!room) {
      return res.status(404).json({ success: false, error: 'Không tìm thấy phòng' });
    }

    const dateStr = req.query.date || new Date().toISOString().split('T')[0];
    const targetDate = new Date(dateStr);
    targetDate.setHours(0, 0, 0, 0);
    const nextDay = new Date(targetDate);
    nextDay.setDate(nextDay.getDate() + 1);

    const bookings = await Booking.find({
      roomName: room.roomType,
      status: { $in: ['Confirmed', 'CheckedIn'] },
      checkIn: { $lt: nextDay },
      checkOut: { $gt: targetDate }
    }).sort({ checkIn: 1 });

    return res.json({ success: true, data: bookings });
  } catch (error) {
    return res.status(500).json({ success: false, error: error.message });
  }
});

app.post('/api/admin/room-map/:id/assign-booking', requireAdmin, async (req, res) => {
  const { bookingId } = req.body;

  try {
    const room = await PhysicalRoom.findById(req.params.id);
    if (!room) {
      return res.status(404).json({ success: false, error: 'Không tìm thấy phòng' });
    }

    const booking = await Booking.findById(bookingId);
    if (!booking) {
      return res.status(404).json({ success: false, error: 'Không tìm thấy booking' });
    }

    if (!['Confirmed', 'CheckedIn'].includes(booking.status)) {
      return res.status(400).json({ success: false, error: 'Booking phải ở trạng thái Confirmed hoặc CheckedIn' });
    }

    if (booking.roomName !== room.roomType) {
      return res.status(400).json({ success: false, error: `Loại phòng không khớp: booking là ${booking.roomName}, phòng là ${room.roomType}` });
    }

    const duplicate = await PhysicalRoom.findOne({ currentBooking: bookingId, _id: { $ne: room._id } });
    if (duplicate) {
      return res.status(400).json({ success: false, error: `Booking này đã được gán cho phòng ${duplicate.roomNumber}` });
    }

    room.currentBooking = bookingId;
    room.status = booking.status === 'CheckedIn' ? 'occupied' : 'reserved';
    const saved = await room.save();
    const populated = await PhysicalRoom.findById(saved._id).populate('currentBooking');

    console.log(`🏨 [PHÒNG] Gán booking ${bookingId} → phòng ${room.roomNumber}`);
    return res.json({ success: true, message: `Đã gán booking cho phòng ${room.roomNumber}`, data: populated });
  } catch (error) {
    return res.status(500).json({ success: false, error: error.message });
  }
});

// ─────────────────────────────────────────────────────────────────
// LỊCH PHÒNG (ROOM CALENDAR)
// ─────────────────────────────────────────────────────────────────

app.get('/admin/room-calendar', requireAdmin, (req, res) => {
  res.render('admin-room-calendar');
});

app.get('/api/admin/room-calendar', requireAdmin, async (req, res) => {
  const { start, end } = req.query;
  if (!start || !end) {
    return res.status(400).json({ success: false, error: 'Thiếu tham số start hoặc end' });
  }

  try {
    const startDate = new Date(start);
    startDate.setHours(0, 0, 0, 0);
    const endDate = new Date(end);
    endDate.setHours(23, 59, 59, 999);

    const rooms = await PhysicalRoom.find()
      .sort({ roomType: 1, floor: 1, roomIndex: 1 })
      .populate('currentBooking');

    const overlappingBookings = await Booking.find({
      status: { $in: ['Confirmed', 'CheckedIn'] },
      checkIn: { $lt: endDate },
      checkOut: { $gt: startDate }
    });

    const assignedBookingIds = new Set();
    rooms.forEach(room => {
      if (room.currentBooking && room.currentBooking._id) {
        assignedBookingIds.add(room.currentBooking._id.toString());
      }
    });

    const typeOrder = ['Standard', 'Deluxe', 'Family', 'Suite'];
    const roomTypes = typeOrder.map(type => {
      const typeRooms = rooms.filter(r => r.roomType === type);
      const unassigned = overlappingBookings.filter(b =>
        b.roomName === type && !assignedBookingIds.has(b._id.toString())
      );
      return {
        type,
        rooms: typeRooms.map(r => {
          const hasBooking = r.currentBooking && assignedBookingIds.has(r.currentBooking._id.toString());
          const bookingOverlaps = hasBooking && r.currentBooking.checkIn < endDate && r.currentBooking.checkOut > startDate;
          return {
            _id: r._id,
            roomNumber: r.roomNumber,
            floor: r.floor,
            status: r.status,
            label: r.label,
            booking: bookingOverlaps ? {
              _id: r.currentBooking._id,
              fullName: r.currentBooking.fullName,
              checkIn: r.currentBooking.checkIn,
              checkOut: r.currentBooking.checkOut,
              status: r.currentBooking.status
            } : null
          };
        }),
        unassignedBookings: unassigned.map(b => ({
          _id: b._id, fullName: b.fullName, checkIn: b.checkIn,
          checkOut: b.checkOut, status: b.status
        }))
      };
    });

    return res.json({ success: true, dateRange: { start, end }, roomTypes });
  } catch (error) {
    return res.status(500).json({ success: false, error: error.message });
  }
});

// ─── QUẢN LÝ KHÁCH HÀNG ───

app.get('/admin/customers', requireAdmin, async (req, res) => {
  try {
    const customers = await Customer.find().sort({ createdAt: -1 });
    res.render('admin-customers', { customers });
  } catch (error) {
    res.status(500).send('Lỗi tải danh sách khách hàng');
  }
});

app.get('/api/admin/customers', requireAdmin, async (req, res) => {
  try {
    const { search } = req.query;
    let query = {};
    if (search && search.trim()) {
      const s = search.trim();
      query = {
        $or: [
          { name: { $regex: s, $options: 'i' } },
          { phone: { $regex: s, $options: 'i' } },
          { customerId: { $regex: s, $options: 'i' } },
          { email: { $regex: s, $options: 'i' } }
        ]
      };
    }
    const customers = await Customer.find(query).sort({ createdAt: -1 });
    return res.json({ success: true, data: customers });
  } catch (error) {
    return res.status(500).json({ success: false, error: error.message });
  }
});

app.post('/api/admin/customers', requireAdmin, async (req, res) => {
  try {
    const { name, phone, email, identityCard, source, notes } = req.body;
    if (!name || !phone) {
      return res.status(400).json({ success: false, error: 'Họ tên và số điện thoại là bắt buộc' });
    }

    const normalizedPhone = Customer.normalizePhone(phone.trim());
    const existing = await Customer.findOne({ phone: normalizedPhone });
    if (existing) {
      return res.status(409).json({ success: false, error: `Số điện thoại đã tồn tại (${existing.customerId} - ${existing.name})` });
    }

    const customer = new Customer({
      name: name.trim(),
      phone: phone.trim(),
      email: email ? email.trim() : undefined,
      identityCard: identityCard ? identityCard.trim() : undefined,
      source: source || 'Walk-in',
      notes: notes ? notes.trim() : undefined
    });
    const saved = await customer.save();

    const linked = await Booking.updateMany(
      { phone: normalizedPhone, customer: null },
      { customer: saved._id }
    );
    const linkMsg = linked.modifiedCount > 0 ? ` (đã liên kết ${linked.modifiedCount} đơn đặt phòng)` : '';

    return res.json({ success: true, message: `Đã thêm khách hàng ${saved.customerId}${linkMsg}`, data: saved });
  } catch (error) {
    return res.status(500).json({ success: false, error: error.message });
  }
});

app.put('/api/admin/customers/:id', requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const { name, phone, email, identityCard, source, notes } = req.body;

    const customer = await Customer.findById(id);
    if (!customer) return res.status(404).json({ success: false, error: 'Không tìm thấy khách hàng' });

    if (name) customer.name = name.trim();
    if (phone) {
      const normalizedPhone = Customer.normalizePhone(phone.trim());
      const dup = await Customer.findOne({ phone: normalizedPhone, _id: { $ne: id } });
      if (dup) return res.status(409).json({ success: false, error: `Số điện thoại đã thuộc về ${dup.customerId} - ${dup.name}` });
      customer.phone = phone.trim();
    }
    if (email !== undefined) customer.email = email ? email.trim() : '';
    if (identityCard !== undefined) customer.identityCard = identityCard ? identityCard.trim() : '';
    if (source) customer.source = source;
    if (notes !== undefined) customer.notes = notes ? notes.trim() : '';

    const saved = await customer.save();

    if (phone) {
      await Booking.updateMany(
        { phone: saved.phone, customer: null },
        { customer: saved._id }
      );
    }

    return res.json({ success: true, message: 'Đã cập nhật khách hàng', data: saved });
  } catch (error) {
    return res.status(500).json({ success: false, error: error.message });
  }
});

app.delete('/api/admin/customers/:id', requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    await Booking.updateMany({ customer: id }, { customer: null });
    const deleted = await Customer.findByIdAndDelete(id);
    if (!deleted) return res.status(404).json({ success: false, error: 'Không tìm thấy khách hàng' });
    return res.json({ success: true, message: `Đã xóa khách hàng ${deleted.customerId}` });
  } catch (error) {
    return res.status(500).json({ success: false, error: error.message });
  }
});

app.get('/api/admin/customers/:id/details', requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const customer = await Customer.findById(id);
    if (!customer) return res.status(404).json({ success: false, error: 'Không tìm thấy khách hàng' });

    const bookings = await Booking.find({ customer: id }).sort({ checkIn: -1 });
    return res.json({ success: true, customer, bookings });
  } catch (error) {
    return res.status(500).json({ success: false, error: error.message });
  }
});

app.post('/api/admin/customers/auto-link-all', requireAdmin, async (req, res) => {
  try {
    const customers = await Customer.find();
    let totalLinked = 0;

    for (const c of customers) {
      const result = await Booking.updateMany(
        { phone: c.phone, customer: null },
        { customer: c._id }
      );
      totalLinked += result.modifiedCount;
    }

    return res.json({ success: true, message: `Đã liên kết ${totalLinked} đơn đặt phòng với khách hàng` });
  } catch (error) {
    return res.status(500).json({ success: false, error: error.message });
  }
});

app.listen(PORT, () => {
  console.log('Server Windy Hotel Cửa Lò đang chạy tại: http://localhost:' + PORT);
});