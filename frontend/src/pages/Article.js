import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import axios from 'axios';
import MDEditor from '@uiw/react-md-editor';

const API = 'http://127.0.0.1:8000';

export default function Article() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [article, setArticle] = useState(null);

useEffect(() => {
  axios
    .get(`http://127.0.0.1:8000/articles/${id}`)
    .then(res => setArticle(res.data));
}, [id]);


  if (!article) return <div style={{ padding: '40px' }}>Loading...</div>;

  return (
    <div style={{ padding: '32px 40px', maxWidth: '800px', margin: '0 auto' }}>
      <button onClick={() => navigate('/news')} style={{
        background: 'rgba(255,255,255,0.1)', border: 'none', color: '#fff',
        padding: '8px 16px', borderRadius: '8px', fontWeight: 600, marginBottom: '24px'
      }}>← Back</button>

      {article.header_image && (
        <img src={article.header_image} alt={article.title}
          style={{ width: '100%', maxHeight: '520px', height: 'auto', objectFit: 'contain', borderRadius: '12px', marginBottom: '28px' }} />
      )}

      <h1 style={{ fontSize: '2rem', fontWeight: 800, marginBottom: '8px' }}>{article.title}</h1>
      {article.description && (
        <p style={{ color: 'rgba(255,255,255,0.6)', fontSize: '1.05rem', marginBottom: '8px' }}>{article.description}</p>
      )}
      <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: '0.85rem', marginBottom: '32px' }}>
        By {article.author} · {new Date(article.created_at).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
      </div>

      <div data-color-mode="dark">
        <MDEditor.Markdown
          source={article.content || ''}
          style={{
            background: 'transparent',
            color: 'rgba(255,255,255,0.85)',
            lineHeight: 1.8,
            fontSize: '1rem'
          }}
        />
      </div>
    </div>
  );
}