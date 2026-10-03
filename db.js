import Database from "better-sqlite3";
const db = new Database('sqlite.db');

//Activar validación de claves foráneas (desactivada por defecto en SQLite)
db.pragma('foreign_keys = ON');

// ===== CREACIÓN DE TABLAS =====
//usuarios
db.exec(`
  CREATE TABLE IF NOT EXISTS usuarios (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    doc_tipo TEXT DEFAULT 'NIE',
    doc_numero TEXT NOT NULL UNIQUE,
    nombre_apellidos TEXT NOT NULL,
    pais_nacionalidad TEXT NOT NULL
  );
`);

//oficinas
db.exec(`
  CREATE TABLE IF NOT EXISTS oficinas (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    provincia TEXT NOT NULL,
    nombre TEXT NOT NULL,
    direccion TEXT NOT NULL
  );
`);

//tramites
//si se desea eliminar una oficina seria imposible si no ponemos la clausula ON DELETE CASCADE; Esto se debe a que la FK protege la integridad: no puedes dejar trámites huérfanos ON DELETE CASCADE significa: "Si borran el padre, borra también los hijos automáticamente."
//Sin esa cláusula: SQLite bloquea el borrado 
//Con esa cláusula: SQLite borra en cascada .
db.exec(`
  CREATE TABLE IF NOT EXISTS tramites (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    oficina_id INTEGER NOT NULL,
    nombre TEXT NOT NULL,
    FOREIGN KEY(oficina_id) REFERENCES oficinas(id) ON DELETE CASCADE,
    UNIQUE(oficina_id,nombre)
  );
`);


// ===== TABLA: citas (solo reservas activas) =====
// - usuario_id UNIQUE → garantiza "1 cita por usuario"
// - UNIQUE(oficina_id, fecha_hora) → garantiza "1 slot = 1 reserva" en una determinada hora suponiendo para una sola ventanilla de atención
db.exec(`
  CREATE TABLE IF NOT EXISTS citas (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    usuario_id INTEGER NOT NULL,
    oficina_id INTEGER NOT NULL,
    tramite_id INTEGER NOT NULL,
    fecha_hora TEXT NOT NULL,
    FOREIGN KEY(usuario_id) REFERENCES usuarios(id),
    FOREIGN KEY(oficina_id) REFERENCES oficinas(id),
    FOREIGN KEY(tramite_id) REFERENCES tramites(id),
    UNIQUE(oficina_id, fecha_hora)
  );
`);


export default db;