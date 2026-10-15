import express from "express";

import { limpiarCitasPasadas } from "./citasLogic.js";
import catalogoRouter from './routes/catalogo.js';
import reservasRouter from "./routes/reservas.js";


const app = express();
//detalle de seguridad ocultamos tecnologia(express)
app.disable('x-powered-by');
app.use(express.json());

//limpieza al arrancar
try {
    // limpiarCitasPasadas() no tiene try/catch interno: si falla, lanza
    // una excepción y la captura el catch de abajo. Si llegamos a la línea
    // siguiente, es porque fue bien. No hace falta comprobar .ok.
    const limpieza = limpiarCitasPasadas();
    console.log(`Limpieza inicial: ${limpieza.filasEliminadas} citas eliminadas`);
} catch (err) {
    console.error('Fallo en la limpieza inicial.');
    //informa al SO que el proceso termino con código 1
    // (terminacion anormal); se detiene el proceso de node.js de inmediato
    process.exit(1);
}

//salud del servidor
app.get("/ping", (req, res) => {
    res.json({ ok: true });
});

//routers
app.use('/', catalogoRouter);
app.use('/', reservasRouter);

// Middleware de errores: captura excepciones no controladas de las rutas.
// Express lo identifica por tener 4 parámetros (err, req, res, next).
// Va al final, después de todas las rutas: solo se ejecuta si una ruta
// lanza una excepción.
//
// Al cliente: mensaje genérico (no expone info interna).
// A los logs: el error completo para depurar.
//
//req.method => indica el metodo de la solcititud http(GET,POST...)
//req.originalUrl => la url perteneciente al error
app.use((err, req, res, next) => {
    console.error(`❌ Error en ${req.method} ${req.originalUrl}:`);
    console.error(err);

    return res.status(500).json({
        ok: false,
        codigo: 'ERROR_INTERNO',
        motivo: 'Ha ocurrido un error inesperado en el servidor.',
    });
});

// objeto con variables de entorno del sistema
const PORT = process.env.PORT ?? 3000;
app.listen(PORT, () => {
    console.log(`Servidor iniciado en http://localhost:${PORT}`);
});














