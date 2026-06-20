import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import axios from 'axios';

const API = 'http://127.0.0.1:8000';

function formatMoney(val) {
  return '$' + Number(val).toLocaleString('en-US', { maximumFractionDigits: 0 });
}

function getVerdict(actual, market) {
  const delta = market - actual;
  if (delta > 1000000) return { label: 'Overperforming', className: 'overperforming' };
  if (delta < -1000000) return { label: 'Underperforming', className: 'underperforming' };
  return { label: 'Meeting Expectations', className: 'meeting' };
}

export default function PlayerProfile() {
  const { playerName } = useParams();
  const navigate = useNavigate();
  const [player, setPlayer] = useState(null);

  useEffect(() => {
    axios
      .get(`${API}/players/by-name/${encodeURIComponent(playerName)}`)
      .then(res => setPlayer(res.data));
  }, [playerName]);

  if (!player) return <div style={{ padding: '40px' }}>Loading...</div>;

  const verdict = getVerdict(player.aav || 0, player.market_value || 0);

  return (
    <div style={{ padding: '32px 40px' }}>
      <button
        onClick={() => navigate(-1)}
        style={{
          background: 'rgba(255,255,255,0.1)',
          border: 'none',
          color: '#fff',
          padding: '8px 16px',
          borderRadius: '8px',
          fontWeight: 600,
          marginBottom: '24px'
        }}
      >
        ← Back
      </button>

      <div style={{ display: 'flex', gap: '32px', alignItems: 'flex-start' }}>
        <div className="glass" style={{ padding: '32px', flex: 1 }}>
          <div
            style={{
              display: 'flex',
              gap: '24px',
              alignItems: 'center',
              marginBottom: '32px'
            }}
          >
            {player.headshot_url ? (
              <img
                src={player.headshot_url}
                alt={player.name}
                style={{
                  width: 100,
                  height: 100,
                  borderRadius: '50%',
                  objectFit: 'cover',
                  border: '3px solid rgba(255,255,255,0.2)'
                }}
              />
            ) : (
              <div
                style={{
                  width: 100,
                  height: 100,
                  borderRadius: '50%',
                  background: 'rgba(255,255,255,0.1)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '2rem'
                }}
              >
                {player.name[0]}
              </div>
            )}

            <div>
              <h1 style={{ fontSize: '2rem', fontWeight: 800 }}>{player.name}</h1>

              <div
                onClick={() => navigate(`/team/${player.team}`)}
                style={{
                  color: '#ffd700',
                  fontWeight: 600,
                  cursor: 'pointer',
                  fontSize: '1.1rem'
                }}
              >
                {player.team}
              </div>

              <div
                style={{
                  color: 'rgba(255,255,255,0.6)',
                  marginTop: '4px'
                }}
              >
                {player.position}
              </div>
            </div>
          </div>

          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(4, 1fr)',
              gap: '16px',
              marginBottom: '32px'
            }}
          >
            {[
              { label: 'Goals', value: player.goals },
              { label: 'Assists', value: player.assists },
              { label: 'Points', value: player.points },
              { label: 'xG', value: player.xg_all_situations?.toFixed(2) }
            ].map(stat => (
              <div
                key={stat.label}
                className="glass"
                style={{ padding: '16px', textAlign: 'center' }}
              >
                <div style={{ fontSize: '1.8rem', fontWeight: 800 }}>
                  {stat.value}
                </div>
                <div
                  style={{
                    fontSize: '0.8rem',
                    color: 'rgba(255,255,255,0.6)',
                    marginTop: '4px'
                  }}
                >
                  {stat.label}
                </div>
              </div>
            ))}
          </div>

          <div
            style={{
              display: 'grid',
              gridTemplateColumns: '1fr 1fr',
              gap: '16px'
            }}
          >
            <div className="glass" style={{ padding: '20px' }}>
              <div
                style={{
                  fontSize: '0.8rem',
                  color: 'rgba(255,255,255,0.6)',
                  marginBottom: '8px'
                }}
              >
                ACTUAL CAP HIT
              </div>
              <div style={{ fontSize: '1.4rem', fontWeight: 700 }}>
                {formatMoney(player.aav || 0)}
              </div>
            </div>

            <div className="glass" style={{ padding: '20px' }}>
              <div
                style={{
                  fontSize: '0.8rem',
                  color: 'rgba(255,255,255,0.6)',
                  marginBottom: '8px'
                }}
              >
                MARKET VALUE
              </div>
              <div style={{ fontSize: '1.4rem', fontWeight: 700 }}>
                {formatMoney(player.market_value || 0)}
              </div>
            </div>
          </div>

          <div style={{ marginTop: '20px', textAlign: 'center' }}>
            <span className={verdict.className} style={{ fontSize: '1.2rem' }}>
              {verdict.label}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
