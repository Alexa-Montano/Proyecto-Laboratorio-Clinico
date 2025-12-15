// ===================== IMPORTACIONES =====================
const express = require('express');
const session = require('express-session');
const bcrypt = require('bcrypt');
const mysql = require('mysql2');
const path = require('path');

const app = express();
const multer = require('multer');
const xlsx = require('xlsx');
const fs = require('fs');


// ===================== MIDDLEWARES =====================
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

app.use(session({
  secret: 'laboratorio_clinico_secreto',
  resave: false,
  saveUninitialized: false
}));

// Archivos estáticos
app.use(express.static(path.join(__dirname, 'public'), { index: false }));

// ===================== MYSQL =====================
const db = mysql.createConnection({
  host: 'localhost',
  user: 'usuario1',
  password: 'hola',
  database: 'laboratorio'
});

db.connect(err => {
  if (err) {
    console.error('Error MySQL:', err);
    return;
  }
  console.log('MySQL conectado');
});
// ===================== MIDDLEWARE DE LOGIN =====================
function requireLogin(req, res, next) {
  if (!req.session.usuario) {
    return res.redirect('/login.html');
  }
  next();
}

// ===================== MIDDLEWARE DE ROLES =====================
function requireRole(roles) {
  return (req, res, next) => {
    if (!roles.includes(req.session.usuario.rol)) {
      return res.send(`
        <link rel="stylesheet" href="/css/styles.css">
        <div class="auth-body">
          <div class="auth-container">
            <div class="auth-card">
              <h2>Acceso denegado</h2>
              <p>No tienes permisos para acceder a esta sección.</p>
              <a href="/dashboard" class="btn btn-primary">Volver</a>
            </div>
          </div>
        </div>
      `);
    }
    next();
  };
}
const storageResultados = multer.diskStorage({
  destination: 'public/resultados',
  filename: (req, file, cb) => {
    const nombre = `resultado_${Date.now()}_${file.originalname}`;
    cb(null, nombre);
  }
});

const uploadResultado = multer({ storage: storageResultados });


//======== RUTAS PROTEGIDAS========
app.get('/dashboard', requireLogin, (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'dashboard.html'));
});

app.get('/pacientes', requireLogin, requireRole(['admin','asistente']), (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'pacientes.html'));
});

app.get('/medicos', requireLogin, requireRole(['admin']), (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'medicos.html'));
});

app.get('/estudios', requireLogin, (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'estudios.html'));
});

app.get('/resultados', requireLogin, (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'resultados.html'));
});

app.get(
  '/estudios/lista',
  requireLogin,
  (req, res) => {
    db.query('SELECT * FROM estudios', (err, results) => {
      if (err) {
        console.error(err);
        return res.status(500).json([]);
      }
      res.json(results);
    });
  }
);

app.get('/estudios/buscar', requireLogin, (req, res) => {
  const q = `%${req.query.q}%`;

  db.query(
    'SELECT * FROM estudios WHERE nombre LIKE ?',
    [q],
    (err, results) => {
      if (err) return res.status(500).send('Error');
      res.json(results);
    }
  );
});


app.get('/session', requireLogin, (req, res) => {
  res.json({
    nombre: req.session.usuario.nombre,
    rol: req.session.usuario.rol
  });
});

app.get('/busquedas', requireLogin, (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'busquedas.html'));
});


app.post(
  '/pacientes/crear',
  requireLogin,
  requireRole(['admin']),
  (req, res) => {
    const { nombre, correo, telefono, fecha_nacimiento } = req.body;

    const sql = `
      INSERT INTO pacientes (nombre, correo, telefono, fecha_nacimiento)
      VALUES (?, ?, ?, ?)
    `;

    db.query(
      sql,
      [nombre, correo, telefono, fecha_nacimiento],
      err => {
        if (err) {
          console.error(err);
          return res.send('Error al registrar paciente');
        }

        res.send(`
          <link rel="stylesheet" href="/css/styles.css">
          <div class="auth-body">
            <div class="auth-container">
              <div class="auth-card">
                <h2>Paciente registrado</h2>
                <p>El paciente fue registrado correctamente.</p>
                <a href="/pacientes.html" class="btn btn-primary">
                  Volver
                </a>
              </div>
            </div>
          </div>
        `);
      }
    );
  }
);

app.post(
  '/resultados/subir/:citaId',
  requireLogin,
  requireRole(['admin','asistente']),
  uploadResultado.single('archivo'),
  (req, res) => {

    const { citaId } = req.params;
    const archivo = req.file.filename;

    const sql = `
      INSERT INTO resultados (cita_id, archivo, estado)
      VALUES (?, ?, 'disponible')
      ON DUPLICATE KEY UPDATE
        archivo = VALUES(archivo),
        estado = 'disponible'
    `;

    db.query(sql, [citaId, archivo], err => {
      if (err) {
        console.error(err);
        return res.send('Error al subir resultado');
      }

      res.send(renderMensaje(
        'Resultado cargado',
        'El archivo fue subido correctamente.',
        '/medico/citas'
      ));
    });
  }
);


app.get(
  '/medico/consultar/:citaId',
  requireLogin,
  requireRole(['admin','asistente']),
  (req, res) => {

    res.send(`
<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="UTF-8">
<title>Consulta médica</title>
<link rel="stylesheet" href="/css/styles.css">
</head>
<body class="auth-body">

<div class="auth-container">
  <div class="auth-card">
    <h2>Resultados del estudio</h2>

    <form action="/resultados/guardar/${req.params.citaId}" method="POST">
      <label>Resultados / Valores</label>
      <textarea name="valores" required></textarea>

      <label>Observaciones</label>
      <textarea name="observaciones"></textarea>

      <button class="btn btn-primary">Guardar resultados</button>
    </form>

    <hr>

    <form action="/resultados/subir/${req.params.citaId}"
          method="POST"
          enctype="multipart/form-data">
      <label>Subir archivo Excel</label>
      <input type="file" name="archivo" accept=".xlsx" required>
      <button class="btn btn-secondary">Subir Excel</button>
    </form>

    <a href="/medico/citas" class="btn btn-secondary">Volver</a>
  </div>
</div>

</body>
</html>
    `);
  }
);




app.post(
  '/medico/generar-xls/:citaId',
  requireLogin,
  requireRole(['admin','asistente']),
  (req, res) => {

    const { mensaje } = req.body;

    const data = [
      { Resultado: mensaje }
    ];

    const wb = xlsx.utils.book_new();
    const ws = xlsx.utils.json_to_sheet(data);
    xlsx.utils.book_append_sheet(wb, ws, 'Resultado');

    const fileName = `resultado_${Date.now()}.xlsx`;
    const filePath = path.join(__dirname, 'public', 'resultados', fileName);

    xlsx.writeFile(wb, filePath);

    res.download(filePath);
  }
);


app.get(
  '/mis-resultados',
  requireLogin,
  requireRole(['cliente']),
  (req, res) => {

    const usuarioId = req.session.usuario.id;

    const sql = `
      SELECT 
        e.nombre AS estudio,
        r.archivo,
        r.fecha_subida,
        r.valores,
        r.observaciones
      FROM resultados r
      JOIN citas c ON r.cita_id = c.id
      JOIN estudios e ON c.estudio_id = e.id
      WHERE c.usuario_id = ?
    `;

    db.query(sql, [usuarioId], (err, rows) => {
      if (err) {
        console.error(err);
        return res.send('Error');
      }

      let filas = rows.map(r => `
        <tr>
          <td>${r.estudio}</td>
          <td>${r.fecha_subida || ''}</td>
          <td>${r.valores || 'Pendiente'}</td>
          <td>${r.observaciones || ''}</td>
          <td>
            ${
              r.archivo
                ? `<a href="/resultados/${r.archivo}" class="btn btn-primary" download>
                     Descargar
                   </a>`
                : '—'
            }
          </td>
        </tr>
      `).join('');

      res.send(`
        <link rel="stylesheet" href="/css/styles.css">
        <div class="main">
          <h2>Mis resultados</h2>
          <table class="table">
            <tr>
              <th>Estudio</th>
              <th>Fecha</th>
              <th>Resultados</th>
              <th>Observaciones</th>
              <th>Archivo</th>
            </tr>
            ${filas}
          </table>
          <a href="/dashboard" class="btn btn-secondary">Volver</a>
        </div>
      `);
    });
  }
);


//=== formulario para subir archivo medico
app.get(
  '/resultados/subir/:citaId',
  requireLogin,
  requireRole(['admin','asistente']),
  (req, res) => {

    res.send(`
<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="UTF-8">
<title>Subir resultado</title>
<link rel="stylesheet" href="/css/styles.css">
</head>
<body class="auth-body">

<div class="auth-container">
  <div class="auth-card">
    <h2>Subir resultados del estudio</h2>

    <form action="/resultados/subir/${req.params.citaId}"
          method="POST"
          enctype="multipart/form-data">

      <label>Archivo de resultados (XLS / XLSX)</label>
      <input type="file" name="archivo" accept=".xls,.xlsx" required>

      <button class="btn btn-primary">Guardar resultado</button>
    </form>

    <a href="/medico/citas" class="btn btn-secondary">Volver</a>
  </div>
</div>

</body>
</html>
    `);
  }
);




//=====RUTA PARA VER PACIENTES======
app.get(
  '/pacientes/lista',
  requireLogin,
  requireRole(['admin','asistente']),
  (req, res) => {
    db.query('SELECT * FROM pacientes', (err, results) => {
      if (err) {
        console.error(err);
        return res.send('Error al obtener pacientes');
      }

      const esAdmin = req.session.usuario.rol === 'admin';

      let filas = results.map(p => `
        <tr>
          <td>${p.id}</td>
          <td>${p.nombre}</td>
          <td>${p.correo || ''}</td>
          <td>${p.telefono || ''}</td>
          ${
            esAdmin
              ? `<td>
                  <a href="/pacientes/editar/${p.id}" class="btn btn-secondary">
                    Editar
                  </a>
                </td>`
              : `<td>Solo lectura</td>`
          }
        </tr>
      `).join('');


      res.send(`
        <link rel="stylesheet" href="/css/styles.css">
        <div class="main">
          <h2>Lista de Pacientes</h2>
          <table class="table">
            <tr>
              <th>ID</th>
              <th>Nombre</th>
              <th>Correo</th>
              <th>Teléfono</th>
              <th>Acciones</th>
            </tr>
            ${filas}
          </table>
          <a href="/pacientes" class="btn btn-primary">Volver</a>
        </div>
      `);
    });
  }
);

// ===== FORMULARIO EDITAR PACIENTE =====
app.get(
  '/pacientes/editar/:id',
  requireLogin,
  requireRole(['admin']),
  (req, res) => {
    const { id } = req.params;

    db.query(
      'SELECT * FROM pacientes WHERE id = ?',
      [id],
      (err, results) => {
        if (err || results.length === 0) {
          console.error(err);
          return res.send('Paciente no encontrado');
        }

        const p = results[0];

        res.send(`
<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <title>Editar Paciente</title>
  <link rel="stylesheet" href="/css/styles.css">
</head>
<body class="auth-body">

  <div class="auth-container">
    <div class="auth-card">
      <h2>Editar Paciente</h2>

      <form action="/pacientes/editar/${p.id}" method="POST" class="auth-form">

        <label>Nombre</label>
        <input type="text" name="nombre" value="${p.nombre}" required>

        <label>Correo</label>
        <input type="email" name="correo" value="${p.correo || ''}">

        <label>Teléfono</label>
        <input type="text" name="telefono" value="${p.telefono || ''}">

        <label>Fecha de nacimiento</label>
        <input type="date" name="fecha_nacimiento" value="${p.fecha_nacimiento || ''}">

        <button type="submit" class="btn btn-primary">
          Guardar cambios
        </button>

      </form>

      <a href="/pacientes/lista" class="btn btn-secondary">
        Volver
      </a>
    </div>
  </div>

</body>
</html>
        `);
      }
    );
  }
);
// ===== GUARDAR CAMBIOS PACIENTE =====
app.post(
  '/pacientes/editar/:id',
  requireLogin,
  requireRole(['admin']),
  (req, res) => {
    const { id } = req.params;
    let { nombre, correo, telefono, fecha_nacimiento } = req.body;

    // convertir fecha vacía a NULL
    if (!fecha_nacimiento) {
      fecha_nacimiento = null;
    }

    const sql = `
      UPDATE pacientes
      SET nombre = ?, correo = ?, telefono = ?, fecha_nacimiento = ?
      WHERE id = ?
    `;

    db.query(
      sql,
      [nombre, correo, telefono, fecha_nacimiento, id],
      err => {
        if (err) {
          console.error('ERROR UPDATE PACIENTE:', err);
          return res.send(renderMensaje(
            'Error',
            'No se pudo actualizar el paciente.',
            '/pacientes/lista'
          ));
        }

        res.send(renderMensaje(
          'Paciente actualizado',
          'Los datos del paciente fueron actualizados correctamente.',
          '/pacientes/lista'
        ));
      }
    );
  }
);




// FORMULARIO NUEVO PACIENTE
app.get(
  '/pacientes/nuevo',
  requireLogin,
  requireRole(['admin']),
  (req, res) => {
    res.sendFile(
      path.join(__dirname, 'public', 'paciente_nuevo.html')
    );
  }
);
app.get(
  '/pacientes',
  requireLogin,
  requireRole(['admin']),
  (req, res) => {
    res.sendFile(
      path.join(__dirname, 'public', 'pacientes.html')
    );
  }
);

//==== formulario para registrar medico===
app.get(
  '/medicos/nuevo',
  requireLogin,
  requireRole(['admin']),
  (req, res) => {
    res.sendFile(
      path.join(__dirname, 'public', 'medico_nuevo.html')
    );
  }
);
app.post(
  '/medicos/crear',
  requireLogin,
  requireRole(['admin']),
  (req, res) => {

    const { nombre, especialidad, cedula_profesional } = req.body;

    const sql = `
      INSERT INTO medicos (nombre, especialidad, cedula_profesional)
      VALUES (?, ?, ?)
    `;

    db.query(
      sql,
      [nombre, especialidad, cedula_profesional],
      err => {
        if (err) {
          console.error(err);
          return res.send(renderMensaje(
            'Error',
            'No se pudo registrar el médico.',
            '/medicos'
          ));
        }

        res.send(renderMensaje(
          'Médico registrado',
          'El médico fue registrado correctamente.',
          '/medicos'
        ));
      }
    );
  }
);

app.get(
  '/medicos/lista',
  requireLogin,
  requireRole(['admin']),
  (req, res) => {
    db.query('SELECT * FROM medicos', (err, results) => {
      if (err) return res.send('Error');

        let filas = results.map(m => `
          <tr>
            <td>${m.id}</td>
            <td>${m.nombre}</td>
            <td>${m.especialidad}</td>
            <td>${m.cedula_profesional}</td>
            <td>
              <a href="/medicos/editar/${m.id}" class="btn btn-secondary">Editar</a>
              <a href="/medicos/eliminar/${m.id}" class="btn btn-danger"
                onclick="return confirm('¿Eliminar este médico?')">
                Eliminar
              </a>
            </td>
          </tr>
        `).join('');


      res.send(`
        <link rel="stylesheet" href="/css/styles.css">
        <div class="main">
          <h2>Lista de Médicos</h2>
          <table class="table">
            <tr>
              <th>ID</th>
              <th>Nombre</th>
              <th>Especialidad</th>
              <th>Cédula profesional</th>
              <th>Acciones</th>
            </tr>
            ${filas}
          </table>
          <a href="/medicos" class="btn btn-primary">Volver</a>
        </div>
      `);
    });
  }
);

app.get(
  '/pacientes/lista-json',
  requireLogin,
  requireRole(['admin','asistente']),
  (req, res) => {
    db.query(
      "SELECT id, nombre FROM usuarios WHERE rol = 'cliente'",
      (err, results) => {
        if (err) return res.json([]);
        res.json(results);
      }
    );
  }
);


app.post(
  '/resultados/guardar/:citaId',
  requireLogin,
  requireRole(['admin','asistente']),
  (req, res) => {

    const { citaId } = req.params;
    const { valores, observaciones } = req.body;

    // Guardar resultados
    const sqlResultados = `
      INSERT INTO resultados (cita_id, valores, observaciones, estado)
      VALUES (?, ?, ?, 'disponible')
      ON DUPLICATE KEY UPDATE
        valores = VALUES(valores),
        observaciones = VALUES(observaciones),
        estado = 'disponible'
    `;

    db.query(sqlResultados, [citaId, valores, observaciones], err => {
      if (err) {
        console.error(err);
        return res.send('Error al guardar resultados');
      }

      // Marcar la cita como ATENDIDA
      const sqlCita = `
        UPDATE citas
        SET estado = 'Atendida'
        WHERE id = ?
      `;

      db.query(sqlCita, [citaId], err => {
        if (err) {
          console.error(err);
          return res.send('Error al actualizar cita');
        }

        // Generar Excel automáticamente
        const data = [
          { Campo: 'Resultados', Valor: valores },
          { Campo: 'Observaciones', Valor: observaciones }
        ];

        const wb = xlsx.utils.book_new();
        const ws = xlsx.utils.json_to_sheet(data);
        xlsx.utils.book_append_sheet(wb, ws, 'Resultados');

        const fileName = `resultado_cita_${citaId}.xlsx`;
        const filePath = path.join(__dirname, 'public', 'resultados', fileName);

        xlsx.writeFile(wb, filePath);

        // Guardar nombre del archivo
        const sqlArchivo = `
          UPDATE resultados
          SET archivo = ?
          WHERE cita_id = ?
        `;

        db.query(sqlArchivo, [fileName, citaId], () => {
          res.redirect('/medico/citas');
        });
      });
    });
  }
);

// ===== FORMULARIO EDITAR MÉDICO =====
app.get(
  '/medicos/editar/:id',
  requireLogin,
  requireRole(['admin']),
  (req, res) => {
    const { id } = req.params;

    db.query(
      'SELECT * FROM medicos WHERE id = ?',
      [id],
      (err, results) => {
        if (err || results.length === 0) {
          console.error(err);
          return res.send('Médico no encontrado');
        }

        const m = results[0];

        res.send(`
<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <title>Editar Médico</title>
  <link rel="stylesheet" href="/css/styles.css">
</head>
<body class="auth-body">

  <div class="auth-container">
    <div class="auth-card">
      <h2>Editar Médico</h2>

      <form action="/medicos/editar/${m.id}" method="POST" class="auth-form">

        <label>Nombre</label>
        <input type="text" name="nombre" value="${m.nombre}" required>

        <label>Especialidad</label>
        <input type="text" name="especialidad" value="${m.especialidad || ''}">

        <label>Cédula profesional</label>
        <input type="text" name="cedula_profesional" value="${m.cedula_profesional || ''}">

        <button type="submit" class="btn btn-primary">
          Guardar cambios
        </button>
      </form>

      <a href="/medicos/lista" class="btn btn-secondary">
        Volver
      </a>
    </div>
  </div>

</body>
</html>
        `);
      }
    );
  }
);
// ===== GUARDAR CAMBIOS MÉDICO =====
app.post(
  '/medicos/editar/:id',
  requireLogin,
  requireRole(['admin']),
  (req, res) => {
    const { id } = req.params;
    const { nombre, especialidad, cedula_profesional } = req.body;

    const sql = `
      UPDATE medicos
      SET nombre = ?, especialidad = ?, cedula_profesional = ?
      WHERE id = ?
    `;

    db.query(
      sql,
      [nombre, especialidad, cedula_profesional, id],
      err => {
        if (err) {
          console.error(err);
          return res.send(renderMensaje(
            'Error',
            'No se pudo actualizar el médico.',
            '/medicos/lista'
          ));
        }

        res.send(renderMensaje(
          'Médico actualizado',
          'Los datos del médico fueron actualizados correctamente.',
          '/medicos/lista'
        ));
      }
    );
  }
);
// ===== ELIMINAR MÉDICO =====
app.get(
  '/medicos/eliminar/:id',
  requireLogin,
  requireRole(['admin']),
  (req, res) => {
    const { id } = req.params;

    db.query(
      'DELETE FROM medicos WHERE id = ?',
      [id],
      err => {
        if (err) {
          console.error(err);
          return res.send(renderMensaje(
            'Error',
            'No se pudo eliminar el médico.',
            '/medicos/lista'
          ));
        }

        res.send(renderMensaje(
          'Médico eliminado',
          'El médico fue eliminado correctamente.',
          '/medicos/lista'
        ));
      }
    );
  }
);
//==== ver citas del paciente ==
app.get(
  '/citas/mis-citas',
  requireLogin,
  requireRole(['cliente']),
  (req, res) => {
    const usuario_id = req.session.usuario.id;

    const sql = `
      SELECT 
        c.fecha,
        c.hora,
        c.estado,
        e.nombre AS estudio,
        e.precio
      FROM citas c
      JOIN estudios e ON c.estudio_id = e.id
      WHERE c.usuario_id = ?
      ORDER BY c.fecha, c.hora
    `;

    db.query(sql, [usuario_id], (err, results) => {
      if (err) {
        console.error(err);
        return res.send('Error al obtener citas');
      }

      let filas = results.map(c => `
        <tr>
          <td>${c.estudio}</td>
          <td>${c.fecha}</td>
          <td>${c.hora}</td>
          <td>${c.estado}</td>
        </tr>
      `).join('');

      res.send(`
        <link rel="stylesheet" href="/css/styles.css">
        <div class="main">
          <h2>Mis citas</h2>
          <table class="table">
            <tr>
              <th>Estudio</th>
              <th>Fecha</th>
              <th>Hora</th>
              <th>Estado</th>
            </tr>
            ${filas}
          </table>
          <a href="/dashboard" class="btn btn-primary">Volver</a>
        </div>
      `);
    });
  }
);
//=== ver citas como administrador ===
app.get(
  '/citas',
  requireLogin,
  requireRole(['admin']),
  (req, res) => {
    const sql = `
      SELECT 
        c.id,
        u.nombre AS paciente,
        e.nombre AS estudio,
        c.fecha,
        c.hora,
        c.estado
      FROM citas c
      JOIN usuarios u ON c.usuario_id = u.id
      JOIN estudios e ON c.estudio_id = e.id
      ORDER BY c.fecha
    `;

    db.query(sql, (err, results) => {
      if (err) return res.send('Error');

      let filas = results.map(c => `
        <tr>
          <td>${c.paciente}</td>
          <td>${c.estudio}</td>
          <td>${c.fecha}</td>
          <td>${c.hora}</td>
          <td>${c.estado}</td>
        </tr>
      `).join('');

      res.send(`
        <link rel="stylesheet" href="/css/styles.css">
        <div class="main">
          <h2>Citas programadas</h2>
          <table class="table">
            <tr>
              <th>Paciente</th>
              <th>Estudio</th>
              <th>Fecha</th>
              <th>Hora</th>
              <th>Estado</th>
            </tr>
            ${filas}
          </table>
        </div>
      `);
    });
  }
);


app.post('/citas/agendar', requireLogin, (req, res) => {
  const { estudio_id, fecha, hora } = req.body;
  const usuario_id = req.session.usuario.id;

  db.query(
    'INSERT INTO citas (usuario_id, estudio_id, fecha, hora) VALUES (?, ?, ?, ?)',
    [usuario_id, estudio_id, fecha, hora],
    err => {
      if (err) {
        console.error(err);
        return res.send('Error al agendar cita');
      }
      res.redirect('/dashboard');
    }
  );
});




// ===================== AUTH =====================
function auth(req, res, next) {
  if (!req.session.usuario) {
    return res.redirect('/login.html');
  }
  next();
}

// ===================== MENÚ DINÁMICO =====================
app.get('/menu', requireLogin, (req, res) => {
  const rol = req.session.usuario.rol;
  let menu = [];

  // ===== ADMIN =====
  if (rol === 'admin') {
    menu = [
      { nombre: 'Inicio', url: '/dashboard' },
      { nombre: 'Pacientes', url: '/pacientes' },
      { nombre: 'Médicos', url: '/medicos' },
      { nombre: 'Estudios', url: '/estudios' },
      { nombre: 'Resultados', url: '/medico/citas' },
      { nombre: 'Cerrar sesión', url: '/logout' }
    ];
  }

  // ===== MÉDICO / ASISTENTE =====
  if (rol === 'asistente') {
    menu = [
      { nombre: 'Inicio', url: '/dashboard' },
      { nombre: 'Pacientes', url: '/pacientes' },
      { nombre: 'Citas', url: '/medico/citas' },
      { nombre: 'Cerrar sesión', url: '/logout' }
    ];
  }

  // ===== PACIENTE =====
  if (rol === 'cliente') {
    menu = [
      { nombre: 'Inicio', url: '/dashboard' },
      { nombre: 'Buscar estudios', url: '/busquedas' },
      { nombre: 'Mis citas', url: '/citas/mis-citas' },
      { nombre: 'Mis resultados', url: '/mis-resultados' },
      { nombre: 'Cerrar sesión', url: '/logout' }
    ];
  }

  res.json(menu);
});


// ===================== RUTA PRINCIPAL =====================
app.get('/', auth, (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// ===================== REGISTRO =====================
app.post('/register', async (req, res) => {
  const { nombre, correo, password, codigo } = req.body;

  let rol = null;

  if (codigo === 'ADMIN-2025') rol = 'admin';
  else if (codigo === 'MEDICO-2025') rol = 'asistente';
  else if (codigo === 'PACIENTE-2025') rol = 'cliente';
  else {
    return res.send(renderMensaje(
      'Código inválido',
      'El código de registro no es correcto.',
      '/registro.html'
    ));
  }

  try {
    const hash = await bcrypt.hash(password, 10);

    const sql = `
      INSERT INTO usuarios (nombre, correo, password_hash, rol)
      VALUES (?, ?, ?, ?)
    `;

    db.query(sql, [nombre, correo, hash, rol], err => {
      if (err) {
        console.error(err);
        return res.send(renderMensaje(
          'Error',
          'No se pudo registrar el usuario.',
          '/registro.html'
        ));
      }

      res.send(renderMensaje(
        'Registro exitoso',
        'Usuario registrado correctamente.',
        '/login.html'
      ));
    });

  } catch (error) {
    console.error(error);
    res.send(renderMensaje(
      'Error del servidor',
      'Inténtalo más tarde.',
      '/registro.html'
    ));
  }
});

//===ruta nueva
app.get(
  '/medico/citas',
  requireLogin,
  requireRole(['admin','asistente']),
  (req, res) => {

    const sql = `
      SELECT 
        c.id AS cita_id,
        u.nombre AS paciente,
        e.nombre AS estudio,
        c.fecha,
        c.hora
      FROM citas c
      JOIN usuarios u ON c.usuario_id = u.id
      JOIN estudios e ON c.estudio_id = e.id
      WHERE c.estado = 'Agendada'
      ORDER BY c.fecha
    `;

    db.query(sql, (err, results) => {
      if (err) return res.send('Error');

      let filas = results.map(c => `
        <tr>
          <td>${c.paciente}</td>
          <td>${c.estudio}</td>
          <td>${c.fecha}</td>
          <td>${c.hora}</td>
          <td>
            <a href="/medico/consultar/${c.cita_id}" class="btn btn-primary">
              Consultar / Subir resultado
            </a>
          </td>
        </tr>
      `).join('');

      res.send(`
        <link rel="stylesheet" href="/css/styles.css">
        <div class="main">
          <h2>Citas médicas pendientes</h2>
          <table class="table">
            <tr>
              <th>Paciente</th>
              <th>Estudio</th>
              <th>Fecha</th>
              <th>Hora</th>
              <th>Acción</th>
            </tr>
            ${filas || '<tr><td colspan="5">No hay citas pendientes</td></tr>'}
          </table>
          <a href="/dashboard" class="btn btn-secondary">Volver</a>
        </div>
      `);
    });
  }
);



//====ruta para agregar y editar estudios===
app.get(
  '/estudios/nuevo',
  requireLogin,
  requireRole(['admin']),
  (req, res) => {
    res.sendFile(
      path.join(__dirname, 'public', 'estudio_nuevo.html')
    );
  }
);
//=== guardar estudio nuevo ===
app.post(
  '/estudios/crear',
  requireLogin,
  requireRole(['admin']),
  (req, res) => {
    const { nombre, descripcion, precio } = req.body;

    db.query(
      'INSERT INTO estudios (nombre, descripcion, precio) VALUES (?, ?, ?)',
      [nombre, descripcion, precio],
      err => {
        if (err) {
          console.error(err);
          return res.send(renderMensaje(
            'Error',
            'No se pudo registrar el estudio.',
            '/estudios'
          ));
        }

        res.send(renderMensaje(
          'Estudio agregado',
          'El estudio fue registrado correctamente.',
          '/estudios'
        ));
      }
    );
  }
);
//=== formulario para editar estudio==
app.get(
  '/estudios/editar/:id',
  requireLogin,
  requireRole(['admin']),
  (req, res) => {
    const { id } = req.params;

    db.query(
      'SELECT * FROM estudios WHERE id = ?',
      [id],
      (err, results) => {
        if (err || results.length === 0) {
          return res.send('Estudio no encontrado');
        }

        const e = results[0];

        res.send(`
<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <title>Editar Estudio</title>
  <link rel="stylesheet" href="/css/styles.css">
</head>
<body class="auth-body">

  <div class="auth-container">
    <div class="auth-card">
      <h2>Editar Estudio</h2>

      <form action="/estudios/editar/${e.id}" method="POST" class="auth-form">
        <label>Nombre</label>
        <input type="text" name="nombre" value="${e.nombre}" required>

        <label>Descripción</label>
        <textarea name="descripcion" required>${e.descripcion}</textarea>

        <label>Precio</label>
        <input type="number" name="precio" step="0.01" value="${e.precio}" required>

        <button class="btn btn-primary">Guardar cambios</button>
      </form>

      <a href="/estudios" class="btn btn-secondary">Volver</a>
    </div>
  </div>

</body>
</html>
        `);
      }
    );
  }
);




app.post(
  '/estudios/editar/:id',
  requireLogin,
  requireRole(['admin']),
  (req, res) => {
    const { id } = req.params;
    const { nombre, descripcion, precio } = req.body;

    db.query(
      `
      UPDATE estudios
      SET nombre = ?, descripcion = ?, precio = ?
      WHERE id = ?
      `,
      [nombre, descripcion, precio, id],
      err => {
        if (err) {
          console.error(err);
          return res.send(renderMensaje(
            'Error',
            'No se pudo actualizar el estudio.',
            '/estudios'
          ));
        }

        res.send(renderMensaje(
          'Estudio actualizado',
          'El estudio fue actualizado correctamente.',
          '/estudios'
        ));
      }
    );
  }
);



// ===================== LOGIN =====================
app.post('/login', (req, res) => {
  const { correo, password } = req.body;

  db.query(
    'SELECT * FROM usuarios WHERE correo = ?',
    [correo],
    async (err, results) => {
      if (err) {
        console.error(err);
        return res.redirect('/login.html?error=1');
      }

      if (results.length === 0) {
        return res.redirect('/login.html?error=1');
      }

      const usuario = results[0];
      const ok = await bcrypt.compare(password, usuario.password_hash);

      if (!ok) {
        return res.redirect('/login.html?error=1');
      }

      req.session.usuario = {
        id: usuario.id,
        nombre: usuario.nombre,
        rol: usuario.rol
      };

      res.redirect('/');
    }
  );
});

// ===================== LOGOUT =====================
app.get('/logout', (req, res) => {
  req.session.destroy(() => {
    res.redirect('/login.html');
  });
});

// ===================== HTML MENSAJES =====================
function renderMensaje(titulo, mensaje, volver) {
  return `
<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="UTF-8">
<title>${titulo}</title>
<link rel="stylesheet" href="/css/styles.css">
</head>
<body class="auth-body">
  <div class="auth-container">
    <div class="auth-card">
      <h2>${titulo}</h2>
      <p>${mensaje}</p>
      <a href="${volver}" class="btn btn-primary">Continuar</a>
    </div>
  </div>
</body>
</html>`;
}

// ===================== SERVIDOR =====================
const PORT = 3000;
app.listen(PORT, () => {
  console.log(`Servidor corriendo en http://localhost:${PORT}`);
});
