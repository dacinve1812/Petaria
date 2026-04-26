import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import TemplatePage from '../template/TemplatePage';
import './TasksPages.css';

function TaskSpiritFusionPage() {
  const navigate = useNavigate();

  return (
    <TemplatePage showSearch={false} showTabs={false}>
      <div className="tasks-page">
        <div className="tasks-detail-header">
          <button type="button" className="tasks-back-btn" onClick={() => navigate('/tasks')}>
            ← Quay lại danh sách nhiệm vụ
          </button>
          <h2>Dung hợp linh thú (Động Tinh Linh)</h2>
        </div>

        <div className="tasks-detail-card">
          <h3>Mô tả nhiệm vụ</h3>
          <p>Tìm và dung hợp Linh thú cấp thấp để nhận Linh thú cấp cao hơn.</p>
          <ul>
            <li>Cấp 30: nhận linh thú cấp 25, 30.</li>
            <li>Cấp 40: nhận linh thú cấp 35, 40.</li>
            <li>Cấp 50: nhận linh thú cấp 45, 50.</li>
            <li>Nhiệm vụ có tốn một ít peta và có thời gian quy định.</li>
          </ul>
        </div>

        <div className="tasks-detail-card">
          <h3>Đi đến khu vực</h3>
          <p>Thế giới - Xứ Sở Tuyết - Động Tinh Linh</p>
          <div className="tasks-link-row">
            <Link to="/world-map" className="tasks-link-btn">
              Mở World Map
            </Link>
            <Link to="/region/2-1" className="tasks-link-btn">
              Đến Xứ Sở Tuyết
            </Link>
          </div>
          <p>
            Từ bản đồ <strong>Xứ Sở Tuyết</strong>, click vào <strong>Động Tinh Linh</strong> sẽ mở trang nhiệm vụ này.
          </p>
        </div>
      </div>
    </TemplatePage>
  );
}

export default TaskSpiritFusionPage;
