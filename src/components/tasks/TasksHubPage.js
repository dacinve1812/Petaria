import React from 'react';
import { useNavigate } from 'react-router-dom';
import TemplatePage from '../template/TemplatePage';
import './TasksPages.css';

const TASK_GROUPS = [
  {
    id: 'item-hunt',
    title: 'Truy tìm vật phẩm',
    subtitle: 'Kỳ Trân Các',
    image: '/images/buttons/my_item.png',
    to: '/tasks/item-hunt',
  },
  {
    id: 'spirit-fusion',
    title: 'Dung hợp linh thú',
    subtitle: 'Động Tinh Linh',
    image: '/images/buttons/my_spirit.png',
    to: '/tasks/spirit-fusion',
  },
  {
    id: 'monster-hunt',
    title: 'Diệt quái thú',
    subtitle: 'Hội Anh Hùng',
    image: '/images/buttons/my_club.png',
    to: '/tasks/monster-hunt',
  },
];

function TasksHubPage() {
  const navigate = useNavigate();

  return (
    <TemplatePage showSearch={false} showTabs={false}>
      <div className="tasks-page">
        <div className="tasks-page-header">
          <p>Phần nhiệm vụ trong Petaria</p>
        </div>

        <div className="tasks-page-intro">
          Thực hiện nhiệm vụ Petaria giao để nhận phần thưởng giá trị và tiền thưởng xứng đáng.
          Đây là một trong những phần chơi giàu cảm xúc nhất của Petaria.
        </div>

        <div className="tasks-hub-grid">
          {TASK_GROUPS.map((task) => (
            <button
              type="button"
              key={task.id}
              className="tasks-hub-card"
              onClick={() => navigate(task.to)}
            >
              <img src={task.image} alt={task.title} className="tasks-hub-card-image" />
              <div className="tasks-hub-card-title">{task.title}</div>
              <div className="tasks-hub-card-subtitle">{task.subtitle}</div>
            </button>
          ))}
        </div>
      </div>
    </TemplatePage>
  );
}

export default TasksHubPage;
