import db from "./db.js";
//oficinas que contendrá la tabla 'oficinas'

//1. limpiar tablas
db.exec('DELETE FROM citas; DELETE FROM tramites; DELETE FROM oficinas; DELETE FROM usuarios');

//2.reseteamos en secuencia
db.exec("DELETE FROM sqlite_sequence WHERE name IN ('usuarios', 'oficinas', 'tramites', 'citas');");

//array de oficinas
const oficinas = [
  ['Madrid', 'CNP POLICIA ALUCHE', 'Avda. de los Poblados S/N'],
  ['Madrid', 'GARCÍA DE PAREDES', 'Calle García de Paredes 65'],
  ['Madrid', 'LEGANÉS', 'Calle San Nicasio 31'],
  ['Madrid', 'ALCALÁ DE HENARES', 'Avda. de Meco S/N'],
  ['Barcelona', 'RAMBLA GUIPÚZCOA', 'Rambla de Guipúzcoa 74'],
  ['Barcelona', 'MALLORCA', 'Calle Mallorca 213'],
  ['Barcelona', 'BADALONA', 'Avinguda dels Vents 9'],
  ['Barcelona', 'L\'HOSPITALET DE LLOBREGAT', 'Carrer del Curs S/N'],
  ['Sevilla', 'PLAZA DE ESPAÑA', 'Plaza de España (Torre Norte)'],
  ['Sevilla', 'SAN JUAN DE AZNALFARACHE', 'Calle Cardenal Segura 20'],
  ['Sevilla', 'DOS HERMANAS', 'Calle Luis Ortega Bru 14'],
  ['Sevilla', 'ALCALÁ DE GUADAÍRA', 'Calle Pepe Luces 1'],
  ['Granada', 'SAN AGUSTÍN', 'Calle San Agapito 2'],
  ['Granada', 'MOTRIL', 'Calle San Pellegrino 4'],
  ['Granada', 'BAZA', 'Calle Alhóndiga 5'],
  ['Granada', 'LOJA', 'Calle Antequera 17']
];

//3. insercion de oficinas en la tabla 'oficinas'
const insert = db.prepare('INSERT INTO oficinas(provincia, nombre, direccion) VALUES (?, ?, ?)');
const insertarTodas = db.transaction(() => {
  for (const ofi of oficinas) {//ejem: en la primera vuelta ofi =['Madrid', 'CNP POLICIA ALUCHE', 'Avda. de los Poblados S/N'], luego inserta su valor de acuerdo a su indice
    insert.run(ofi[0], ofi[1], ofi[2]);
  }
});
insertarTodas();

//4. recuperar ids de oficinas
const oficinasDb = db.prepare('SELECT id, nombre FROM oficinas').all();
console.log(oficinasDb);

//probamos a ver los ids y nombres de la tabla 'oficinas'
for (const el of oficinasDb) {
  // console.log('id: '+el.id+ ' ;'+' nombre: '+el.nombre);
}

//5. INSERTAMOS DATOS EN LA TABLA 'tramites'

//objeto con los tramites por oficina
const tramitesPorOficina = {
  // Madrid
  'CNP POLICIA ALUCHE': ['TIE inicial', 'Renovación TIE', 'NIE', 'Reagrupación familiar'],
  'GARCÍA DE PAREDES': ['TIE inicial', 'Renovación TIE', 'NIE'],
  'LEGANÉS': ['Renovación TIE', 'NIE', 'Certificado de residencia'],
  'ALCALÁ DE HENARES': ['TIE inicial', 'NIE', 'Asilo'],

  // Barcelona
  'RAMBLA GUIPÚZCOA': ['TIE inicial', 'Renovación TIE', 'NIE', 'Asilo'],
  'MALLORCA': ['Renovación TIE', 'NIE', 'Reagrupación familiar'],
  'BADALONA': ['TIE inicial', 'NIE', 'Certificado de residencia'],
  "L'HOSPITALET DE LLOBREGAT": ['TIE inicial', 'Renovación TIE', 'Asilo'],

  // Sevilla
  'PLAZA DE ESPAÑA': ['TIE inicial', 'Renovación TIE', 'NIE', 'Reagrupación familiar'],
  'SAN JUAN DE AZNALFARACHE': ['Renovación TIE', 'NIE'],
  'DOS HERMANAS': ['TIE inicial', 'NIE', 'Certificado de residencia'],
  'ALCALÁ DE GUADAÍRA': ['Renovación TIE', 'NIE', 'Asilo'],

  // Granada
  'SAN AGUSTÍN': ['TIE inicial', 'Renovación TIE', 'NIE'],
  'MOTRIL': ['Renovación TIE', 'NIE', 'Certificado de residencia'],
  'BAZA': ['TIE inicial', 'NIE'],
  'LOJA': ['Renovación TIE', 'NIE', 'Reagrupación familiar']
};

//preparamos la insercion
const insertTramite = db.prepare('INSERT INTO tramites (oficina_id,nombre)VALUES(?,?)');

const insertar = () => {
  for (const ofi of oficinasDb) {
    const tramites = tramitesPorOficina[ofi.nombre];
    for (const t of tramites) {
      insertTramite.run(ofi.id, t);
    }
  }
}

db.transaction(insertar)();


//6. INSERCION USUARIOS DE PRUEBA
const usuarios = [
  { doc_tipo: "NIE", doc_numero: "X1234567A", nombre_apellidos: "Luis Vargas Marin", pais_nacionalidad: "Colombiano" },
  { doc_tipo: "NIE", doc_numero: "Y1234567B", nombre_apellidos: "Carlos Ruiz Lopez", pais_nacionalidad: "Chileno" },
  { doc_tipo: "NIE", doc_numero: "Z1234567C", nombre_apellidos: "Koki Saenz Chavez", pais_nacionalidad: "Cubano" }
];


const insertUsuarios = db.prepare("INSERT INTO usuarios(doc_tipo,doc_numero,nombre_apellidos,pais_nacionalidad)values(?,?,?,?)");

db.transaction(() => {
  for (const us of usuarios) {
    insertUsuarios.run(us.doc_tipo, us.doc_numero, us.nombre_apellidos, us.pais_nacionalidad);
  }
})();
//consultamos para verificar los campos de la tabla 'usuarios'
const usInsertados = db.prepare("SELECT * FROM usuarios").all();
console.log(usInsertados.length);
console.log(usInsertados);

//7. SELECT USUARIOS + OFICINAS + TRAMITES → RECUPERAR IDs(para insertar cita)
//seleccionamos el usuario para la cita
const usuarioPrueba = db.prepare('SELECT id FROM usuarios WHERE doc_numero=?').get('X1234567A');

const oficinaPrueba = db.prepare('SELECT id FROM oficinas WHERE nombre=?').get('CNP POLICIA ALUCHE');

const tramitePrueba = db.prepare('SELECT id FROM tramites WHERE oficina_id=? AND nombre=?').get(oficinaPrueba.id, 'TIE inicial');
//comprobacion
console.log(
  { id_usuario: usuarioPrueba.id },
  { id_oficina: oficinaPrueba.id },
  { id_tramite: tramitePrueba.id }
)

//8. INSERTAR CITAS DE PRUEBA TABLA 'citas'

//insertando 1 usuario
const insertCita = db.prepare('INSERT INTO citas(usuario_id,oficina_id,tramite_id,fecha_hora)VALUES(?,?,?,?)');

db.transaction(()=>{
  insertCita.run(usuarioPrueba.id,oficinaPrueba.id,tramitePrueba.id,'2026-09-21 09:30');
})();

//insertando 2 usuarios
const citasPrueba=[
  {nie:'Y1234567B',oficina:'ALCALÁ DE HENARES',tramite:'Asilo',fecha_hora:'2026-09-22 10:00'},
  {nie:'Z1234567C',oficina:'LEGANÉS',tramite:'Certificado de residencia',fecha_hora:'2026-09-23 11:30'}
];

db.transaction(()=>{
  for (const us of citasPrueba) {
    const usuario=db.prepare('SELECT id FROM usuarios WHERE doc_numero=?').get(us.nie);
    const oficina=db.prepare('SELECT id FROM oficinas WHERE nombre=?').get(us.oficina);
    const tramite=db.prepare('SELECT id FROM tramites WHERE oficina_id=? AND nombre=?').get(oficina.id,us.tramite);
    const fecha_hora=us.fecha_hora;
    insertCita.run(usuario.id,oficina.id,tramite.id,fecha_hora);
  }
})();
//comprobacion de filas de 'citas'
const rowCitas=db.prepare('SELECT * FROM citas').all();
console.table(rowCitas);//muestra en forma de tabla