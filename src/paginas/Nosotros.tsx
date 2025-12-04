// jhonp9/pw_otra_f/pw_otra_f-9f1b6a4baa37b2bcf11c6cd1b39d10e8ab587935/src/paginas/Nosotros.tsx
import { Link } from 'react-router-dom';

const Nosotros = () => {
  // NOTA: Como en vite.config.ts la base es '/pw_otra_f/', debemos prefijar las imágenes públicas
  const BASE_PATH = '/pw_otra_f'; 

  const equipo = [
    { 
      nombre: 'Rodrigo Jesús Sarria Flores', 
      foto: `${BASE_PATH}/equipo/rodrigo.jpeg`,
      rol: 'Full Stack Developer' 
    },
    { 
      nombre: 'Angelo Matius Diaz De la Flor', 
      foto: `${BASE_PATH}/equipo/angelo.jpeg`,
      rol: 'Frontend Developer' 
    },
    { 
      nombre: 'Franco Egoavil Calderon', 
      foto: `${BASE_PATH}/equipo/franco.jpeg`,
      rol: 'Backend Developer' 
    },
    { 
      nombre: 'Oscar Alfredo Meza Payano', 
      foto: `${BASE_PATH}/equipo/oscar.jpeg`,
      rol: 'UI/UX Designer' 
    },
    { 
      nombre: 'Cesar Steven Alegre Flores', 
      foto: `${BASE_PATH}/equipo/cesar.jpeg`,
      rol: 'QA Engineer' 
    }
  ];

  return (
    <div className="container text-center" style={{ minHeight: '80vh', display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center' }}>
      <h1 className="section-title text-neon" style={{ fontSize: '3rem', marginBottom: '10px' }}>NUESTRO EQUIPO</h1>
      <p className="text-muted mb-20" style={{ maxWidth: '600px', margin: '0 auto 50px', fontSize: '1.2rem' }}>
        Desarrolladores apasionados construyendo el futuro del streaming interactivo.
      </p>
      
      <div className="gift-grid" style={{ justifyContent: 'center', gap: '30px' }}>
        {equipo.map((miembro, i) => (
          <div key={i} className="gift-card" style={{ padding: '20px', width: '220px', background: '#18181b', border: '1px solid #333', borderRadius: '15px' }}>
            <img 
              src={miembro.foto} 
              alt={miembro.nombre}
              style={{ 
                width: '120px', 
                height: '120px', 
                borderRadius: '50%', 
                marginBottom: '15px', 
                border: '3px solid #00ff41',
                objectFit: 'cover'
              }}
              onError={(e) => {
                // Fallback si falla la carga
                (e.target as HTMLImageElement).src = `https://api.dicebear.com/7.x/avataaars/svg?seed=${miembro.nombre}`;
              }}
            />
            <h4 style={{ margin: '10px 0', color: 'white', minHeight: '50px' }}>
              {miembro.nombre.split(' ')[0]} {miembro.nombre.split(' ')[2] || ''}
            </h4>
            <p className="text-muted text-small">{miembro.rol}</p>
          </div>
        ))}
      </div>
      
      <div className="mt-40">
        <Link to="/"><button className="btn-regresar">Volver al Inicio</button></Link>
      </div>
    </div>
  );
};

export default Nosotros;