var currentMode = 'week';
var currentDate = new Date();
var cellWidth = 100;

var DAY_NAMES = ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7'];

window.addEventListener('DOMContentLoaded', function () {
  loadCalendar();
});

function getDateRange(mode, refDate) {
  var dates = [];
  var start, end;

  if (mode === 'week') {
    start = new Date(refDate);
    var day = start.getDay();
    var diff = day === 0 ? -6 : 1 - day;
    start.setDate(start.getDate() + diff);
    start.setHours(0, 0, 0, 0);

    for (var i = 0; i < 7; i++) {
      var d = new Date(start);
      d.setDate(start.getDate() + i);
      dates.push(d);
    }
    end = new Date(dates[dates.length - 1]);
  } else {
    start = new Date(refDate.getFullYear(), refDate.getMonth(), 1);
    end = new Date(refDate.getFullYear(), refDate.getMonth() + 1, 0);

    var cur = new Date(start);
    while (cur <= end) {
      dates.push(new Date(cur));
      cur.setDate(cur.getDate() + 1);
    }
  }

  return {
    start: fmt(start),
    end: fmt(end),
    dates: dates
  };
}

function fmt(d) {
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
}

function fmtShort(d) {
  return String(d.getDate()).padStart(2, '0') + '/' + String(d.getMonth() + 1).padStart(2, '0');
}

function fmtDisplay(d) {
  return String(d.getDate()).padStart(2, '0') + '/' + String(d.getMonth() + 1).padStart(2, '0') + '/' + d.getFullYear();
}

function daysBetween(d1, d2) {
  return Math.round((d2 - d1) / (1000 * 60 * 60 * 24));
}

function isToday(d) {
  var t = new Date();
  return d.getFullYear() === t.getFullYear() && d.getMonth() === t.getMonth() && d.getDate() === t.getDate();
}

function isWeekend(d) {
  return d.getDay() === 0 || d.getDay() === 6;
}

function loadCalendar() {
  var range = getDateRange(currentMode, currentDate);
  cellWidth = currentMode === 'week' ? 100 : 50;

  document.getElementById('dateRangeLabel').textContent = fmtDisplay(range.dates[0]) + ' — ' + fmtDisplay(range.dates[range.dates.length - 1]);

  document.getElementById('btnWeek').classList.toggle('active', currentMode === 'week');
  document.getElementById('btnMonth').classList.toggle('active', currentMode === 'month');

  fetch('/api/admin/room-calendar?start=' + range.start + '&end=' + range.end)
    .then(function (r) { return r.json(); })
    .then(function (data) {
      if (data.success) {
        renderCalendar(data.roomTypes, range.dates);
      }
    })
    .catch(function () {
      document.getElementById('calendarContainer').textContent = 'Lỗi tải dữ liệu lịch phòng.';
    });
}

function renderCalendar(roomTypes, dates) {
  var container = document.getElementById('calendarContainer');
  container.textContent = '';

  var headerRow = document.createElement('div');
  headerRow.className = 'cal-header-row';

  var corner = document.createElement('div');
  corner.className = 'cal-corner';
  corner.textContent = 'Phòng';
  headerRow.appendChild(corner);

  dates.forEach(function (d) {
    var cell = document.createElement('div');
    cell.className = 'cal-date';
    cell.style.width = cellWidth + 'px';
    cell.style.minWidth = cellWidth + 'px';
    if (isToday(d)) cell.classList.add('today');
    else if (isWeekend(d)) cell.classList.add('weekend');

    var dayName = document.createElement('span');
    dayName.className = 'day-name';
    dayName.textContent = DAY_NAMES[d.getDay()];
    cell.appendChild(dayName);

    var dayNum = document.createElement('span');
    dayNum.className = 'day-num';
    dayNum.textContent = fmtShort(d);
    cell.appendChild(dayNum);

    headerRow.appendChild(cell);
  });

  container.appendChild(headerRow);

  var rangeStart = new Date(dates[0]);
  rangeStart.setHours(0, 0, 0, 0);

  roomTypes.forEach(function (group) {
    if (group.rooms.length === 0) return;

    var typeHeader = document.createElement('div');
    typeHeader.className = 'type-group-header';
    typeHeader.textContent = group.type + ' (' + group.rooms.length + ' phòng)';
    container.appendChild(typeHeader);

    group.rooms.forEach(function (room) {
      var row = document.createElement('div');
      row.className = 'room-row';

      var label = document.createElement('div');
      label.className = 'room-label';
      var numSpan = document.createElement('span');
      numSpan.className = 'room-num';
      numSpan.textContent = room.roomNumber;
      label.appendChild(numSpan);
      if (room.label) {
        var lblSpan = document.createElement('span');
        lblSpan.className = 'room-lbl';
        lblSpan.textContent = room.label;
        label.appendChild(lblSpan);
      }
      row.appendChild(label);

      var cellsRow = document.createElement('div');
      cellsRow.className = 'cells-row';

      dates.forEach(function (d) {
        var cell = document.createElement('div');
        cell.className = 'cal-cell';
        cell.style.width = cellWidth + 'px';
        cell.style.minWidth = cellWidth + 'px';

        if (room.status === 'maintenance') cell.classList.add('cell-maintenance');
        else if (room.status === 'cleaning') cell.classList.add('cell-cleaning');
        else if (room.status === 'reserved') cell.classList.add('cell-reserved');
        else cell.classList.add('cell-available');

        if (isWeekend(d)) cell.classList.add('weekend-col');

        cell.onclick = (function (rm, dt) {
          return function () { openCellDetail(rm, dt); };
        })(room, d);

        cellsRow.appendChild(cell);
      });

      if (room.booking) {
        var b = room.booking;
        var bStart = new Date(b.checkIn);
        bStart.setHours(0, 0, 0, 0);
        var bEnd = new Date(b.checkOut);
        bEnd.setHours(0, 0, 0, 0);

        var startCol = Math.max(0, daysBetween(rangeStart, bStart));
        var endCol = Math.min(dates.length, daysBetween(rangeStart, bEnd));
        if (endCol > startCol) {
          var bar = document.createElement('div');
          bar.className = 'booking-bar' + (b.status === 'Confirmed' ? ' bar-reserved' : '');
          bar.style.left = (startCol * cellWidth) + 'px';
          bar.style.width = ((endCol - startCol) * cellWidth - 4) + 'px';
          bar.textContent = b.fullName;
          bar.title = b.fullName + ' | ' + fmtShort(bStart) + ' → ' + fmtShort(bEnd) + ' | ' + (b.status === 'Confirmed' ? 'Đã đặt' : 'Đang ở');
          bar.onclick = function (e) {
            e.stopPropagation();
            openBookingDetail(room, b);
          };
          cellsRow.appendChild(bar);
        }
      }

      row.appendChild(cellsRow);
      container.appendChild(row);
    });

    if (group.unassignedBookings && group.unassignedBookings.length > 0) {
      group.unassignedBookings.forEach(function (b) {
        var uRow = document.createElement('div');
        uRow.className = 'room-row';

        var uLabel = document.createElement('div');
        uLabel.className = 'unassigned-label';
        uLabel.textContent = '⚠ Chưa gán';
        uRow.appendChild(uLabel);

        var uCells = document.createElement('div');
        uCells.className = 'cells-row';

        dates.forEach(function () {
          var cell = document.createElement('div');
          cell.className = 'cal-cell';
          cell.style.width = cellWidth + 'px';
          cell.style.minWidth = cellWidth + 'px';
          uCells.appendChild(cell);
        });

        var bStart = new Date(b.checkIn);
        bStart.setHours(0, 0, 0, 0);
        var bEnd = new Date(b.checkOut);
        bEnd.setHours(0, 0, 0, 0);

        var startCol = Math.max(0, daysBetween(rangeStart, bStart));
        var endCol = Math.min(dates.length, daysBetween(rangeStart, bEnd));
        if (endCol > startCol) {
          var bar = document.createElement('div');
          bar.className = 'unassigned-bar';
          bar.style.left = (startCol * cellWidth) + 'px';
          bar.style.width = ((endCol - startCol) * cellWidth - 4) + 'px';
          bar.textContent = b.fullName;
          bar.title = b.fullName + ' (chưa gán phòng)';
          uCells.appendChild(bar);
        }

        uRow.appendChild(uCells);
        container.appendChild(uRow);
      });
    }
  });
}

function navigatePrev() {
  if (currentMode === 'week') {
    currentDate.setDate(currentDate.getDate() - 7);
  } else {
    currentDate.setMonth(currentDate.getMonth() - 1);
  }
  loadCalendar();
}

function navigateNext() {
  if (currentMode === 'week') {
    currentDate.setDate(currentDate.getDate() + 7);
  } else {
    currentDate.setMonth(currentDate.getMonth() + 1);
  }
  loadCalendar();
}

function navigateToday() {
  currentDate = new Date();
  loadCalendar();
}

function setMode(mode) {
  currentMode = mode;
  loadCalendar();
}

function openCellDetail(room, date) {
  var statusLabels = { available: 'Trống', reserved: 'Đã đặt', occupied: 'Đang ở', maintenance: 'Bảo trì', cleaning: 'Dọn dẹp' };
  document.getElementById('infoTitle').textContent = 'Phòng ' + room.roomNumber;
  var body = document.getElementById('infoBody');
  body.textContent = '';

  var lines = [
    ['Ngày', fmtDisplay(date)],
    ['Loại phòng', room.roomType || ''],
    ['Trạng thái', statusLabels[room.status] || room.status]
  ];

  if (room.booking) {
    lines.push(['Khách', room.booking.fullName]);
    lines.push(['Check-in', fmtDisplay(new Date(room.booking.checkIn))]);
    lines.push(['Check-out', fmtDisplay(new Date(room.booking.checkOut))]);
  }

  lines.forEach(function (l) {
    var p = document.createElement('p');
    var s = document.createElement('strong');
    s.textContent = l[0] + ': ';
    p.appendChild(s);
    p.appendChild(document.createTextNode(l[1]));
    body.appendChild(p);
  });

  document.getElementById('infoModal').style.display = 'flex';
}

function openBookingDetail(room, booking) {
  document.getElementById('infoTitle').textContent = 'Booking - ' + room.roomNumber;
  var body = document.getElementById('infoBody');
  body.textContent = '';

  var lines = [
    ['Phòng', room.roomNumber],
    ['Khách', booking.fullName],
    ['Check-in', fmtDisplay(new Date(booking.checkIn))],
    ['Check-out', fmtDisplay(new Date(booking.checkOut))],
    ['Trạng thái', booking.status]
  ];

  lines.forEach(function (l) {
    var p = document.createElement('p');
    var s = document.createElement('strong');
    s.textContent = l[0] + ': ';
    p.appendChild(s);
    p.appendChild(document.createTextNode(l[1]));
    body.appendChild(p);
  });

  document.getElementById('infoModal').style.display = 'flex';
}

function closeInfoModal() {
  document.getElementById('infoModal').style.display = 'none';
}
