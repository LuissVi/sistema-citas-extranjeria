import express from "express";

import { 
    obtenerProvincias,
    obtenerOficinasPorProvincia,
    validarOficina,
    obtenerTramitesPorOficina
 } from "../citasLogic.js";


const router=express.Router();

// GET /provincias → devuelve la lista de provincias con oficinas registradas.
// obtenerProvincias() siempre devuelve un array (nunca null/undefined).
// Si la DB falla, lanza excepción y Express responde 500 automáticamente
// (TODO bloque 6: middleware de errores para devolver JSON en vez de HTML).
router.get("/provincias", (req, res) => {
    
    const provincias = obtenerProvincias();
    return res.json({ ok: true, provincias });
})

//MOSTRAR OFICINAS POR PROVINCIA

// Aceptamos variantes de mayúsculas/minúsculas ("Madrid", "MADRID", "madrid")
// buscando coincidencia contra la lista real de provincias. Si no hay match,
// devolvemos 200 con [] (consulta válida, cero resultados), no 404.
// Normalización: comparamos el valor recibido contra la lista real de
// provincias ignorando mayúsculas/minúsculas
router.get("/oficinas", (req, res) => {
    const provincia = ((req.query.provincia ?? '').trim());
    if (provincia === '') {
        return res.status(400).json({
            ok: false,
            codigo: 'PROVINCIA_REQUERIDA',
            motivo: 'El parámetro "provincia" es obligatorio y no puede estar vacío.',
        });
    }
    const provinciasExistentes = obtenerProvincias();
    const provinciaVerificada = provinciasExistentes.find(p => p.toLowerCase() === provincia.toLowerCase())
    if (!provinciaVerificada) {
        return res.json({ ok: true, oficinas: [] });
    }
    const oficinas = obtenerOficinasPorProvincia(provinciaVerificada);
    return res.json({
        ok: true,
        oficinas
    });
})


// GET /tramites?oficinaId=X → devuelve los trámites ofrecidos por esa oficina.
router.get("/tramites", (req, res) => {
    const idOficina = (req.query.oficinaId ?? '').trim();
    if (idOficina === '') {
        return res.status(400).json({
            ok: false,
            codigo: 'OFICINA_ID_REQUERIDO',
            motivo: 'El parámetro "oficinaId" es obligatorio y no puede estar vacío.',
        });
    }

    const idNum = Number(idOficina);
    //verificamos si no es un numero
    if (!Number.isInteger(idNum) || idNum <= 0) {
        return res.status(400).json({
            ok: false,
            codigo: 'OFICINA_ID_INVALIDO',
            motivo: 'El parámetro "oficinaId" debe ser un número entero positivo'
        });
    }
    // Verificamos existencia de la oficina. Filtrar por ID identifica un recurso
    // concreto, por eso 404 si no existe (a diferencia de /oficinas, donde el
    // filtro por provincia es una consulta abierta y devolvemos 200 con []).
    if (!validarOficina(idNum)) {
        return res.status(404).json({
            ok: false,
            codigo: 'OFICINA_INEXISTENTE',
            motivo: `No existe la oficina con id: ${idNum} `
        });
    }

    //si existe devolvemos el array
    const tramites = obtenerTramitesPorOficina(idNum);
    return res.json({
        ok: true,
        tramites
    });
})

export default router;

