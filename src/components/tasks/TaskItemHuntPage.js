import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import TemplatePage from '../template/TemplatePage';
import './TasksPages.css';

function TaskItemHuntPage() {
  const navigate = useNavigate();

  return (
    <TemplatePage showSearch={false} showTabs={false}>
      <div className="tasks-page">
        <div className="tasks-detail-header">
          <button type="button" className="tasks-back-btn" onClick={() => navigate('/tasks')}>
            ← Quay lại danh sách nhiệm vụ
          </button>
          <h2>Truy tìm vật phẩm (Kỳ Trân Các)</h2>
        </div>

        <div className="tasks-detail-card">
          <h3>Mô tả nhiệm vụ</h3>
          <p>
            Gồm các cấp độ <strong>Dễ</strong>, <strong>Trung bình</strong>, <strong>Khó</strong> và{' '}
            <strong>Đặc biệt</strong>.
          </p>
          <ul>
            <li>Dễ/Trung bình/Khó: mở hằng ngày, có thể nhận nhiệm vụ mọi lúc.</li>
            <li>Đặc biệt: chỉ mở trong thời gian event.</li>
            <li>Cấp độ càng khó thì thời gian hoàn thành càng ít.</li>
            <li>Tham gia không mất lệ phí, bỏ cuộc sẽ có thời gian chờ trước khi làm tiếp.</li>
            <li>Gợi ý: làm theo thứ tự Dễ - Trung bình - Khó.</li>
          </ul>
        </div>

        <div className="tasks-detail-card">
          <h3>Đi đến khu vực</h3>
          <p>Thế giới - Khu Rừng Bí Ẩn - Kỳ Trân Các</p>
          <div className="tasks-link-row">
            <Link to="/world-map" className="tasks-link-btn">
              Mở World Map
            </Link>
            <Link to="/region/2-5" className="tasks-link-btn">
              Đến Khu Rừng Bí Ẩn
            </Link>
          </div>
          <p>
            Từ bản đồ <strong>Khu Rừng Bí Ẩn</strong>, click vào <strong>Kỳ Trân Các</strong> sẽ mở trang nhiệm vụ này.
          </p>
        </div>
      </div>
    </TemplatePage>
  );
}

export default TaskItemHuntPage;
