let currentRoomId = null;
const statusClasses = ['room-available', 'room-reserved', 'room-occupied', 'room-maintenance', 'room-cleaning'];
const statusLabels = { available: 'Trống', reserved: 'Đã đặt', occupied: 'Đang ở', maintenance: 'Bảo trì', cleaning: 'Dọn dẹp' };

window.addEventListener('DOMContentLoaded', function () {
  var today = new Date().toISOString().split('T')[0];
  document.getElementById('datePicker').value = today;
});

function handleDateChange() {
  var date = document.getElementById('datePicker').value;
  if (!date) return;
  loadRoomStatuses(date);
}

function loadRoomStatuses(date) {
  fetch('/api/admin/room-map?date=' + date)
    .then(function (r) { return r.json(); })
    .then(function (data) {
      if (!data.success) return;

      var overrides = data.statusOverrides || {};
      var roomMap = {};
      data.data.forEach(function (r) { roomMap[r._id] = r; });

      roomsData.forEach(function (room) {
        var card = document.getElementById('card-' + room._id);
        if (!card) return;

        var override = overrides[room._id];
        var effectiveStatus = override ? override.status : roomMap[room._id] ? roomMap[room._id].status : room.status;

        statusClasses.forEach(function (cls) { card.classList.remove(cls); });
        card.classList.add('room-' + effectiveStatus);

        var statusText = card.querySelector('.room-status-text');
        if (statusText) statusText.textContent = statusLabels[effectiveStatus] || effectiveStatus;

        var guestEl = card.querySelector('.room-guest');
        if (override && override.booking) {
          if (!guestEl) {
            guestEl = document.createElement('div');
            guestEl.className = 'room-guest';
            card.appendChild(guestEl);
          }
          guestEl.textContent = override.booking.fullName;
        } else if (guestEl) {
          guestEl.textContent = '';
        }
      });
    })
    .catch(function () { alert('Không thể tải dữ liệu trạng thái!'); });
}

function openRoomDetail(roomId) {
  var room = roomsData.find(function (r) { return r._id === roomId; });
  if (!room) return;

  currentRoomId = roomId;
  document.getElementById('modalTitle').textContent = 'Phòng ' + room.roomNumber;
  document.getElementById('modalFloor').textContent = 'Tầng ' + room.floor;
  document.getElementById('modalRoomType').value = room.roomType;
  document.getElementById('modalStatus').value = room.status;
  document.getElementById('modalLabel').value = room.label || '';
  document.getElementById('modalNotes').value = room.notes || '';

  var bookingInfo = 'Chưa có';
  if (room.currentBooking && room.currentBooking.fullName) {
    var b = room.currentBooking;
    var ci = new Date(b.checkIn).toLocaleDateString('vi-VN');
    var co = new Date(b.checkOut).toLocaleDateString('vi-VN');
    bookingInfo = b.fullName + ' (' + ci + ' - ' + co + ')';
  }
  document.getElementById('modalBooking').textContent = bookingInfo;

  document.getElementById('roomModal').style.display = 'flex';
}

function closeModal() {
  document.getElementById('roomModal').style.display = 'none';
  currentRoomId = null;
}

function saveRoomConfig() {
  if (!currentRoomId) return;

  var roomType = document.getElementById('modalRoomType').value;
  var label = document.getElementById('modalLabel').value.trim();
  var notes = document.getElementById('modalNotes').value.trim();

  fetch('/api/admin/room-map/' + currentRoomId + '/config', {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ roomType: roomType, label: label, notes: notes })
  })
  .then(function (r) { return r.json(); })
  .then(function (data) {
    if (data.success) {
      alert(data.message);
      location.reload();
    } else {
      alert('Lỗi: ' + data.error);
    }
  })
  .catch(function () { alert('Không thể kết nối tới máy chủ!'); });
}

function saveRoomStatus() {
  if (!currentRoomId) return;

  var status = document.getElementById('modalStatus').value;

  fetch('/api/admin/room-map/' + currentRoomId + '/status', {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ status: status })
  })
  .then(function (r) { return r.json(); })
  .then(function (data) {
    if (data.success) {
      alert(data.message);
      location.reload();
    } else {
      alert('Lỗi: ' + data.error);
    }
  })
  .catch(function () { alert('Không thể kết nối tới máy chủ!'); });
}

function openAssignBooking() {
  if (!currentRoomId) return;

  var room = roomsData.find(function (r) { return r._id === currentRoomId; });
  if (!room) return;

  document.getElementById('assignRoomNumber').textContent = room.roomNumber;

  var date = document.getElementById('datePicker').value || new Date().toISOString().split('T')[0];
  var listEl = document.getElementById('bookingList');
  listEl.textContent = '';
  var loading = document.createElement('div');
  loading.className = 'no-bookings';
  loading.textContent = 'Đang tải...';
  listEl.appendChild(loading);

  document.getElementById('assignModal').style.display = 'flex';

  fetch('/api/admin/room-map/' + currentRoomId + '/eligible-bookings?date=' + date)
    .then(function (r) { return r.json(); })
    .then(function (data) {
      listEl.textContent = '';

      if (!data.success || !data.data || data.data.length === 0) {
        var empty = document.createElement('div');
        empty.className = 'no-bookings';
        empty.textContent = 'Không có booking phù hợp cho ngày này.';
        listEl.appendChild(empty);
        return;
      }

      data.data.forEach(function (b) {
        var item = document.createElement('div');
        item.className = 'booking-item';

        var info = document.createElement('div');
        info.className = 'booking-info';

        var name = document.createElement('div');
        name.className = 'booking-name';
        name.textContent = b.fullName;
        info.appendChild(name);

        var dates = document.createElement('div');
        dates.className = 'booking-dates';
        var ci = new Date(b.checkIn).toLocaleDateString('vi-VN');
        var co = new Date(b.checkOut).toLocaleDateString('vi-VN');
        dates.textContent = ci + ' → ' + co + ' | ' + b.status + (b.phone ? ' | ' + b.phone : '');
        info.appendChild(dates);

        item.appendChild(info);

        var btn = document.createElement('button');
        btn.className = 'btn-assign-sm';
        btn.textContent = 'Gán';
        btn.onclick = function () { assignBooking(b._id); };
        item.appendChild(btn);

        listEl.appendChild(item);
      });
    })
    .catch(function () {
      listEl.textContent = '';
      var err = document.createElement('div');
      err.className = 'no-bookings';
      err.textContent = 'Lỗi tải danh sách booking.';
      listEl.appendChild(err);
    });
}

function assignBooking(bookingId) {
  if (!confirm('Bạn có chắc muốn gán booking này cho phòng?')) return;

  fetch('/api/admin/room-map/' + currentRoomId + '/assign-booking', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ bookingId: bookingId })
  })
  .then(function (r) { return r.json(); })
  .then(function (data) {
    if (data.success) {
      alert(data.message);
      location.reload();
    } else {
      alert('Lỗi: ' + data.error);
    }
  })
  .catch(function () { alert('Không thể kết nối tới máy chủ!'); });
}

function closeAssignModal() {
  document.getElementById('assignModal').style.display = 'none';
}

function handleSeedRooms() {
  if (!confirm('Bạn có chắc muốn KHỞI TẠO LẠI tất cả phòng? Toàn bộ cấu hình và gán booking hiện tại sẽ bị xóa!')) return;

  fetch('/api/admin/room-map/seed', { method: 'POST' })
  .then(function (r) { return r.json(); })
  .then(function (data) {
    if (data.success) {
      alert(data.message);
      location.reload();
    } else {
      alert('Lỗi: ' + data.error);
    }
  })
  .catch(function () { alert('Không thể kết nối tới máy chủ!'); });
}
