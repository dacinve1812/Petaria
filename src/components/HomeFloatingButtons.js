import React from 'react';
import { useLocation } from 'react-router-dom';
import FloatingActionButtons from './FloatingActionButtons';

function HomeFloatingButtons() {
  const location = useLocation();
  
  // Chỉ hiển thị FloatingActionButtons ở trang home (path: "/")
  if (location.pathname !== '/') {
    return null;
  }
  
  return <FloatingActionButtons />;
}

export default HomeFloatingButtons; 