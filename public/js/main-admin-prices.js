function toggleHolidayFields() {
  const tierType = document.getElementById('formTierType').value;
  const fields = document.getElementById('holidayFields');
  if (tierType === 'holiday') {
    fields.classList.add('show');
  } else {
    fields.classList.remove('show');
  }
}

function handleSavePrice() {
  const editId = document.getElementById('formEditId').value;
  const roomName = document.getElementById('formRoomName').value;
  const tierType = document.getElementById('formTierType').value;
  const price = parseInt(document.getElementById('formPrice').value);

  if (!price || price <= 0) {
    alert('Vui lòng nhập giá hợp lệ!');
    return;
  }

  const body = { roomName, tierType, price };

  if (tierType === 'holiday') {
    body.holidayName = document.getElementById('formHolidayName').value.trim();
    body.startDate = document.getElementById('formStartDate').value;
    body.endDate = document.getElementById('formEndDate').value;

    if (!body.holidayName || !body.startDate || !body.endDate) {
      alert('Vui lòng nhập đầy đủ tên dịp lễ và thời gian!');
      return;
    }
    if (new Date(body.startDate) >= new Date(body.endDate)) {
      alert('Ngày kết thúc phải sau ngày bắt đầu!');
      return;
    }
  }

  const url = editId ? '/api/admin/prices/' + editId : '/api/admin/prices';
  const method = editId ? 'PUT' : 'POST';

  fetch(url, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
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

function handleEditPrice(id, roomName, tierType, price, holidayName, startDate, endDate) {
  document.getElementById('formEditId').value = id;
  document.getElementById('formRoomName').value = roomName;
  document.getElementById('formTierType').value = tierType;
  document.getElementById('formPrice').value = price;
  document.getElementById('formHolidayName').value = holidayName;
  document.getElementById('formStartDate').value = startDate;
  document.getElementById('formEndDate').value = endDate;

  document.getElementById('formTitle').textContent = 'Sửa quy tắc giá';
  document.getElementById('btnCancel').style.display = 'inline-block';
  toggleHolidayFields();

  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function handleCancelEdit() {
  document.getElementById('formEditId').value = '';
  document.getElementById('formRoomName').value = 'Standard';
  document.getElementById('formTierType').value = 'normal';
  document.getElementById('formPrice').value = '';
  document.getElementById('formHolidayName').value = '';
  document.getElementById('formStartDate').value = '';
  document.getElementById('formEndDate').value = '';

  document.getElementById('formTitle').textContent = 'Thêm quy tắc giá';
  document.getElementById('btnCancel').style.display = 'none';
  toggleHolidayFields();
}

function handleDeletePrice(id) {
  if (!confirm('Bạn có chắc muốn xóa quy tắc giá này?')) return;

  fetch('/api/admin/prices/' + id, { method: 'DELETE' })
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
