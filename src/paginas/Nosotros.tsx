// jhonp9/pw_otra_f/pw_otra_f-6420afd1c27951a0e347ec5e5f14f39cefa7bcce/src/paginas/Nosotros.tsx
import { Link } from 'react-router-dom';

const Nosotros = () => {
  const equipo = [
    'Rodrigo Jesús Sarria Flores', 
    'Angelo Matius Diaz De la Flor', 
    'Franco Egoavil Calderon', 
    'Oscar Alfredo Meza Payano', 
    'Cesar Steven Alegre Flores'
  ];

  return (
    <div className="container text-center" style={{ minHeight: '80vh', display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center' }}>
      <h1 className="section-title text-neon" style={{ fontSize: '3rem', marginBottom: '10px' }}>NUESTRO EQUIPO</h1>
      <p className="text-muted mb-20" style={{ maxWidth: '600px', margin: '0 auto 50px', fontSize: '1.2rem' }}>
        Desarrolladores apasionados construyendo el futuro del streaming interactivo.
      </p>
      
      <div className="gift-grid" style={{ justifyContent: 'center', gap: '30px' }}>
        {equipo.map((nombre, i) => (
          <div key={i} className="gift-card" style={{ padding: '20px', width: '200px', background: '#18181b', border: '1px solid #333', borderRadius: '15px' }}>
            <img 
              src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${nombre}`} 
              alt={nombre}
              style={{ width: '100px', height: '100px', borderRadius: '50%', marginBottom: '15px', border: '3px solid #00ff41' }}
            />
            <h4 style={{ margin: '10px 0', color: 'white' }}>{nombre.split(' ')[0]} {nombre.split(' ')[2] || ''}</h4>
            <p className="text-muted text-small">Full Stack Developer</p>
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