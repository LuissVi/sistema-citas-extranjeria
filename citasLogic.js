import db from "./db.js";

// Horarios de atención (regla del sistema)
const HORARIOS = [
    '09:00', '09:30', '10:00', '10:30', '11:00', '11:30',
    '12:00', '12:30', '13:00', '13:30', '14:00',
    '16:00', '16:30', '17:00', '17:30', '18:00'
];

//1. SELECCIONAMOS PROVINCIAS; usamos DISTINCT para no repetir

export function obtenerProvincias() {
    const filas = db.prepare('SELECT DISTINCT provincia FROM oficinas ORDER BY provincia ASC').all();
    return filas.map(f => f.provincia);
}


//2. OBTENER OFICINAS POR PROVINCIA
//asumimos que oficinaId existe; el llamador debe validar antes
export function obtenerOficinasPorProvincia(provincia) {
    const filas = db.prepare('SELECT id, nombre, direccion FROM oficinas WHERE provincia=? ORDER BY nombre ASC').all(provincia);
    return filas;
}

//funcion para validar la oficina
export function validarOficina(id) {
    const oficina = db.prepare('SELECT id FROM oficinas WHERE id=?').get(id);
    return oficina;
}

//3. OBTENER TRAMITES
export function obtenerTramitesPorOficina(oficinaId) {
    const filas = db.prepare('SELECT id, nombre FROM tramites WHERE oficina_id = ? ORDER BY nombre').all(oficinaId);
    return filas;
}


//4. OBTENER HORARIOS
export function obtenerHorariosDisponibles(oficinaId, fecha) {

    const horariosReservados = db.prepare('SELECT fecha_hora FROM citas WHERE oficina_id=? AND fecha_hora LIKE ?').all(oficinaId, `${fecha} %`);
    const ocupados = horariosReservados.map(fila => fila.fecha_hora.split(" ")[1]);
    return HORARIOS.filter(h => !ocupados.includes(h));
}

//OBTENER DISPONIBILIDAD DE FECHA
//preparamos el formato (tipo la DB)
const formatearFecha = (date) => {
    const anio = date.getFullYear();
    const mes = String(date.getMonth() + 1).padStart(2, '0');
    const dia = String(date.getDate()).padStart(2, '0');
    return `${anio}-${mes}-${dia}`;
};
//obteniendo fecha dia siguiente
const fechaDeManiana = () => {
    const fecha = new Date();
    fecha.setDate(fecha.getDate() + 1);//fecha de mañana
    return formatearFecha(fecha);
}

//evitar sabado y domingo
export const esDiaLaborable = (fecha) => {
    const fechaDate = new Date(fecha);
    if (fechaDate.getDay() === 0 || fechaDate.getDay() === 6) return false;
    // TODO Fase 2: if (esFestivo(fecha)) return false;
    return true;
}

//parametro fechaInicio; util si se desea hacer cambios futuros como seleccion de fechas
//asumimos que oficinaId existe; el llamador debe validar antes
export function obtenerPrimeraDisponibilidad(oficinaId, fechaInicio) {
    //antes de nada comprobamos si la oficina existe
    // const oficina = db.prepare('SELECT id FROM oficinas WHERE id=?').get(oficinaId);
    // if (!oficina) return { ok: false, codigo: 'OFICINA_INEXISTENTE', motivo: 'No se encontró la oficina' };

    if (!fechaInicio) {
        fechaInicio = fechaDeManiana();
    }
    for (let i = 0; i < 61; i++) {
        const fecha = new Date(fechaInicio);
        fecha.setDate(fecha.getDate() + i);

        if (!esDiaLaborable(fecha)) continue;

        const fechaStr = formatearFecha(fecha);
        const horarios = obtenerHorariosDisponibles(oficinaId, fechaStr);
        if (horarios.length > 0) {
            return { fecha: fechaStr, horarios };
        }
    }
    return null;
}

//CONSULTA DE CITA Y RESERVA DE CITAS
export function consultarCitaPorNie(nie) {
    const citaUsuario = db.prepare(`SELECT 
        citas.id, 
        citas.fecha_hora, 
        usuarios.nombre_apellidos, 
        tramites.nombre AS tramite, 
        oficinas.nombre AS oficina, 
        oficinas.direccion FROM citas 
        JOIN usuarios ON citas.usuario_id = usuarios.id 
        JOIN tramites ON citas.tramite_id = tramites.id 
        JOIN oficinas ON citas.oficina_id = oficinas.id 
        WHERE usuarios.doc_numero = ?`).get(nie);
    return citaUsuario ?? null;
}

//funcion para validar fecha
export function esFechaFutura(fecha) {
    const fechaActual = new Date();
    fechaActual.setHours(0, 0, 0, 0);
    const fechaStr = formatearFecha(fechaActual);
    if (fecha <= fechaStr) {
        return false;
    }
    return true;
}
//funcion para validar horario de atencion
export function horaValida(hora) {
    const horaValida = HORARIOS.some(h => h === hora);
    if (!horaValida) return false;
    return true;
}

export function reservarCita(oficinaId, tramiteId, fecha, hora, { nie, nombre, pais }) {

    //validar si oficina existe en la DB
    const oficina = validarOficina(oficinaId);
    if (!oficina) return { ok: false, codigo: 'OFICINA_INEXISTENTE', motivo: 'No se encontró la oficina' };


    //comprobar si existe tramite
    const tramite = db.prepare('SELECT id, oficina_id FROM tramites WHERE id=?').get(tramiteId);
    if (!tramite) return { ok: false, codigo: 'TRAMITE_INEXISTENTE', motivo: 'No se encontró el tramite' };

    //comprobar si tramite pertenece a la oficina(oficina_id es el campo de oficina en la tabla 'tramites')
    if (tramite.oficina_id !== oficinaId) return { ok: false, codigo: 'TRAMITE_INCORRECTO', motivo: 'El tramite es incorrecto' };

    //comprobar fecha no es pasada
    if (!esFechaFutura(fecha)) return { ok: false, codigo: 'FECHA_PASADA', motivo: 'No se puede reservar en fecha pasada' };


    //comprobar que sea dia laborable(por ahora solo evitamos sabado y domingo)
    if (!esDiaLaborable(fecha)) return { ok: false, codigo: 'DIA_NO_LABORABLE', motivo: 'La atención es de lunes a viernes' };

    //comprobar que la hora sea válida
    if (!horaValida(hora)) return { ok: false, codigo: 'HORA_NO_EXISTE', motivo: 'Horario fuera de atención' };

    //transaccion
    const reservar = db.transaction(() => {
        //comprobar si el hueco esta libre
        const slotOcupado = db.prepare('SELECT id FROM citas WHERE oficina_id = ? AND fecha_hora = ?').get(oficinaId, `${fecha} ${hora}`);
        //  Si no esta libre lanzar excepcion
        if (slotOcupado) {
            throw new Error('SLOT_OCUPADO');
        }

        //Buscar usuario
        const usuarioExistente = db.prepare('SELECT id FROM usuarios WHERE doc_numero = ?').get(nie);
        let usuarioId;
        //  Si existe y tiene cita → lanzar excepción         
        if (usuarioExistente) {
            const citaExistente = db.prepare('SELECT id FROM citas WHERE usuario_id = ?').get(usuarioExistente.id)

            if (citaExistente) {
                throw new Error('YA_TIENE_CITA');
            }
            usuarioId = usuarioExistente.id;
            // Si no existe → INSERT usuarios
        } else {
            const newUser = db.prepare('INSERT INTO usuarios (doc_numero, nombre_apellidos, pais_nacionalidad) VALUES(?, ?, ?)').run(nie, nombre, pais);
            usuarioId = newUser.lastInsertRowid;
        }

        // INSERT cita
        const citaUsuarioId = db.prepare('INSERT INTO citas (usuario_id, oficina_id, tramite_id, fecha_hora)VALUES(?, ?, ?, ?)').run(usuarioId, oficinaId, tramiteId, `${fecha} ${hora}`);
        return citaUsuarioId.lastInsertRowid;
    })

    try {
        const citaId = reservar();
        return { ok: true, citaId };
    } catch (err) {
        
        if (err.message === 'SLOT_OCUPADO') return { ok: false, codigo: 'SLOT_OCUPADO', motivo: 'La fecha no está disponible.' };

        if (err.message === 'YA_TIENE_CITA') return { ok: false, codigo: 'YA_TIENE_CITA', motivo: 'Ya tienes una cita activa.' };

        if (err.code === 'SQLITE_CONSTRAINT_UNIQUE') {
            // Red de seguridad: por si hay una carrera que el SELECT no detectó
            if (err.message.includes('citas.oficina_id')) {
                return { ok: false, codigo: 'SLOT_OCUPADO', motivo: 'La reserva fué ocupada' };
            }
            if (err.message.includes('citas.usuario_id')) {
                return { ok: false, codigo: 'YA_TIENE_CITA', motivo: 'Ya tiene cita registrada a sus datos' };
            }
        }

        // TODO (Fase 2): cubrir 'usuarios.doc_numero' duplicado en race
        // condition (dos peticiones simultáneas con NIE nuevo). Es un caso
        // extremadamente raro: solo ocurre cuando el usuario no existe y
        // dos peticiones lo crean a la vez. Hoy se relanza como 500.

        throw err; //relanza error desconocido
    }
}

//ANULAR CITA
export function anularCita(citaId) {
    db.prepare('DELETE FROM citas WHERE id = ?').run(citaId);
    return { ok: true };
}

//ANULAR CITAS VENCIDAS
export function limpiarCitasPasadas() {
    const fechaString = formatearFecha(new Date());
    const fechaHoraString = `${fechaString} 00:00`;

    const citasEliminadas = db.prepare('DELETE FROM citas WHERE fecha_hora < ?').run(fechaHoraString);
    return { ok: true, filasEliminadas: citasEliminadas.changes };
}





