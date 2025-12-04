import { Link } from 'react-router-dom';

const Nosotros = () => {
  // Ahora cada miembro tiene nombre y la ruta de su foto
  // La ruta empieza con /equipo/... porque está en la carpeta public
  const equipo = [
    { 
      nombre: 'Rodrigo Jesús Sarria Flores', 
      foto: '/equipo/rodrigo.jpeg', 
      rol: 'Full Stack Developer' 
    },
    { 
      nombre: 'Angelo Matius Diaz De la Flor', 
      foto: '/equipo/angelo.jpeg', 
      rol: 'Frontend Developer' 
    },
    { 
      nombre: 'Franco Egoavil Calderon', 
      foto: '/equipo/franco.jpeg', 
      rol: 'Backend Developer' 
    },
    { 
      nombre: 'Oscar Alfredo Meza Payano', 
      foto: '/equipo/oscar.jpeg', 
      rol: 'UI/UX Designer' 
    },
    { 
      nombre: 'Cesar Steven Alegre Flores', 
      foto: '/equipo/cesar.jpeg', 
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
                objectFit: 'cover' // Esto asegura que la foto no se deforme
              }}
              // Si la foto falla (ej. nombre incorrecto), muestra un avatar por defecto
              onError={(e) => {
                (e.target as HTMLImageElement).src = `https://api.dicebear.com/7.x/avataaars/svg?seed=${miembro.nombre}`;
              }}
            />
            {/* Lógica para mostrar nombre corto (Primer nombre + Primer apellido) */}
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