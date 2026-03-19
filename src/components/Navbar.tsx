import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { logout, getUsername, canAccessRecords } from '../utils/auth';

const ALL_NAV_LINKS = [
  { to: '/review', label: 'المراجعة', requiresRecordsAccess: false },
  { to: '/records', label: 'السجلات', requiresRecordsAccess: true },
];

export default function Navbar() {
  const navigate = useNavigate();
  const location = useLocation();
  const username = getUsername();
  const recordsAccess = canAccessRecords();
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  const navLinks = ALL_NAV_LINKS.filter(
    (link) => !link.requiresRecordsAccess || recordsAccess
  );

  function handleLogout() {
    logout();
    navigate('/login');
  }

  useEffect(() => {
    function handleOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setMenuOpen(false);
      }
    }

    window.addEventListener('mousedown', handleOutside);
    return () => window.removeEventListener('mousedown', handleOutside);
  }, []);

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
          {navLinks.map((link) => (
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
        <div ref={menuRef} style={{ display: 'flex', alignItems: 'center', gap: 12, position: 'relative' }}>
          <button
            onClick={() => setMenuOpen((prev) => !prev)}
            style={{
              padding: '8px 14px',
              borderRadius: 10,
              border: '1px solid var(--color-border)',
              background: menuOpen ? 'rgba(108,99,255,0.12)' : 'var(--color-surface-2)',
              color: menuOpen ? 'var(--color-accent)' : 'var(--color-text)',
              fontSize: 13,
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: 8,
              transition: 'all 0.15s ease',
            }}
          >
            <span style={{
              width: 24,
              height: 24,
              borderRadius: 8,
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              background: 'rgba(108,99,255,0.16)',
              fontSize: 12,
              fontWeight: 700,
              color: 'var(--color-accent)',
            }}>
              {username?.slice(0, 1).toUpperCase() || 'U'}
            </span>
            <span>{username || 'Account'}</span>
            <span style={{ fontSize: 11, transform: menuOpen ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 0.15s ease' }}>⌄</span>
          </button>

          {menuOpen && (
            <div style={{
              position: 'absolute',
              top: 'calc(100% + 10px)',
              right: 0,
              minWidth: 180,
              borderRadius: 12,
              border: '1px solid var(--color-border)',
              background: 'var(--color-surface)',
              boxShadow: '0 20px 40px rgba(0,0,0,0.35)',
              padding: 8,
              display: 'grid',
              gap: 6,
              zIndex: 120,
            }}>
              <button
                onClick={() => {
                  setMenuOpen(false);
                  navigate('/settings');
                }}
                style={menuItemStyle}
              >
                ⚙️ إعدادات التقييم
              </button>
              <button
                onClick={() => {
                  setMenuOpen(false);
                  handleLogout();
                }}
                style={{ ...menuItemStyle, color: 'var(--color-danger)' }}
              >
                تسجيل خروج
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}

const menuItemStyle: React.CSSProperties = {
  width: '100%',
  textAlign: 'right',
  padding: '9px 10px',
  borderRadius: 8,
  border: '1px solid var(--color-border)',
  background: 'var(--color-surface-2)',
  color: 'var(--color-text)',
  cursor: 'pointer',
  fontSize: 13,
  fontWeight: 600,
};
