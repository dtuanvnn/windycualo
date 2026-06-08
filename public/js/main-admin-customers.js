var sourceMap = { 'Walk-in': 'walkin', 'Website': 'website', 'Direct Phone': 'phone', 'FB Messenger': 'fbmessenger', 'Booking.com': 'bookingcom', 'Agoda': 'agoda', 'Traveloka': 'traveloka', 'Other': 'other' };
var sourceLabels = { 'Walk-in': 'Vãng lai', 'Website': 'Website', 'Direct Phone': 'Gọi điện', 'FB Messenger': 'Facebook', 'Booking.com': 'Booking.com', 'Agoda': 'Agoda', 'Traveloka': 'Traveloka', 'Other': 'Khác' };
var statusClasses = { 'Pending': 'st-pending', 'Confirmed': 'st-confirmed', 'Cancelled': 'st-cancelled', 'CheckedIn': 'st-checkedin', 'CheckedOut': 'st-checkedout' };
var statusLabels = { 'Pending': 'Chờ xác nhận', 'Confirmed': 'Đã xác nhận', 'Cancelled': 'Đã hủy', 'CheckedIn': 'Đang ở', 'CheckedOut': 'Đã trả phòng' };
var paymentLabels = { 'Cash': 'Tiền mặt', 'Bank Transfer': 'Chuyển khoản', 'Card': 'Thẻ', 'Momo': 'Momo', 'Other': 'Khác' };

function handleSearch() {
  var search = document.getElementById('searchInput').value.trim();
  if (!search) return;

  fetch('/api/admin/customers?search=' + encodeURIComponent(search))
    .then(function (r) { return r.json(); })
    .then(function (data) {
      if (!data.success) return;
      var tbody = document.getElementById('customerTableBody');
      tbody.textContent = '';

      if (data.data.length === 0) {
        var tr = document.createElement('tr');
        var td = document.createElement('td');
        td.colSpan = 8;
        td.className = 'no-data';
        td.textContent = 'Không tìm thấy khách hàng nào.';
        tr.appendChild(td);
        tbody.appendChild(tr);
        return;
      }

      data.data.forEach(function (c) {
        var tr = document.createElement('tr');

        var td1 = document.createElement('td');
        var strong = document.createElement('strong');
        strong.textContent = c.customerId;
        td1.appendChild(strong);
        tr.appendChild(td1);

        var td2 = document.createElement('td');
        td2.textContent = c.name;
        tr.appendChild(td2);

        var td3 = document.createElement('td');
        var phoneLink = document.createElement('a');
        phoneLink.href = 'tel:' + c.phone;
        phoneLink.className = 'phone-link';
        phoneLink.textContent = c.phone;
        td3.appendChild(phoneLink);
        tr.appendChild(td3);

        var td4 = document.createElement('td');
        td4.textContent = c.email || '—';
        tr.appendChild(td4);

        var td5 = document.createElement('td');
        td5.textContent = c.identityCard || '—';
        tr.appendChild(td5);

        var td6 = document.createElement('td');
        var badge = document.createElement('span');
        badge.className = 'badge badge-' + (sourceMap[c.source] || 'other');
        badge.textContent = sourceLabels[c.source] || c.source;
        td6.appendChild(badge);
        tr.appendChild(td6);

        var td7 = document.createElement('td');
        td7.textContent = new Date(c.createdAt).toLocaleDateString('vi-VN');
        tr.appendChild(td7);

        var td8 = document.createElement('td');
        var actions = document.createElement('div');
        actions.className = 'action-group';

        var btnDetail = document.createElement('button');
        btnDetail.className = 'btn-sm btn-detail';
        btnDetail.textContent = 'Chi tiết';
        btnDetail.onclick = (function (id) { return function () { showCustomerDetail(id); }; })(c._id);
        actions.appendChild(btnDetail);

        var btnEdit = document.createElement('button');
        btnEdit.className = 'btn-sm btn-edit';
        btnEdit.textContent = 'Sửa';
        btnEdit.onclick = (function (cust) {
          return function () {
            handleEditCustomer(cust._id, cust.name, cust.phone, cust.email || '', cust.identityCard || '', cust.source, cust.notes || '');
          };
        })(c);
        actions.appendChild(btnEdit);

        var btnDel = document.createElement('button');
        btnDel.className = 'btn-sm btn-delete';
        btnDel.textContent = 'Xóa';
        btnDel.onclick = (function (id, name) { return function () { handleDeleteCustomer(id, name); }; })(c._id, c.name);
        actions.appendChild(btnDel);

        td8.appendChild(actions);
        tr.appendChild(td8);

        tbody.appendChild(tr);
      });
    })
    .catch(function () { alert('Lỗi tìm kiếm!'); });
}

function handleClearSearch() {
  document.getElementById('searchInput').value = '';
  location.reload();
}

function handleSaveCustomer() {
  var editId = document.getElementById('formEditId').value;
  var name = document.getElementById('formName').value.trim();
  var phone = document.getElementById('formPhone').value.trim();
  var email = document.getElementById('formEmail').value.trim();
  var identityCard = document.getElementById('formIdentityCard').value.trim();
  var source = document.getElementById('formSource').value;
  var notes = document.getElementById('formNotes').value.trim();

  if (!name || !phone) {
    alert('Vui lòng nhập họ tên và số điện thoại!');
    return;
  }

  var url = editId ? '/api/admin/customers/' + editId : '/api/admin/customers';
  var method = editId ? 'PUT' : 'POST';

  fetch(url, {
    method: method,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: name, phone: phone, email: email, identityCard: identityCard, source: source, notes: notes })
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

function handleEditCustomer(id, name, phone, email, identityCard, source, notes) {
  document.getElementById('formEditId').value = id;
  document.getElementById('formName').value = name;
  document.getElementById('formPhone').value = phone;
  document.getElementById('formEmail').value = email;
  document.getElementById('formIdentityCard').value = identityCard;
  document.getElementById('formSource').value = source;
  document.getElementById('formNotes').value = notes;
  document.getElementById('formTitle').textContent = 'Sửa thông tin khách hàng';
  document.getElementById('btnCancel').style.display = 'inline-block';
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function handleCancelEdit() {
  document.getElementById('formEditId').value = '';
  document.getElementById('formName').value = '';
  document.getElementById('formPhone').value = '';
  document.getElementById('formEmail').value = '';
  document.getElementById('formIdentityCard').value = '';
  document.getElementById('formSource').value = 'Walk-in';
  document.getElementById('formNotes').value = '';
  document.getElementById('formTitle').textContent = 'Thêm khách hàng mới';
  document.getElementById('btnCancel').style.display = 'none';
}

function handleDeleteCustomer(id, name) {
  if (!confirm('Bạn có chắc muốn xóa khách hàng "' + name + '"? Các đơn đặt phòng liên kết sẽ được giữ lại nhưng bỏ liên kết.')) return;

  fetch('/api/admin/customers/' + id, { method: 'DELETE' })
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

function showCustomerDetail(id) {
  fetch('/api/admin/customers/' + id + '/details')
    .then(function (r) { return r.json(); })
    .then(function (data) {
      if (!data.success) { alert('Lỗi: ' + data.error); return; }

      var c = data.customer;
      var bookings = data.bookings;

      document.getElementById('detailTitle').textContent = c.customerId + ' — ' + c.name;

      var grid = document.getElementById('detailGrid');
      grid.textContent = '';
      var fields = [
        ['Mã khách hàng', c.customerId],
        ['Họ tên', c.name],
        ['Số điện thoại', c.phone],
        ['Email', c.email || '—'],
        ['CMND/CCCD', c.identityCard || '—'],
        ['Nguồn khách', sourceLabels[c.source] || c.source],
        ['Ngày tạo', new Date(c.createdAt).toLocaleDateString('vi-VN')],
        ['Ghi chú', c.notes || '—']
      ];
      fields.forEach(function (f) {
        var item = document.createElement('div');
        item.className = 'detail-item';
        var lbl = document.createElement('label');
        lbl.textContent = f[0];
        var val = document.createElement('div');
        val.className = 'value';
        val.textContent = f[1];
        item.appendChild(lbl);
        item.appendChild(val);
        grid.appendChild(item);
      });

      var totalStays = bookings.length;
      var totalRevenue = 0;
      var totalPaid = 0;
      bookings.forEach(function (b) {
        totalRevenue += b.totalAmount || 0;
        totalPaid += b.amountPaid || 0;
      });

      var cards = document.getElementById('summaryCards');
      cards.textContent = '';
      var summaryData = [
        [totalStays, 'Lượt đặt phòng'],
        [totalRevenue.toLocaleString('vi-VN') + ' đ', 'Tổng doanh thu'],
        [totalPaid.toLocaleString('vi-VN') + ' đ', 'Đã thanh toán'],
        [(totalRevenue - totalPaid).toLocaleString('vi-VN') + ' đ', 'Còn nợ']
      ];
      summaryData.forEach(function (s) {
        var card = document.createElement('div');
        card.className = 'summary-card';
        var num = document.createElement('div');
        num.className = 'num';
        num.textContent = s[0];
        var label = document.createElement('div');
        label.className = 'label';
        label.textContent = s[1];
        card.appendChild(num);
        card.appendChild(label);
        cards.appendChild(card);
      });

      var tbody = document.getElementById('stayHistoryBody');
      tbody.textContent = '';

      if (bookings.length === 0) {
        var tr = document.createElement('tr');
        var td = document.createElement('td');
        td.colSpan = 9;
        td.style.textAlign = 'center';
        td.style.color = '#888';
        td.style.fontStyle = 'italic';
        td.style.padding = '20px';
        td.textContent = 'Chưa có lịch sử lưu trú.';
        tr.appendChild(td);
        tbody.appendChild(tr);
      } else {
        bookings.forEach(function (b) {
          var tr = document.createElement('tr');

          var cells = [
            b.roomName,
            new Date(b.checkIn).toLocaleDateString('vi-VN'),
            new Date(b.checkOut).toLocaleDateString('vi-VN'),
            b.guests || 1
          ];

          cells.forEach(function (val) {
            var td = document.createElement('td');
            td.textContent = val;
            tr.appendChild(td);
          });

          var tdStatus = document.createElement('td');
          var statusSpan = document.createElement('span');
          statusSpan.className = 'status-badge ' + (statusClasses[b.status] || '');
          statusSpan.textContent = statusLabels[b.status] || b.status;
          tdStatus.appendChild(statusSpan);
          tr.appendChild(tdStatus);

          var tdSource = document.createElement('td');
          var srcBadge = document.createElement('span');
          srcBadge.className = 'badge badge-' + (sourceMap[b.source] || 'other');
          srcBadge.textContent = sourceLabels[b.source] || b.source;
          tdSource.appendChild(srcBadge);
          tr.appendChild(tdSource);

          var tdTotal = document.createElement('td');
          tdTotal.textContent = (b.totalAmount || 0).toLocaleString('vi-VN') + ' đ';
          tr.appendChild(tdTotal);

          var tdPaid = document.createElement('td');
          tdPaid.textContent = (b.amountPaid || 0).toLocaleString('vi-VN') + ' đ';
          tr.appendChild(tdPaid);

          var tdMethod = document.createElement('td');
          tdMethod.textContent = b.paymentMethod ? (paymentLabels[b.paymentMethod] || b.paymentMethod) : '—';
          tr.appendChild(tdMethod);

          tbody.appendChild(tr);
        });
      }

      document.getElementById('detailModal').style.display = 'flex';
    })
    .catch(function () { alert('Lỗi tải chi tiết khách hàng!'); });
}

function closeDetailModal() {
  document.getElementById('detailModal').style.display = 'none';
}
