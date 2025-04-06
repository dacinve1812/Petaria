import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import './Auth.css';

function Auth({ onLoginSuccess }) {
  const API_BASE_URL = process.env.REACT_APP_API_BASE_URL; 
  const [isLogin, setIsLogin] = useState(true);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState(null);
  const [successMessage, setSuccessMessage] = useState(null); // Thêm state successMessage
  const navigate = useNavigate();

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError(null);
    setSuccessMessage(null); // Reset successMessage

    if (!username) {
      setError('Username is required');
      return;
    }
    if (!password) {
      setError('Password is required');
      return;
    }
    if (password.length < 8 && !isLogin) {
      setError('Password must be at least 8 characters long for registration.');
      return;
    }

    const url = isLogin ? `${API_BASE_URL}/login` : `${API_BASE_URL}/register`;

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ username, password }),
      });

      const data = await response.json();

      if (response.ok) {
        if (isLogin) {
          console.log('Login successful:', data);
          if (data.token) {
            localStorage.setItem('token', data.token);
            localStorage.setItem('isAdmin', String(data.isAdmin));
            onLoginSuccess();
          }
          navigate('/');
        } else {
          console.log('Registration successful:', data);
          setSuccessMessage(data.message || 'Registration successful'); // Hiển thị thông báo thành công
          setIsLogin(true);
        }
      } else {
        setError(data.message || 'An error occurred');
        console.error('Error:', data);
      }
    } catch (err) {
      setError('Network error or server unavailable');
      console.error('Error:', err);
    }
  };

  useEffect(() => {
    if (error || successMessage) {
      const timer = setTimeout(() => {
        setError(null);
        setSuccessMessage(null);
      }, 5000); // 5 giây

      return () => clearTimeout(timer); // Clear timeout nếu component unmount
    }
  }, [error, successMessage]);

  return (
    <div className="auth-container">
      <h2>{isLogin ? 'Đăng nhập' : 'Đăng ký'}</h2>
      {error && <p className="error">{error}</p>}
      {successMessage && <p className="success">{successMessage}</p>} {/* Hiển thị thông báo thành công */}
      <form onSubmit={handleSubmit}>
        <div className="form-group">
          <label htmlFor="username">Tên đăng nhập:</label>
          <input
            type="text"
            id="username"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
          />
        </div>
        <div className="form-group">
          <label htmlFor="password">Mật khẩu:</label>
          <input
            type="password"
            id="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </div>
        <button type="submit">{isLogin ? 'Đăng nhập' : 'Đăng ký'}</button>
      </form>
      <p onClick={() => setIsLogin(!isLogin)}>
        {isLogin ? 'Chưa có tài khoản? Đăng ký ngay' : 'Đã có tài khoản? Đăng nhập'}
      </p>
    </div>
  );
}

export default Auth;