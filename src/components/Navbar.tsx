import { Link, useNavigate, useLocation } from 'react-router-dom';
import { logout, getUsername } from '../utils/auth';

const NAV_LINKS = [
  { to: '/review', label: 'المراجعة' },
  { to: '/records', label: 'السجلات' },
];

export default function Navbar() {
  const navigate = useNavigate();
  const location = useLocation();
  const username = getUsername();

  function handleLogout() {
    logout();
    navigate('/login');
  }

  return (
    <header
      style={{
        background: 'var(--color-surface)',
        borderBottom: '1px solid var(--color-border)',
        position: 'sticky',
        top: 0,
        zIndex: 50,
      }}
    >
      <div
        style={{
          maxWidth: 1200,
          margin: '0 auto',
          padding: '0 24px',
          height: 64,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 16,
        }}
      >
        {/* Logo */}
        <Link to="/review" style={{ textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{
            width: 32, height: 32, borderRadius: 8,
            background: 'var(--color-accent)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 16, fontWeight: 700, color: 'white',
          }}>N</div>
          <span style={{ fontWeight: 700, fontSize: 16, color: 'var(--color-text)' }}>
            Ninja Real Estate
          </span>
        </Link>

        {/* Nav links */}
        <nav style={{ display: 'flex', gap: 4 }}>
          {NAV_LINKS.map((link) => (
            <Link
              key={link.to}
              to={link.to}
              style={{
                padding: '6px 16px',
                borderRadius: 8,
                textDecoration: 'none',
                fontSize: 14,
                fontWeight: 500,
                color: location.pathname === link.to ? 'white' : 'var(--color-text-muted)',
                background: location.pathname === link.to ? 'var(--color-accent)' : 'transparent',
                transition: 'all 0.15s ease',
              }}
            >
              {link.label}
            </Link>
          ))}
        </nav>

        {/* User menu */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <span style={{ fontSize: 13, color: 'var(--color-text-muted)' }}>
            {username}
          </span>
          <button
            onClick={handleLogout}
            style={{
              padding: '6px 14px',
              borderRadius: 8,
              border: '1px solid var(--color-border)',
              background: 'transparent',
              color: 'var(--color-text-muted)',
              fontSize: 13,
              cursor: 'pointer',
              transition: 'all 0.15s ease',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.borderColor = 'var(--color-danger)';
              e.currentTarget.style.color = 'var(--color-danger)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.borderColor = 'var(--color-border)';
              e.currentTarget.style.color = 'var(--color-text-muted)';
            }}
          >
            تسجيل خروج
          </button>
        </div>
      </div>
    </header>
  );
}
