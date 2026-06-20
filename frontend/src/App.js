// src/App.js
import React from 'react';
import { BrowserRouter as Router, Routes, Route, NavLink } from 'react-router-dom';
import Home from './pages/Home';
import Teams from './pages/Teams';
import PlayerProfile from './pages/PlayerProfile';
import Calculator from './pages/Calculator';
import News from './pages/News';
import Article from './pages/Article';
import Admin from './pages/admin/Admin';
import './index.css';

function App() {
  return (
    <Router>
      <div style={{ minHeight: '100vh', background: '#0f1923' }}>
        <nav style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '16px 40px',
          borderBottom: '1px solid rgba(18, 15, 15, 0.08)',
          background: 'rgba(15,25,35,0.95)',
          position: 'sticky',
          top: 0,
          zIndex: 100
        }}>
          <div style={{ display: 'flex', gap: '32px', alignItems: 'center' }}>
            <NavLink to="/" className={({ isActive }) => `nav-link${isActive ? ' active' : ''}`}>Home</NavLink>
            <NavLink to="/calculator" className={({ isActive }) => `nav-link${isActive ? ' active' : ''}`}>Performance Calculator</NavLink>
            <NavLink to="/news" className={({ isActive }) => `nav-link${isActive ? ' active' : ''}`}>News</NavLink>
            <NavLink to="/admin" className={({ isActive }) => `nav-link${isActive ? ' active' : ''}`}>Admin</NavLink>
          </div>
          <div style={{ fontWeight: 800, fontSize: '1.4rem', letterSpacing: '0.05em', color: '#ffd700' }}>
            RINKINTEL
          </div>
        </nav>

        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/team/:teamCode" element={<Teams />} />
          <Route path="/player/:playerName" element={<PlayerProfile />} />
          <Route path="/calculator" element={<Calculator />} />
          <Route path="/news" element={<News />} />
          <Route path="/news/:id" element={<Article />} />

          {/* Admin wrapper handles nested admin routes like /admin/login and /admin/articles */}
          <Route path="/admin/*" element={<Admin />} />
        </Routes>
      </div>
    </Router>
  );
}

export default App;
