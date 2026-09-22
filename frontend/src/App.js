// src/App.js
import React, { useEffect, useRef } from 'react';
import { BrowserRouter as Router, Routes, Route, NavLink, useLocation } from 'react-router-dom';
import Home from './pages/Home';
import Teams from './pages/Teams';
import Players from './pages/Players';
import PerformanceBonuses from './pages/PerformanceBonuses';
import Arbitration from './pages/Arbitration';
import TeamConstructionComparison from './pages/TeamConstructionComparison';
import PlayerProfile from './pages/PlayerProfile';
import Calculator from './pages/Calculator';
import News from './pages/News';
import Article from './pages/Article';
import Admin from './pages/admin/Admin';
import './index.css';

function AppLayout() {
  const location = useLocation();
  const toolsDropdownRef = useRef(null);

  const closeToolsDropdown = () => {
    if (toolsDropdownRef.current) {
      toolsDropdownRef.current.open = false;
    }
  };

  useEffect(() => {
    closeToolsDropdown();
  }, [location.pathname]);

  return (
    <div className="app-shell" style={{ minHeight: '100vh', background: '#0f1923' }}>
      <nav className="top-nav">
        <div className="mobile-nav-row">
          <NavLink to="/" className={({ isActive }) => `nav-link mobile-primary-link${isActive ? ' active' : ''}`}>Home</NavLink>
          <NavLink to="/news" className={({ isActive }) => `nav-link mobile-primary-link${isActive ? ' active' : ''}`}>News</NavLink>
          <NavLink to="/players" className={({ isActive }) => `nav-link mobile-primary-link${isActive ? ' active' : ''}`}>Players</NavLink>

          <details ref={toolsDropdownRef} className="tools-dropdown">
            <summary className="tools-summary">Tools</summary>
            <div className="tools-menu glass">
              <NavLink to="/bonuses" onClick={closeToolsDropdown} className={({ isActive }) => `nav-link tools-link${isActive ? ' active' : ''}`}>Performance Bonuses</NavLink>
              <NavLink to="/team-construction-comparison" onClick={closeToolsDropdown} className={({ isActive }) => `nav-link tools-link${isActive ? ' active' : ''}`}>Team Construction Comparison</NavLink>
              <NavLink to="/arbitration" onClick={closeToolsDropdown} className={({ isActive }) => `nav-link tools-link${isActive ? ' active' : ''}`}>Arbitration Predictor</NavLink>
              <NavLink to="/calculator" onClick={closeToolsDropdown} className={({ isActive }) => `nav-link tools-link${isActive ? ' active' : ''}`}>Performance Calculator</NavLink>
            </div>
          </details>
        </div>

        <div className="nav-links-row">
          <NavLink to="/" className={({ isActive }) => `nav-link${isActive ? ' active' : ''}`}>Home</NavLink>
          <NavLink to="/news" className={({ isActive }) => `nav-link${isActive ? ' active' : ''}`}>News</NavLink>
          <NavLink to="/players" className={({ isActive }) => `nav-link${isActive ? ' active' : ''}`}>Players</NavLink>
          <NavLink to="/bonuses" className={({ isActive }) => `nav-link${isActive ? ' active' : ''}`}>Performance Bonuses</NavLink>
          <NavLink to="/team-construction-comparison" className={({ isActive }) => `nav-link${isActive ? ' active' : ''}`}>Team Construction Comparison</NavLink>
          <NavLink to="/arbitration" className={({ isActive }) => `nav-link${isActive ? ' active' : ''}`}>Arbitration Predictor</NavLink>
          <NavLink to="/calculator" className={({ isActive }) => `nav-link${isActive ? ' active' : ''}`}>Performance Calculator</NavLink>
        </div>
        <div className="brand-wordmark">
          RINKINTEL
        </div>
      </nav>

      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/team/:teamCode" element={<Teams />} />
        <Route path="/players" element={<Players />} />
        <Route path="/bonuses" element={<PerformanceBonuses />} />
        <Route path="/team-construction-comparison" element={<TeamConstructionComparison />} />
        <Route path="/arbitration" element={<Arbitration />} />
        <Route path="/player/:playerName" element={<PlayerProfile />} />
        <Route path="/calculator" element={<Calculator />} />
        <Route path="/news" element={<News />} />
        <Route path="/news/:id" element={<Article />} />

        {/* Admin wrapper handles nested admin routes like /admin/login and /admin/articles */}
        <Route path="/admin/*" element={<Admin />} />
      </Routes>
    </div>
  );
}

function App() {
  return (
    <Router>
      <AppLayout />
    </Router>
  );
}

export default App;
