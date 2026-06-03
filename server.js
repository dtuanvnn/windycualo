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

    const availability = rooms.map(room => {
      const booked = bookedMap[room.roomName] || 0;
      const unavailable = room.maintenance + room.cleaning;
      const availableRooms = Math.max(0, room.totalRooms - unavailable - booked);
      return {
        roomName: room.roomName,
        totalRooms: room.totalRooms,
        available: availableRooms,
        booked,
        unavailable,
        pricePerNight: room.pricePerNight,
        description: room.description
      };
    });

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
        subtitle: `Giá: ${room.pricePerNight.toLocaleString('vi-VN')}đ/đêm. Còn ${room.available} phòng trống.`,
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
    const bookings = await Booking.find().sort({ createdAt: -1 });
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

    // 🔥 TÍNH NĂNG NÂNG CAO (Tùy chọn): Tự động gửi email chúc mừng cho khách khi được Admin duyệt
    if (status === 'Confirmed' && updatedBooking.email) {
       console.log(`📧 Đang gửi email xác nhận cho khách hàng: ${updatedBooking.email}`);
       // Bạn có thể dùng đoạn code transporter.sendMail() ở đây để thông báo cho khách "Phòng của bạn đã được xác nhận thành công!"
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

app.listen(PORT, () => {
  console.log('Server Windy Hotel Cửa Lò đang chạy tại: http://localhost:' + PORT);
});