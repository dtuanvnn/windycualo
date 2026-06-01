let currentLang = 'vi';

function switchLanguage(lang) {
  currentLang = lang;
  
  // Active class hiệu ứng nút bấm đổi ngôn ngữ
  document.querySelectorAll('.lang-btn').forEach(btn => {
    btn.classList.toggle('active', btn.getAttribute('onclick').includes(lang));
  });

  // Tìm toàn bộ dữ liệu đa ngôn ngữ để chuyển đổi
  document.querySelectorAll('[data-vi]').forEach(el => {
    const text = lang === 'vi' ? el.getAttribute('data-vi') : el.getAttribute('data-en');
    if (text) {
      if (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA') {
        el.placeholder = text;
      } else {
        el.innerText = text;
      }
    }
  });
}

// Chạy Slider ảnh tự động
let slideIndex = 0;
const slides = document.querySelectorAll('.slide');

function showSlides(n) {
  if (n >= slides.length) slideIndex = 0;
  else if (n < 0) slideIndex = slides.length - 1;
  else slideIndex = n;

  slides.forEach((slide, i) => {
    slide.classList.toggle('active', i === slideIndex);
  });
}

function moveSlide(n) { showSlides(slideIndex + n); }
setInterval(() => moveSlide(1), 5000);

// Xử lý Lọc nội dung bài viết qua Sub-menu
function filterNews(category) {
  const cards = document.querySelectorAll('.news-card');
  
  document.querySelectorAll('.filter-btn').forEach(btn => {
    const viText = btn.getAttribute('data-vi');
    const isActive = (category === 'all' && viText === 'Tất Cả') ||
                     (category === 'promo' && viText === 'Khuyến Mãi') ||
                     (category === 'food' && viText === 'Ẩm Thực') ||
                     (category === 'travel' && viText === 'Du Lịch Cửa Lò');
    btn.classList.toggle('active', isActive);
  });

  cards.forEach(card => {
    if (category === 'all' || card.getAttribute('data-category') === category) {
      card.style.display = 'block';
    } else {
      card.style.display = 'none';
    }
  });
}

// Xử lý gửi Form Đặt phòng AJAX
function handleBooking(event) {
  event.preventDefault(); // Ngăn chặn trình duyệt tải lại trang khi submit form

  // Thu thập dữ liệu từ form
  const bookingData = {
    fullName: document.getElementById('custName').value.trim(),
    phone: document.getElementById('custPhone').value.trim(),
    checkin: document.getElementById('checkin').value,
    checkout: document.getElementById('checkout').value,
    roomType: document.getElementById('roomType').value
  };

  // ─── THÊM VÀO ĐÂY: VALIDATE SỐ ĐIỆN THOẠI VIỆT NAM ───
  // Regex kiểm tra đầu số 03, 05, 07, 08, 09 hoặc +84 và đủ 10 số
  const vnmPhoneRegex = /^(0|\+84)(3|5|7|8|9)\d{8}$/;
  
  if (!vnmPhoneRegex.test(bookingData.phone)) {
    alert(currentLang === 'vi' 
      ? 'Số điện thoại không hợp lệ! Vui lòng nhập đúng số di động (ví dụ: 0912xxxxxx).' 
      : 'Invalid phone number! Please enter a valid Vietnamese mobile number (e.g., 0912xxxxxx).');
    
    // Đặt lại con trỏ chuột vào ô số điện thoại để khách nhập lại
    document.getElementById('custPhone').focus();
    return; // Dừng hàm lại, không gửi dữ liệu lên server nữa
  }
  // ─────────────────────────────────────────────────────

  // Kiểm tra logic ngày cơ bản tại frontend (giữ nguyên bên dưới)
  if (new Date(bookingData.checkin) >= new Date(bookingData.checkout)) {
    alert(currentLang === 'vi' ? 'Ngày trả phòng phải sau ngày nhận phòng!' : 'Check-out date must be after check-in date!');
    return;
  }

  // Đổi trạng thái nút bấm để tránh khách click liên tục nhiều lần
  const submitBtn = document.querySelector('.btn-submit-booking');
  submitBtn.disabled = true;
  submitBtn.innerText = currentLang === 'vi' ? 'Đang gửi...' : 'Sending...';

  // Gửi gói dữ liệu lên API Backend Node.js
  fetch('/api/booking', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(bookingData)
  })
  .then(res => res.json())
  .then(data => {
    if (data.success) {
      alert(currentLang === 'vi' ? data.messageVi : data.messageEn);
      // Xóa trắng ô nhập tên và sđt sau khi đặt thành công
      document.getElementById('custName').value = '';
      document.getElementById('custPhone').value = '';
    } else {
      alert('Có lỗi xảy ra: ' + data.error);
    }
  })
  .catch(err => {
    console.error('Lỗi kết nối:', err);
    alert('Không thể kết nối tới máy chủ!');
  })
  .finally(() => {
    // Trả lại trạng thái ban đầu cho nút bấm
    submitBtn.disabled = false;
    submitBtn.innerText = currentLang === 'vi' ? 'Đặt Phòng Ngay' : 'Book Now';
  });
}

// Gắn ngày mặc định
window.addEventListener('DOMContentLoaded', () => {
  const today = new Date();
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);
  const fmt = d => d.toISOString().split('T')[0];
  
  document.getElementById('checkin').value = fmt(today);
  document.getElementById('checkout').value = fmt(tomorrow);
});