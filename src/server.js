'use strict';

/* ============================================================
   CINEPASS — SERVIDOR (Node.js + Express)

   API REST del proyecto (guía, págs. 6-7): GET, POST, PUT y DELETE
   con respuestas JSON y códigos HTTP correctos. La base de datos es
   SQLite mediante la capa src/db.js (módulo integrado node:sqlite).

   Rutas públicas (cliente):
     GET    /api/salud                        estado del servidor y de la base
     GET    /api/peliculas                    catálogo (?destacada=1 filtra)
     GET    /api/peliculas/:id                detalle de una película
     GET    /api/salas                        salas con total de asientos
     GET    /api/funciones                    funciones (?pelicula_id=N filtra)
     GET    /api/funciones/:id                una función
     GET    /api/funciones/:id/asientos       mapa con estados libre/ocupado
     POST   /api/reservaciones                crear reserva (validada en servidor)
     GET    /api/reservaciones?folio=&correo= consulta con verificación de dueño
     POST   /api/reservaciones/cancelar       cancelar un folio (solo su dueño)

   Rutas de administración (requieren sesión iniciada):
     POST   /api/login  ·  POST /api/logout  ·  GET /api/sesion
     POST   /api/peliculas        · PUT /api/peliculas/:id · DELETE /api/peliculas/:id
     POST   /api/funciones        · PUT /api/funciones/:id · DELETE /api/funciones/:id
     GET    /api/reservaciones    (lista completa, sin consulta de dueño)

   REGLAS DE LA GUÍA APLICADAS AQUÍ:
     - pág. 4: el servidor impide dos reservas del mismo asiento para la
       misma función; no basta con bloquear el botón en JavaScript.
     - pág. 5: la consulta de boletos verifica folio + correo del usuario.
     - pág. 6: las acciones administrativas se restringen en el servidor;
       no basta con ocultar el enlace en el menú.
     - pág. 6: eliminar una película con funciones o reservas relacionadas
       respeta la integridad de los datos (se rechaza con 409).
   ============================================================ */

const express = require('express');
const path = require('node:path');
const crypto = require('node:crypto');
const datos = require('./db.js');

const app = express();
// El proyecto usa el 3000 (npm start); se puede cambiar con la variable PORT.
const PORT = Number(process.env.PORT) || 3000;

// Personal autorizado (guía, pág. 6). Valor de demostración; en clase puede
// llegar de un archivo .env (ya excluido de git) sin tocar el código.
const ADMIN = {
    usuario: process.env.CINEPASS_ADMIN_USUARIO || 'admin',
    clave: process.env.CINEPASS_ADMIN_CLAVE || 'cinepass2026'
};

// Listas de validación (coherentes con el catálogo y el filtro de géneros).
const GENEROS = ['Ciencia ficción', 'Misterio', 'Animación', 'Aventura', 'Drama', 'Acción'];
const CLASIFICACIONES = ['A', 'AA', 'B', 'B15', 'B18', 'D'];
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const FECHA_RE = /^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/;
const HORA_RE = /^([01]\d|2[0-3]):[0-5]\d$/;

const sesiones = new Map(); // token -> { usuario }  (suficiente para el proyecto)

app.use(express.json());

// Carpeta de archivos públicos
app.use(express.static(
    path.join(__dirname, "../public")
));

/* ------------------------------------------------- helpers ----- */

function leerCookie(req, nombre) {
    const cabecera = req.headers.cookie || '';
    for (const parte of cabecera.split(';')) {
        const [clave, ...resto] = parte.trim().split('=');
        if (clave === nombre) return decodeURIComponent(resto.join('='));
    }
    return null;
}

function sesionActual(req) {
    const token = leerCookie(req, 'cinepass_sesion');
    return token ? sesiones.get(token) ?? null : null;
}

// Filtro de administración: ni login, ni 401 con mensaje claro, ni JSON
// devuelto al público (rubrica 06 y guía, pág. 6).
function requerirAdmin(req, res, next) {
    if (sesionActual(req)) return next();
    return res.status(401).json({ mensaje: 'Esta acción requiere sesión de administrador.' });
}

function enteroPositivo(valor) {
    const n = Number(valor);
    return Number.isInteger(n) && n > 0 ? n : null;
}

/* ------------------------------------------------- sesión ------ */

app.post('/api/login', (req, res) => {
    const { usuario, clave } = req.body || {};
    if (usuario !== ADMIN.usuario || clave !== ADMIN.clave) {
        return res.status(401).json({ mensaje: 'Usuario o contraseña incorrectos.' });
    }
    const token = crypto.randomUUID();
    sesiones.set(token, { usuario });
    res.setHeader('Set-Cookie', `cinepass_sesion=${token}; Path=/; HttpOnly; SameSite=Lax`);
    return res.status(200).json({ ok: true, usuario });
});

app.post('/api/logout', (req, res) => {
    const token = leerCookie(req, 'cinepass_sesion');
    if (token) sesiones.delete(token);
    res.setHeader('Set-Cookie', 'cinepass_sesion=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0');
    return res.status(200).json({ ok: true });
});

app.get('/api/sesion', (req, res) => {
    const s = sesionActual(req);
    return s ? res.json({ sesion: { usuario: s.usuario } }) : res.status(401).json({ sesion: null });
});

/* ------------------------------------------------- salud ------- */

// Primera ruta de prueba de CinePass (se conserva y se le suma la base de datos)
app.get("/api/salud", (req, res) => {
    res.status(200).json({
        proyecto: "CinePass",
        estado: "Funcionando",
        mensaje: "Servidor conectado correctamente",
        base_datos: datos.resumen()
    });
});

/* ------------------------------------------------- películas --- */

app.get('/api/peliculas', (req, res) => {
    const soloDestacadas = req.query.destacada === '1';
    res.json(datos.listarPeliculas(soloDestacadas));
});

app.get('/api/peliculas/:id', (req, res) => {
    const id = enteroPositivo(req.params.id);
    const pelicula = id ? datos.obtenerPelicula(id) : null;
    return pelicula ? res.json(pelicula) : res.status(404).json({ mensaje: 'Película no encontrada.' });
});

function validarPelicula(cuerpo, esEdicion) {
    const p = cuerpo || {};
    const errores = [];
    const titulo = typeof p.titulo === 'string' ? p.titulo.trim() : '';
    const genero = typeof p.genero === 'string' ? p.genero.trim() : '';
    const clasificacion = typeof p.clasificacion === 'string' ? p.clasificacion.trim().toUpperCase() : '';
    const duracion = enteroPositivo(p.duracion_min);

    if (!titulo) errores.push('El título es obligatorio.');
    if (!GENEROS.includes(genero)) errores.push(`El género debe ser uno de: ${GENEROS.join(', ')}.`);
    if (!duracion) errores.push('La duración en minutos debe ser un número mayor que cero.');
    if (!CLASIFICACIONES.includes(clasificacion)) errores.push(`La clasificación debe ser una de: ${CLASIFICACIONES.join(', ')}.`);
    if (esEdicion && !Number.isInteger(p.destacada ? 1 : 0)) errores.push('El marcador destacada es inválido.');

    if (errores.length > 0) return { errores };
    return {
        valor: {
            titulo, genero, duracion_min: duracion, clasificacion,
            sinopsis: typeof p.sinopsis === 'string' ? p.sinopsis.trim() : '',
            lema: typeof p.lema === 'string' ? p.lema.trim() : '',
            poster: typeof p.poster === 'string' ? p.poster.trim() : 'img/posters/generica.svg',
            destacada: p.destacada ? 1 : 0
        }
    };
}

app.post('/api/peliculas', requerirAdmin, (req, res) => {
    const v = validarPelicula(req.body, false);
    if (v.errores) return res.status(400).json({ mensaje: 'Datos inválidos.', errores: v.errores });
    const creada = datos.crearPelicula(v.valor);
    return res.status(201).json(creada);
});

app.put('/api/peliculas/:id', requerirAdmin, (req, res) => {
    const id = enteroPositivo(req.params.id);
    if (!id || !datos.obtenerPelicula(id)) return res.status(404).json({ mensaje: 'Película no encontrada.' });
    const v = validarPelicula(req.body, true);
    if (v.errores) return res.status(400).json({ mensaje: 'Datos inválidos.', errores: v.errores });
    return res.status(200).json(datos.actualizarPelicula(id, v.valor));
});

app.delete('/api/peliculas/:id', requerirAdmin, (req, res) => {
    const id = enteroPositivo(req.params.id);
    if (!id || !datos.obtenerPelicula(id)) return res.status(404).json({ mensaje: 'Película no encontrada.' });
    const r = datos.eliminarPelicula(id);
    if (r.bloqueo === 'funciones') {
        return res.status(409).json({ mensaje: 'No se puede eliminar: la película tiene funciones programadas.' });
    }
    if (r.bloqueo === 'reservas') {
        return res.status(409).json({ mensaje: 'No se puede eliminar: hay reservas activas relacionadas.' });
    }
    return res.status(204).end();
});

/* ------------------------------------------------- salas/funciones */

app.get('/api/salas', (req, res) => res.json(datos.listarSalas()));

app.get('/api/funciones', (req, res) => {
    if (req.query.pelicula_id != null && req.query.pelicula_id !== '') {
        const pid = enteroPositivo(req.query.pelicula_id);
        if (!pid) return res.status(400).json({ mensaje: 'El parámetro pelicula_id debe ser un número.' });
        return res.json(datos.listarFunciones(pid));
    }
    res.json(datos.listarFunciones());
});

app.get('/api/funciones/:id', (req, res) => {
    const id = enteroPositivo(req.params.id);
    const f = id ? datos.obtenerFuncion(id) : null;
    return f ? res.json(f) : res.status(404).json({ mensaje: 'Función no encontrada.' });
});

app.get('/api/funciones/:id/asientos', (req, res) => {
    const id = enteroPositivo(req.params.id);
    const mapa = id ? datos.asientosDeFuncion(id) : null;
    return mapa ? res.json(mapa) : res.status(404).json({ mensaje: 'Función no encontrada.' });
});

function validarFuncion(cuerpo) {
    const f = cuerpo || {};
    const errores = [];
    const pelicula_id = enteroPositivo(f.pelicula_id);
    const sala_id = enteroPositivo(f.sala_id);
    const precio = enteroPositivo(f.precio);
    const fecha = typeof f.fecha === 'string' ? f.fecha.trim() : '';
    const hora = typeof f.hora === 'string' ? f.hora.trim() : '';

    if (!pelicula_id || !datos.obtenerPelicula(pelicula_id)) errores.push('pelicula_id debe existir en la base de datos.');
    if (!sala_id) errores.push('sala_id debe ser un número mayor que cero.');
    if (!FECHA_RE.test(fecha)) errores.push('La fecha debe tener el formato AAAA-MM-DD.');
    if (!HORA_RE.test(hora)) errores.push('La hora debe tener el formato HH:MM.');
    if (!precio) errores.push('El precio debe ser un número mayor que cero.');

    if (errores.length > 0) return { errores };
    return { valor: { pelicula_id, sala_id, fecha, hora, precio } };
}

app.post('/api/funciones', requerirAdmin, (req, res) => {
    const v = validarFuncion(req.body);
    if (v.errores) return res.status(400).json({ mensaje: 'Datos inválidos.', errores: v.errores });
    return res.status(201).json(datos.crearFuncion(v.valor));
});

app.put('/api/funciones/:id', requerirAdmin, (req, res) => {
    const id = enteroPositivo(req.params.id);
    if (!id || !datos.obtenerFuncion(id)) return res.status(404).json({ mensaje: 'Función no encontrada.' });
    const v = validarFuncion(req.body);
    if (v.errores) return res.status(400).json({ mensaje: 'Datos inválidos.', errores: v.errores });
    return res.status(200).json(datos.actualizarFuncion(id, v.valor));
});

app.delete('/api/funciones/:id', requerirAdmin, (req, res) => {
    const id = enteroPositivo(req.params.id);
    if (!id || !datos.obtenerFuncion(id)) return res.status(404).json({ mensaje: 'Función no encontrada.' });
    const r = datos.eliminarFuncion(id);
    if (r.bloqueo === 'reservas') {
        return res.status(409).json({ mensaje: 'No se puede eliminar: la función tiene reservas activas.' });
    }
    return res.status(204).end();
});

/* ------------------------------------------------- reservaciones */

// Crear reserva: validación completa en el servidor (nombre, correo,
// asientos reales de la sala de esa función) y control de conflictos.
app.post('/api/reservaciones', (req, res) => {
    const cuerpo = req.body || {};
    const errores = [];

    const funcionId = enteroPositivo(cuerpo.funcion_id);
    const nombre = typeof cuerpo.nombre === 'string' ? cuerpo.nombre.trim() : '';
    const correo = typeof cuerpo.correo === 'string' ? cuerpo.correo.trim() : '';
    const asientoIds = Array.isArray(cuerpo.asiento_ids) ? [...new Set(cuerpo.asiento_ids.map(Number))] : [];

    if (!funcionId) errores.push('funcion_id es obligatorio y debe ser un número.');
    if (nombre.length < 3) errores.push('El nombre debe tener al menos 3 caracteres.');
    if (!EMAIL_RE.test(correo)) errores.push('El correo no tiene un formato válido.');
    if (asientoIds.length === 0 || asientoIds.some(n => !Number.isInteger(n) || n <= 0)) {
        errores.push('Selecciona al menos un asiento válido (asiento_ids).');
    }
    if (errores.length > 0) return res.status(400).json({ mensaje: 'Datos inválidos.', errores });
    if (!datos.obtenerFuncion(funcionId)) return res.status(404).json({ mensaje: 'Función no encontrada.' });

    const r = datos.crearReservacion({ funcionId, asientoIds, nombre, correo });
    if (r.error === 'funcion') return res.status(404).json({ mensaje: 'Función no encontrada.' });
    if (r.error === 'asiento') return res.status(400).json({ mensaje: `El asiento ${r.idAsiento} no pertenece a la sala de esta función.`, errores: [] });
    if (r.error === 'sin_asientos') return res.status(400).json({ mensaje: 'Selecciona al menos un asiento.', errores: [] });
    if (r.conflicto) {
        // REGLA CRÍTICA de la guía, pág. 4: el servidor impide la doble reserva.
        return res.status(409).json({
            mensaje: 'Hay asientos que ya están reservados para esa función.',
            asientos_en_conflicto: r.conflicto
        });
    }
    return res.status(201).json({ ...r, cliente_nombre: nombre, cliente_correo: correo });
});

app.get('/api/reservaciones', (req, res) => {
    const folio = typeof req.query.folio === 'string' ? req.query.folio.trim() : '';
    const correo = typeof req.query.correo === 'string' ? req.query.correo.trim() : '';

    if (!folio && !correo) {
        // Sin folio ni correo: lista completa, solo para administrador.
        return requerirAdmin(req, res, () => res.json(datos.listarReservaciones()));
    }
    // Nota de la guía, pág. 5: verificar datos del usuario; no basta el folio.
    if (!folio || !correo) {
        return res.status(400).json({
            mensaje: 'Para consultar un boleto se requieren el folio Y el correo con el que se registró.',
            errores: []
        });
    }
    const reserva = datos.buscarReservacion({ folio, correo });
    if (!reserva) return res.status(404).json({ mensaje: 'No se encontró una reservación con ese folio y correo.' });
    return res.json(reserva);
});

// Cancelar cuando las reglas lo permitan: estado activa y dueño verificado.
app.post('/api/reservaciones/cancelar', (req, res) => {
    const cuerpo = req.body || {};
    const folio = typeof cuerpo.folio === 'string' ? cuerpo.folio.trim() : '';
    const correo = typeof cuerpo.correo === 'string' ? cuerpo.correo.trim() : '';
    if (!folio || !correo) {
        return res.status(400).json({ mensaje: 'Se requieren el folio y el correo del registro.', errores: [] });
    }
    const r = datos.cancelarReservacion({ folio, correo });
    if (r.cambiados === 0) {
        const existe = datos.buscarReservacion({ folio, correo });
        if (!existe) return res.status(404).json({ mensaje: 'No se encontró una reservación con ese folio y correo.' });
        return res.status(409).json({ mensaje: 'Esa reservación ya estaba cancelada.' });
    }
    return res.status(200).json({ ok: true, cancelados: r.cambiados, folio });
});

/* ------------------------------------------------- arrancar ---- */

if (require.main === module) {
    // Iniciar servidor
    app.listen(PORT, () => {
        console.log(
            `CinePass funcionando en http://localhost:${PORT}`
        );
    });
}

module.exports = app;
