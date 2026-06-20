import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';

const API = 'http://127.0.0.1:8000';

export default function News() {
  const [articles, setArticles] = useState([]);
  const navigate = useNavigate();

useEffect(() => {
  axios
    .get("http://127.0.0.1:8000/articles")
    .then(res => setArticles(res.data));
}, []);


  return (
    <div style={{ padding: '32px 40px', maxWidth: '900px', margin: '0 auto' }}>
      <h2 style={{ fontSize: '1.6rem', fontWeight: 800, marginBottom: '32px' }}>Articles</h2>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
        {articles.map(a => (
          <div key={a.id} onClick={() => navigate(`/news/${a.id}`)}
            className="glass"
            style={{ display: 'flex', gap: '16px', padding: '16px', cursor: 'pointer',
              alignItems: 'center', transition: 'background 0.2s' }}>
            {a.header_image && (
              <img src={a.header_image} alt={a.title}
                style={{ width: '140px', height: '85px', objectFit: 'cover', borderRadius: '8px', flexShrink: 0 }} />
            )}
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 700, fontSize: '1.05rem', marginBottom: '6px' }}>{a.title}</div>
              {a.description && (
                <div style={{ fontSize: '0.85rem', color: 'rgba(255,255,255,0.6)' }}>{a.description}</div>
              )}
            </div>
          </div>
        ))}
        {articles.length === 0 && (
          <div style={{ color: 'rgba(255,255,255,0.4)', textAlign: 'center', padding: '60px 0' }}>
            No articles published yet.
          </div>
        )}
      </div>
    </div>
  );
}