import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const Navbar = () => {
  const { user, logout } = useAuth();
  const [showMenu, setShowMenu] = useState(false);
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    setShowMenu(false);
    navigate('/login');
  };

  return (
    <nav>
      <div className="brand">
        <Link to="/" className="brand-link">
          <div className="logo-icon">Sz</div>
          <span>Stream<span className="text-neon">Zone</span></span>
        </Link>
      </div>
      
      <div className="nav-links">
        <Link to="/">Explorar</Link>
        <Link to="/nosotros">Nosotros</Link>
        
        {user ? (
          <div className="user-menu-container">
            {/* Mostrar saldo solo si es espectador */}
            {user.rol === 'espectador' && (
              <span className="coins-badge" title="Tus Monedas">
                💰 {user.monedas}
              </span>
            )}

            <div 
              className="nav-avatar" 
              onClick={() => setShowMenu(!showMenu)}
              title={user.nombre}
            >
              {user.nombre.charAt(0).toUpperCase()}
            </div>

            {showMenu && (
              <div className="user-dropdown">
                <div className="dropdown-header">
                  <p className="text-neon bold">{user.nombre}</p>
                  <p className="text-muted text-small text-uppercase">{user.rol}</p>
                </div>
                
                <Link to="/dashboard" className="dropdown-item" onClick={() => setShowMenu(false)}>
                  📊 Mi Dashboard
                </Link>
                <Link to="/configuracion" className="dropdown-item" onClick={() => setShowMenu(false)}>
                  ⚙️ Configuración
                </Link>
                
                <div className="dropdown-divider"></div>
                
                <button className="dropdown-item text-red" onClick={handleLogout}>
                  🚪 Cerrar Sesión
                </button>
              </div>
            )}
          </div>
        ) : (
          <Link to="/login">
            <button className="nav-btn-login">INGRESAR</button>
          </Link>
        )}
      </div>
    </nav>
  );
};

export default Navbar;