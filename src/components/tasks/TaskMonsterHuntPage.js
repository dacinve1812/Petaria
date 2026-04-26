import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import TemplatePage from '../template/TemplatePage';
import './TasksPages.css';

function TaskMonsterHuntPage() {
  const navigate = useNavigate();

  return (
    <TemplatePage showSearch={false} showTabs={false}>
      <div className="tasks-page">
        <div className="tasks-detail-header">
          <button type="button" className="tasks-back-btn" onClick={() => navigate('/tasks')}>
            ← Quay lại danh sách nhiệm vụ
          </button>
          <h2>Diệt quái thú (Hội Anh Hùng)</h2>
        </div>

        <div className="tasks-detail-card">
          <h3>Mô tả nhiệm vụ</h3>
          <ul>
            <li>Có 3 cấp độ: Dễ, Trung bình, Khó.</li>
            <li>Không quy định thời gian hoàn thành.</li>
            <li>Không mất phí tham gia.</li>
          </ul>
        </div>

        <div className="tasks-detail-card">
          <h3>Đi đến khu vực</h3>
          <p>Thế giới - Cánh Đồng Vạn Hoa - Hội Anh Hùng</p>
          <div className="tasks-link-row">
            <Link to="/world-map" className="tasks-link-btn">
              Mở World Map
            </Link>
            <Link to="/region/3-1" className="tasks-link-btn">
              Đến Cánh Đồng Vạn Hoa
            </Link>
          </div>
          <p>
            Từ bản đồ <strong>Cánh Đồng Vạn Hoa</strong>, click vào <strong>Hội Anh Hùng</strong> sẽ mở trang nhiệm vụ này.
          </p>
        </div>
      </div>
    </TemplatePage>
  );
}

export default TaskMonsterHuntPage;
