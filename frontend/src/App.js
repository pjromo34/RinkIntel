// src/App.js
import React from 'react';
import { BrowserRouter as Router, Routes, Route, NavLink } from 'react-router-dom';
import Home from './pages/Home';
import Teams from './pages/Teams';
import Players from './pages/Players';
import PerformanceBonuses from './pages/PerformanceBonuses';
import Arbitration from './pages/Arbitration';
import TeamConstructionComparison from './pages/TeamConstructionComparison';
import ContractResearch from './pages/ContractResearch';
import PlayerProfile from './pages/PlayerProfile';
import Calculator from './pages/Calculator';
import News from './pages/News';
import Article from './pages/Article';
import Admin from './pages/admin/Admin';
import './index.css';

function App() {
  return (
    <Router>
      <div className="app-shell" style={{ minHeight: '100vh', background: '#0f1923' }}>
        <nav className="top-nav">
          <div className="mobile-nav-row">
            <NavLink to="/" className={({ isActive }) => `nav-link mobile-primary-link${isActive ? ' active' : ''}`}>Home</NavLink>
            <NavLink to="/news" className={({ isActive }) => `nav-link mobile-primary-link${isActive ? ' active' : ''}`}>News</NavLink>
            <NavLink to="/players" className={({ isActive }) => `nav-link mobile-primary-link${isActive ? ' active' : ''}`}>Players</NavLink>

            <details className="tools-dropdown">
              <summary className="tools-summary">Tools</summary>
              <div className="tools-menu glass">
                <NavLink to="/bonuses" className={({ isActive }) => `nav-link tools-link${isActive ? ' active' : ''}`}>Performance Bonuses</NavLink>
                <NavLink to="/team-construction-comparison" className={({ isActive }) => `nav-link tools-link${isActive ? ' active' : ''}`}>Team Construction Comparison</NavLink>
                <NavLink to="/contract-research" className={({ isActive }) => `nav-link tools-link${isActive ? ' active' : ''}`}>Contract Research</NavLink>
                <NavLink to="/arbitration" className={({ isActive }) => `nav-link tools-link${isActive ? ' active' : ''}`}>Arbitration Predictor</NavLink>
                <NavLink to="/calculator" className={({ isActive }) => `nav-link tools-link${isActive ? ' active' : ''}`}>Performance Calculator</NavLink>
              </div>
            </details>
          </div>

          <div className="nav-links-row">
            <NavLink to="/" className={({ isActive }) => `nav-link${isActive ? ' active' : ''}`}>Home</NavLink>
            <NavLink to="/news" className={({ isActive }) => `nav-link${isActive ? ' active' : ''}`}>News</NavLink>
            <NavLink to="/players" className={({ isActive }) => `nav-link${isActive ? ' active' : ''}`}>Players</NavLink>
            <NavLink to="/bonuses" className={({ isActive }) => `nav-link${isActive ? ' active' : ''}`}>Performance Bonuses</NavLink>
            <NavLink to="/team-construction-comparison" className={({ isActive }) => `nav-link${isActive ? ' active' : ''}`}>Team Construction Comparison</NavLink>
            <NavLink to="/contract-research" className={({ isActive }) => `nav-link${isActive ? ' active' : ''}`}>Contract Research</NavLink>
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
          <Route path="/contract-research" element={<ContractResearch />} />
          <Route path="/arbitration" element={<Arbitration />} />
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
