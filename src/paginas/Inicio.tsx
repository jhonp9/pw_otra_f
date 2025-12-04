// jhonp9/pw_otra_f/pw_otra_f-da43e77ca85f163b483dcad2d37ca90dd34b4584/src/paginas/Inicio.tsx
import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../servicios/api';

const Inicio = () => {
  const [streams, setStreams] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchStreams = async () => {
    try {
      const data = await api.get('/streams');
      // Filtramos en frontend también por si acaso el backend devuelve cacheados
      setStreams(data.filter((s:any) => s.estaEnVivo));
    } catch (error) {
      console.error("Error cargando streams:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStreams();
    const interval = setInterval(fetchStreams, 5000); // 5 segundos es mejor UX
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="full-width">
      <div className="hero-section">
        <div className="hero-content">
          <span className="hero-tag">AHORA EN VIVO</span>
          <h1 className="hero-title">DESCUBRE NUEVOS TALENTOS</h1>
          <p className="hero-subtitle">La plataforma de streaming hecha por la comunidad.</p>
        </div>
      </div>

      <div className="container">
        <h2 className="section-title text-start">Canales Recomendados</h2>
        
        {loading ? (
          <p className="text-center text-muted">Cargando canales...</p>
        ) : (
          <div className="stream-grid">
            {streams.length > 0 ? (
              streams.map((stream) => (
                <Link to={`/stream/${stream.usuarioId}`} key={stream.id} className="link-reset">
                  <div className="stream-card stream-card-real">
                    <div className="stream-thumbnail">
                      <div className="thumb-gradient" style={{
                        background: `linear-gradient(45deg, #111, hsl(${stream.usuario.id * 50}, 70%, 50%) 80%)`
                      }}></div>
                      <span className="live-badge" style={{position: 'absolute', top: 10, left: 10}}>
                        EN VIVO
                      </span>
                    </div>

                    <div className="stream-info">
                      <div className="stream-avatar">
                        {stream.usuario.nombre.charAt(0)}
                      </div>
                      <div className="stream-text">
                        <h4 className="stream-title">{stream.titulo}</h4>
                        <p className="stream-user">{stream.usuario.nombre}</p>
                        <span className="stream-category">{stream.categoria}</span>
                        <span className="text-muted text-small ml-10"> • Lvl {stream.usuario.nivelStreamer}</span>
                      </div>
                    </div>
                  </div>
                </Link>
              ))
            ) : (
              <div className="text-center w-100 mt-40">
                <h3 className="text-muted">No hay streams en vivo ahora mismo 😴</h3>
                <p>¡Sé el primero en iniciar transmisión desde tu Dashboard!</p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default Inicio;