function toggleMoveForm(roomId) {
  const form = document.getElementById('move-' + roomId);
  form.classList.toggle('show');
}

function handleAddRoom() {
  const roomName = document.getElementById('formRoomName').value;
  const totalRooms = parseInt(document.getElementById('formTotalRooms').value);
  const pricePerNight = parseInt(document.getElementById('formPrice').value);
  const description = document.getElementById('formDescription').value;

  if (!totalRooms || !pricePerNight) {
    alert('Vui lòng nhập đầy đủ số phòng và giá!');
    return;
  }

  fetch('/api/admin/rooms', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ roomName, totalRooms, pricePerNight, description })
  })
  .then(r => r.json())
  .then(data => {
    if (data.success) {
      alert(data.message);
      location.reload();
    } else {
      alert('Lỗi: ' + data.error);
    }
  })
  .catch(() => alert('Không thể kết nối tới máy chủ!'));
}

function handleMoveRoom(roomId) {
  const from = document.getElementById('from-' + roomId).value;
  const to = document.getElementById('to-' + roomId).value;
  const count = parseInt(document.getElementById('count-' + roomId).value);

  if (from === to) {
    alert('Trạng thái nguồn và đích phải khác nhau!');
    return;
  }
  if (!count || count < 1) {
    alert('Số lượng phải lớn hơn 0!');
    return;
  }

  fetch('/api/admin/rooms/' + roomId + '/status', {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ from, to, count })
  })
  .then(r => r.json())
  .then(data => {
    if (data.success) {
      alert(data.message);
      location.reload();
    } else {
      alert('Lỗi: ' + data.error);
    }
  })
  .catch(() => alert('Không thể kết nối tới máy chủ!'));
}

function handleDeleteRoom(roomId, roomName) {
  if (!confirm('Bạn có chắc muốn xóa loại phòng "' + roomName + '"?')) return;

  fetch('/api/admin/rooms/' + roomId, {
    method: 'DELETE'
  })
  .then(r => r.json())
  .then(data => {
    if (data.success) {
      alert(data.message);
      location.reload();
    } else {
      alert('Lỗi: ' + data.error);
    }
  })
  .catch(() => alert('Không thể kết nối tới máy chủ!'));
}
