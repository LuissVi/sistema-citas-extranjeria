import express from 'express';

import {
    obtenerPrimeraDisponibilidad,
    reservarCita,
    consultarCitaPorNie,
    anularCita,
    validarOficina
} from '../citasLogic.js';

const router = express.Router();

//PRIMERA DISPONIBILDAD DE FECHA-OFICINA
// GET /disponibilidad?oficinaId=X → devuelve la primera fecha con huecos
// libres en esa oficina, junto con las horas disponibles de ese día.
// Si no hay huecos en los próximos 60 días, disponibilidad = null.
router.get("/disponibilidad", (req, res) => {
    const id = req.query.oficinaId ?? '';

    if (id === '') {
        return res.status(400).json({
            ok: false,
            codigo: 'OFICINA_ID_REQUERIDO',
            motivo: 'El parámetro "oficinaId" es obligatorio y no puede estar vacío.',
        });
    }
    const idNumber = Number(id);

    //verificamos que es un entero positivo
    if (!Number.isInteger(idNumber) || idNumber <= 0) {
        return res.status(400).json({
            ok: false,
            codigo: 'OFICINA_ID_INVALIDO',
            motivo: 'El parámetro "oficinaId" debe ser un número entero positivo'
        });
    }
    // Verificamos existencia: la disponibilidad depende de la oficina.
    if (!validarOficina(idNumber)) {
        return res.status(404).json({
            ok: false,
            codigo: 'OFICINA_INEXISTENTE',
            motivo: `No existe la oficina con id: ${idNumber}`
        });
    }

    // obtenerPrimeraDisponibilidad() asume oficinaId válida (ya lo hemos
    // comprobado arriba) y devuelve { fecha, horarios } o null si no hay hueco.
    const disponibilidad = obtenerPrimeraDisponibilidad(idNumber);
    return res.json({
        ok: true,
        disponibilidad
    });
})


//ENDPOINT RESERVAR CITAS

//funcion auxiliar para codigo status
function statusHttpCode(codigo) {
    const mapa = {
        OFICINA_INEXISTENTE: 404,
        TRAMITE_INEXISTENTE: 404,
        TRAMITE_INCORRECTO: 400,
        FECHA_PASADA: 400,
        DIA_NO_LABORABLE: 400,
        HORA_NO_EXISTE: 400,
        SLOT_OCUPADO: 409,
        YA_TIENE_CITA: 409,
    };
    return mapa[codigo] ?? 500;
}
router.post("/reservar", (req, res) => {

    const camposRequeridos = [
        "oficinaId",
        "tramiteId",
        "fecha",
        "hora",
        "nie",
        "nombre",
        "pais"
    ];
    //validamos si los campos son vacios o nuull
    for (const campo of camposRequeridos) {
        const valor = req.body[campo];
        if (valor === null || valor === undefined || valor === '') {
            return res.status(400).json({
                ok: false,
                codigo: 'CAMPO_VACIO',
                motivo: `El campo "${campo}" no puede estar vacío`
            })
        }
    }
    const fecha = req.body.fecha.trim();
    const hora = req.body.hora.trim();
    const nie = req.body.nie.trim();
    const nombre = req.body.nombre.trim();
    const pais = req.body.pais.trim();


    //validamos si los campos numericos son 'numeros' enteros positivos
    const idOfiNum = Number(req.body.oficinaId);
    if (!Number.isInteger(idOfiNum) || idOfiNum <= 0) {
        return res.status(400).json({
            ok: false,
            codigo: 'OFICINA_ID_INVALIDO',
            motivo: 'El parámetro "oficinaId" debe ser un número entero positivo'
        })
    }

    const idTramNum = Number(req.body.tramiteId);
    if (!Number.isInteger(idTramNum) || idTramNum <= 0) {
        return res.status(400).json({
            ok: false,
            codigo: 'TRAMITE_ID_INVALIDO',
            motivo: 'El parámetro "tramiteId" debe ser un número entero positivo'
        })
    }

    //validar fecha string correcto
    // Validación de formato (YYYY-MM-DD). NO validamos que los valores sean
    // reales (ej: 2026-13-45 tiene formato válido pero es imposible, no existe).
    // En la práctica, reservarCita fallará o devolverá resultados extraños
    // para esos casos. Si en el futuro lo necesitamos, usar zod o date-fns.
    const regexFecha = /^\d{4}-\d{2}-\d{2}$/;
    if (!regexFecha.test(fecha)) {
        return res.status(400).json({
            ok: false,
            codigo: 'FECHA_FORMATO_INVALIDO',
            motivo: 'La fecha debe tener formato YYYY-MM-DD (ej: 2026-10-15).',
        });
    }

    //validar hora
    const regexHora = /^\d{2}:\d{2}$/;
    if (!regexHora.test(hora)) {
        return res.status(400).json({
            ok: false,
            codigo: 'HORA_FORMATO_INVALIDO',
            motivo: 'La hora debe tener formato HH:MM (ej: 09:30).',
        });
    }

    //verificamos el nro Nie
    const regexNie = /^[XYZ]\d{7}[A-Z]$/;
    if (!regexNie.test(nie)) {
        return res.status(400).json({
            ok: false,
            codigo: 'NIE_FORMATO_INVALIDO',
            motivo: 'El NIE debe tener formato X1234567A',
        });
    }

    //llamamos a reservar cita(guardamos la cita)
    const cita = reservarCita(idOfiNum, idTramNum, fecha, hora, { nie, nombre, pais });

    if (!cita.ok) {
        return res.status(statusHttpCode(cita.codigo)).json(cita);
    }

    return res.status(201).json(cita);

})

//ENDPOINT CONSULTAR CITAS
// GET /consultar?nie=X → devuelve la cita activa del usuario con ese NIE.
//
// Decisión de diseño: devolvemos 404 si el NIE no tiene cita, porque el NIE
// identifica a un usuario concreto (mismo criterio que /tramites con ID).
// Validamos formato mínimo (X/Y/Z + 7 dígitos + letra). NO validamos la letra
// de control (requiere algoritmo módulo 23; no aporta valor para el caso).
router.get("/consultar", (req, res) => {
    const nie = req.query.nie ?? '';
    if (nie === '') {
        return res.status(400).json({
            ok: false,
            codigo: 'NIE_REQUERIDO',
            motivo: 'El parámetro "nie" es obligatorio.',
        });
    }

    const regexNie = /^[XYZ]\d{7}[A-Z]$/;

    if (!regexNie.test(nie.trim())) {
        return res.status(400).json({
            ok: false,
            codigo: 'NIE_FORMATO_INVALIDO',
            motivo: 'El NIE debe tener formato X1234567A',
        });
    }

    const cita = consultarCitaPorNie(nie);
    if (!cita) {
        return res.status(404).json({
            ok: false,
            codigo: 'CITA_INEXISTENTE',
            motivo: 'El usuario no tiene ninguna cita activa.'
        })
    }

    return res.json({
        ok: true,
        cita
    });

})

//ENDPOINT ANULAR CITA
//
// Nota de seguridad (simplificación consciente):
// Es idempotente: si la cita no existe, devuelve 200 igual.
// Esto respeta la convención HTTP: DELETE no debe fallar si el recurso
// ya no existe (el resultado deseado se cumple igual).
// este endpoint NO verifica
// que quien anula sea el dueño de la cita. En un sistema real habría
// autenticación (login) y autorización (verificar usuario_id). Aquí lo
// omitimos porque el alcance es el flujo básico de citas. El NIE no es
// un mecanismo de autenticación: es solo un identificador público.
// TODO (Fase 2): añadir autenticación de usuario.
//
// El backend NO asume nada sobre el flujo del cliente. Solo garantiza
// que tras la llamada no exista ninguna cita con ese ID. El cliente
// obtiene el citaId como quiera. En el frontend actual:
//   1. Usuario pulsa "anular cita" en el menú.
//   2. Se pide el NIE (o se muestra ya relleno).
//   3. Frontend llama a GET /consultar?nie=X → obtiene cita.id.
//   4. Usuario confirma los datos.
//   5. Frontend llama a DELETE /anular/:citaId.

router.delete("/anular/:citaId", (req, res) => {
    const citaId = Number(req.params.citaId);
    if (!Number.isInteger(citaId) || citaId <= 0) {
        return res.status(400).json({
            ok: false,
            codigo: 'CITA_ID_INVALIDO',
            motivo: 'El parámetro "citaId" debe ser un número entero positivo'
        });
    }

    const resultado = anularCita(citaId);
    return res.json(resultado);
})

export default router;
