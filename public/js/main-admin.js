function handleDuyetDon(bookingId, statusMoi) {
  const hanhDong = statusMoi === 'Confirmed' ? 'XÁC NHẬN' : 'HỦY';
  
  if (!confirm(`Bạn có chắc chắn muốn ${hanhDong} đơn đặt phòng này không?`)) {
    return; // Dừng lại nếu bấm Cancel ở hộp thoại hỏi ý kiến
  }

  // Gọi API chạy ngầm gửi lên Backend bằng phương thức PATCH
  fetch(`/api/admin/bookings/${bookingId}/status`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ status: statusMoi }) // Truyền trạng thái muốn thay đổi lên
  })
  .then(response => response.json())
  .then(res => {
    if (res.success) {
      alert(`🎉 Thành công: ${res.message}`);
      window.location.reload(); // Tải lại trang để bảng cập nhật màu sắc/trạng thái mới
    } else {
      alert(`❌ Thất bại: ${res.error}`);
    }
  })
  .catch(err => {
    console.error('Lỗi kết nối:', err);
    alert('Không thể kết nối tới máy chủ!');
  });
}