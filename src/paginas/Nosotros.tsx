import { Link } from 'react-router-dom';

const Nosotros = () => {
  const equipo = ['Alex Dev', 'Sam Design', 'Chris Backend', 'Taylor QA'];

  return (
    <div className="container text-center">
      <h1 className="section-title">NUESTRO EQUIPO</h1>
      <p className="text-muted mb-20" style={{maxWidth: '600px', margin: '0 auto 40px'}}>
        Somos un grupo apasionado de desarrolladores creando la próxima generación de entretenimiento en vivo.
      </p>
      
      <div className="gift-grid">
        {equipo.map((nombre, i) => (
          <div key={i} className="gift-card">
            <div className="profile-avatar" style={{margin: '0 auto 15px', width: '60px', height: '60px', fontSize: '1.5rem'}}>
              {nombre.charAt(0)}
            </div>
            <h4>{nombre}</h4>
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