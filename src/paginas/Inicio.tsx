import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../servicios/api';

const Inicio = () => {
  const [streams, setStreams] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchStreams = async () => {
      try {
        const data = await api.get('/streams'); // Endpoint que creamos en el backend
        setStreams(data);
      } catch (error) {
        console.error("Error cargando streams:", error);
      } finally {
        setLoading(false);
      }
    };
    
    fetchStreams();
    // Refrescar lista cada 10 segundos
    const intervalo = setInterval(fetchStreams, 10000);
    return () => clearInterval(intervalo);
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
                <Link to={`/stream/${stream.id}`} key={stream.id} className="link-reset">
                  <div className="stream-card stream-card-real">
                    <div className="stream-thumbnail">
                      {/* Generamos un gradiente aleatorio basado en el ID para simular miniatura */}
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
                        {/* Mostramos el nivel del streamer si viene del backend */}
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