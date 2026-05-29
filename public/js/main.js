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
  event.preventDefault();
  const data = {
    checkin: document.getElementById('checkin').value,
    checkout: document.getElementById('checkout').value,
    guests: document.getElementById('guests').value,
    roomType: document.getElementById('roomType').value
  };

  fetch('/api/booking', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data)
  })
  .then(res => res.json())
  .then(resData => {
    alert(currentLang === 'vi' ? resData.messageVi : resData.messageEn);
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