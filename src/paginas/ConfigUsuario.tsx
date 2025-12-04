import { useAuth } from '../context/AuthContext';
import { Link } from 'react-router-dom';

const ConfigUsuario = () => {
  const { user } = useAuth();

  if (!user) return <div className="container text-center">Cargando...</div>;

  return (
    <div className="container">
      <h1 className="section-title">MI PERFIL</h1>
      
      <div className="dashboard-layout">
        {/* Panel Izquierdo: Avatar e Info */}
        <div className="dashboard-panel">
          <div className="form-box text-center">
            <div className="profile-avatar" style={{margin: '0 auto 20px'}}>
              {user.nombre.charAt(0).toUpperCase()}
            </div>
            <h2 className="text-neon">{user.nombre}</h2>
            <span className="hero-tag">{user.rol.toUpperCase()}</span>
            <p className="text-muted mt-20">{user.email}</p>
          </div>
        </div>

        {/* Panel Derecho: Estadísticas */}
        <div className="dashboard-panel">
          <div className="form-box">
            <h3>Estadísticas de la Cuenta</h3>
            <div className="mt-20">
              <div className="level-row">
                <span>Saldo Actual:</span>
                <span className="text-neon bold">{user.monedas} Monedas</span>
              </div>
              
              {user.rol === 'espectador' ? (
                <>
                  <div className="level-row">
                    <span>Nivel de Espectador:</span>
                    <span className="bold">{user.nivelEspectador}</span>
                  </div>
                  <div className="level-row">
                    <span>Experiencia Total (XP):</span>
                    <span className="bold">{user.puntosXP} pts</span>
                  </div>
                </>
              ) : (
                <>
                  <div className="level-row">
                    <span>Nivel de Streamer:</span>
                    <span className="bold">{user.nivelStreamer}</span>
                  </div>
                  <div className="level-row">
                    <span>Horas Transmitidas:</span>
                    <span className="bold">{user.horasStream.toFixed(2)} h</span>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="text-center mt-40">
        <Link to="/"><button className="btn-regresar">Volver al Inicio</button></Link>
      </div>
    </div>
  );
};

export default ConfigUsuario;