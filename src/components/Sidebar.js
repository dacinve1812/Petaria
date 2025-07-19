import React, { useEffect, useState  } from 'react';
import { useNavigate } from 'react-router-dom';
import './Sidebar.css';

function Sidebar({ userId, handleLogout, isAdmin, className = 'sidebar' }) {
  const API_BASE_URL = process.env.REACT_APP_API_BASE_URL; 
  const navigate = useNavigate();
  const [username, setUsername] = useState('');
  const [onlineStatus, setOnlineStatus] = useState(false);
  const [gold, setGold] = useState(0);

  useEffect(() => {
    if (userId) {
      fetch(`${API_BASE_URL}/users/${userId}`)
        .then((response) => response.json())
        .then((data) => {
          setUsername(data.username);
          setOnlineStatus(data.online_status);
          setGold(data.gold);
        })
        .catch((error) => console.error('Error fetching user data:', error));
    }
  }, [userId]);

  return (
    <div className={className}>
      <nav>
        <ul>
            <li><a href="/" onClick={handleLogout}><img src="/images/buttons/exit.png" alt="exit"/></a></li> 
            {isAdmin && <li><a href="/admin"><img src="/images/buttons/admin.png" alt="Admin"/></a></li>}
            <li><a href="/"><img src="/images/buttons/mainpage.png" alt="mainpage"/></a></li>   
            <li><a href="/"><img src="/images/buttons/world.png" alt="world"/></a></li> 
            <li><a href="/home-ver2"><img src="/images/buttons/homepage.png" alt="homepage"/></a></li> 
            <li><a href="/"><img src="/images/buttons/management.png" alt="management"/></a></li>
            <li><a href="/"><img src="/images/buttons/analysis.png" alt="analysis"/></a></li>
        </ul>
      </nav>
      <div className="user-info">
        <p>{username}</p>
        <button>Tìm kiếm</button>
      </div>
    </div>
  );
}

export default Sidebar;