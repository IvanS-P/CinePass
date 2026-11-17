'use strict';

/* ============================================================
   CINEPASS — CAPA DE DATOS (SQLite, según la guía del equipo, pág. 7)

   Usa el módulo node:sqlite integrado en Node.js (24+), así el
   proyecto no necesita paquetes adicionales. La base se guarda en
   la carpeta data/ (excluida de git en .gitignore).

   Entidades y reglas esenciales (guía, pág. 7):
   - película -> funciones -> sala -> asientos -> reservación
   - un asiento pertenece a una sala, pero está ocupado POR FUNCIÓN;
     no puede haber dos reservas ACTIVAS sobre la misma combinación
     función-asiento: lo defiende el índice único parcial de abajo,
     además de la comprobación de esta capa (pág. 4: no basta con
     bloquear el botón en JavaScript).
   - la reserva se consulta con FOLIO + CORREO del cliente (pág. 5:
     no se muestran reservaciones ajenas con solo conocer un ID).
   - el pago es SIMULADO (pág. 5), no se usan tarjetas reales.
   ============================================================ */

const { DatabaseSync } = require('node:sqlite');
const path = require('node:path');
const fs = require('node:fs');

const DATA_DIR = path.join(__dirname, '..', 'data');
const DB_PATH = process.env.CINEPASS_DB || path.join(DATA_DIR, 'cinepass.sqlite');
fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });

const db = new DatabaseSync(DB_PATH);
db.exec('PRAGMA foreign_keys = ON;');

/* ------------------------------------------------- esquema ---- */

db.exec(`
CREATE TABLE IF NOT EXISTS peliculas (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    titulo        TEXT    NOT NULL UNIQUE,
    genero        TEXT    NOT NULL,
    duracion_min  INTEGER NOT NULL CHECK (duracion_min > 0),
    clasificacion TEXT    NOT NULL,
    sinopsis      TEXT    NOT NULL DEFAULT '',
    lema          TEXT    NOT NULL DEFAULT '',
    poster        TEXT    NOT NULL DEFAULT '',
    destacada     INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS salas (
    id       INTEGER PRIMARY KEY AUTOINCREMENT,
    nombre   TEXT    NOT NULL UNIQUE,
    filas    TEXT    NOT NULL,
    columnas INTEGER NOT NULL CHECK (columnas > 0)
);

CREATE TABLE IF NOT EXISTS funciones (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    pelicula_id INTEGER NOT NULL REFERENCES peliculas(id),
    sala_id     INTEGER NOT NULL REFERENCES salas(id),
    fecha       TEXT    NOT NULL,
    hora        TEXT    NOT NULL,
    precio      INTEGER NOT NULL CHECK (precio > 0)
);

CREATE TABLE IF NOT EXISTS asientos (
    id      INTEGER PRIMARY KEY AUTOINCREMENT,
    sala_id INTEGER NOT NULL REFERENCES salas(id),
    fila    TEXT    NOT NULL,
    numero  INTEGER NOT NULL CHECK (numero > 0),
    UNIQUE (sala_id, fila, numero)
);

CREATE TABLE IF NOT EXISTS reservaciones (
    id             INTEGER PRIMARY KEY AUTOINCREMENT,
    folio          TEXT    NOT NULL,
    funcion_id     INTEGER NOT NULL REFERENCES funciones(id),
    asiento_id     INTEGER NOT NULL REFERENCES asientos(id),
    cliente_nombre TEXT    NOT NULL,
    cliente_correo TEXT    NOT NULL,
    estado         TEXT    NOT NULL DEFAULT 'activa' CHECK (estado IN ('activa', 'cancelada')),
    creado_en      TEXT    NOT NULL DEFAULT (datetime('now', 'localtime'))
);

-- CLAVE del sistema (guía, pág. 7): una butaca es de la sala, pero se
-- ocupa por función. Un índice único parcial impide dos reservas activas
-- sobre la misma combinación función-asiento, incluso en competencia.
CREATE UNIQUE INDEX IF NOT EXISTS uq_reserva_activa
    ON reservaciones (funcion_id, asiento_id)
    WHERE estado = 'activa';
`);

/* ------------------------------------------------- utilidades -- */

function siguienteFolio() {
    const max = db.prepare(
        'SELECT COALESCE(MAX(CAST(substr(folio, 4) AS INTEGER)), 0) AS n FROM reservaciones'
    ).get().n;
    return `CP-${String(max + 1).padStart(4, '0')}`;
}

function etiquetaAsiento(a) {
    return `Fila ${a.fila} · Asiento ${a.numero}`;
}

/* ------------------------------------------------- seed -------- */

function generarAsientos(salaId, filas, columnas) {
    const stmt = db.prepare('INSERT INTO asientos (sala_id, fila, numero) VALUES (?, ?, ?)');
    for (const fila of filas.split('')) {
        for (let numero = 1; numero <= columnas; numero++) stmt.run(salaId, fila, numero);
    }
}

// Primera carga de datos. Las películas de muestra son las mismas seis
// que ya venían en Inicio y Cartelera; ahora viven en la base de datos.
function seed() {
    const total = db.prepare('SELECT COUNT(*) AS n FROM peliculas').get().n;
    if (total > 0) return;

    const insertarPelicula = db.prepare(`INSERT INTO peliculas
        (titulo, genero, duracion_min, clasificacion, sinopsis, lema, poster, destacada)
        VALUES (?, ?, ?, ?, ?, ?, ?, 1)`);

    insertarPelicula.run('Órbita 9', 'Ciencia ficción', 120, 'B',
        'Una tripulación descubre una señal que llega desde la novena órbita de un planeta sin nombre.',
        'MÁS ALLÁ DE LAS ESTRELLAS', 'img/posters/orbita-9.svg');
    insertarPelicula.run('Sombras del Faro', 'Misterio', 105, 'B15',
        'El viejo farero de un pueblo costero regresa después de treinta años con un secreto bajo el brazo.',
        'EL MISTERIO TE ESPERA', 'img/posters/sombras-del-faro.svg');
    insertarPelicula.run('Aventura Pixel', 'Animación', 95, 'A',
        'Un personaje de videojuego descubre que su mundo cambia cada vez que alguien presiona START.',
        'EL JUEGO APENAS COMIENZA', 'img/posters/aventura-pixel.svg');
    insertarPelicula.run('Ruta Salvaje', 'Aventura', 112, 'B',
        'Dos hermanas cruzan el desierto siguiendo un mapa que se reescribe cada noche.',
        'NADA ESTÁ ESCRITO', 'img/posters/ruta-salvaje.svg');
    insertarPelicula.run('La Última Toma', 'Drama', 108, 'B',
        'Una directora debutante rueda, con el último rollo de cine del pueblo, la película que nadie filmó.',
        'UNA HISTORIA POR CONTAR', 'img/posters/la-ultima-toma.svg');
    insertarPelicula.run('Código Eclipse', 'Acción', 118, 'B15',
        'Cuando el eclipse tapa el sol, una ciudad entera queda a merced de un plan silencioso.',
        'CADA SEGUNDO CUENTA', 'img/posters/codigo-eclipse.svg');

    const insertarSala = db.prepare('INSERT INTO salas (nombre, filas, columnas) VALUES (?, ?, ?)');
    let r = insertarSala.run('Sala 1', 'ABCD', 8);
    generarAsientos(Number(r.lastInsertRowid), 'ABCD', 8);
    r = insertarSala.run('Sala 2', 'ABCDE', 10);
    generarAsientos(Number(r.lastInsertRowid), 'ABCDE', 10);

    const insertarFuncion = db.prepare(`INSERT INTO funciones
        (pelicula_id, sala_id, fecha, hora, precio) VALUES (?, ?, ?, ?, ?)`);
    const funciones = [
        [1, 1, '2026-11-18', '16:00', 120], [1, 2, '2026-11-20', '19:30', 150],
        [2, 1, '2026-11-19', '17:00', 120], [2, 2, '2026-11-21', '19:30', 150],
        [3, 1, '2026-11-18', '14:00', 120], [3, 2, '2026-11-22', '16:00', 150],
        [4, 1, '2026-11-20', '15:00', 120], [5, 2, '2026-11-21', '18:00', 150],
        [6, 1, '2026-11-22', '20:30', 120], [6, 2, '2026-11-19', '21:00', 150]
    ];
    for (const f of funciones) insertarFuncion.run(...f);

    // Una reserva activa de muestra deja asientos "ocupados" visibles en el
    // mapa, y la cancelada permite probar la consulta y el estado cancelado.
    const asientoDe = db.prepare('SELECT id, fila, numero FROM asientos WHERE sala_id = ? AND fila = ? AND numero = ?');
    const insertarReserva = db.prepare(`INSERT INTO reservaciones
        (folio, funcion_id, asiento_id, cliente_nombre, cliente_correo, estado)
        VALUES (?, ?, ?, ?, ?, ?)`);
    const aB3 = asientoDe.get(1, 'B', 3), aB4 = asientoDe.get(1, 'B', 4), aA1 = asientoDe.get(1, 'A', 1);
    insertarReserva.run('CP-0001', 1, aB3.id, 'Equipo CinePass', 'equipo@cinepass.local', 'activa');
    insertarReserva.run('CP-0001', 1, aB4.id, 'Equipo CinePass', 'equipo@cinepass.local', 'activa');
    insertarReserva.run('CP-0002', 3, aA1.id, 'Ana Demo', 'ana@example.com', 'cancelada');
}

/* ------------------------------------------------- consultas --- */

const listarPeliculas = (soloDestacadas = false) => db.prepare(
    `SELECT * FROM peliculas ${soloDestacadas ? 'WHERE destacada = 1' : ''} ORDER BY id`
).all();

const obtenerPelicula = (id) => db.prepare('SELECT * FROM peliculas WHERE id = ?').get(id) ?? null;

const crearPelicula = (p) => {
    const r = db.prepare(`INSERT INTO peliculas
        (titulo, genero, duracion_min, clasificacion, sinopsis, lema, poster, destacada)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)`).run(
        p.titulo, p.genero, p.duracion_min, p.clasificacion,
        p.sinopsis ?? '', p.lema ?? '', p.poster ?? '', p.destacada ? 1 : 0);
    return obtenerPelicula(Number(r.lastInsertRowid));
};

const actualizarPelicula = (id, p) => {
    db.prepare(`UPDATE peliculas SET titulo = ?, genero = ?, duracion_min = ?,
        clasificacion = ?, sinopsis = ?, lema = ?, poster = ?, destacada = ? WHERE id = ?`)
        .run(p.titulo, p.genero, p.duracion_min, p.clasificacion,
            p.sinopsis ?? '', p.lema ?? '', p.poster ?? '', p.destacada ? 1 : 0, id);
    return obtenerPelicula(id);
};

// Integridad (guía, pág. 6): una película con funciones o reservas
// relacionadas no se elimina a la ligera; el servidor lo bloquea.
const eliminarPelicula = (id) => {
    const funciones = db.prepare('SELECT id FROM funciones WHERE pelicula_id = ?').all(id);
    if (funciones.length > 0) return { bloqueo: 'funciones' };
    const reservas = db.prepare(`SELECT id FROM reservaciones
        WHERE estado = 'activa' AND funcion_id IN (SELECT id FROM funciones WHERE pelicula_id = ?)`).all(id);
    if (reservas.length > 0) return { bloqueo: 'reservas' };
    db.prepare('DELETE FROM peliculas WHERE id = ?').run(id);
    return { ok: true };
};

const listarSalas = () => db.prepare(`SELECT s.*,
    (SELECT COUNT(*) FROM asientos a WHERE a.sala_id = s.id) AS total_asientos
    FROM salas s ORDER BY s.id`).all();

const CONSULTA_FUNCION = `SELECT f.id, f.pelicula_id, p.titulo AS pelicula_titulo,
    f.sala_id, s.nombre AS sala_nombre, f.fecha, f.hora, f.precio,
    (SELECT COUNT(*) FROM reservaciones r WHERE r.funcion_id = f.id AND r.estado = 'activa') AS ocupados
    FROM funciones f JOIN peliculas p ON p.id = f.pelicula_id JOIN salas s ON s.id = f.sala_id`;

const listarFunciones = (peliculaId = null) => peliculaId == null
    ? db.prepare(`${CONSULTA_FUNCION} ORDER BY f.fecha, f.hora`).all()
    : db.prepare(`${CONSULTA_FUNCION} WHERE f.pelicula_id = ? ORDER BY f.fecha, f.hora`).all(peliculaId);

const obtenerFuncion = (id) => db.prepare(`${CONSULTA_FUNCION} WHERE f.id = ?`).get(id) ?? null;

const crearFuncion = (f) => {
    const r = db.prepare('INSERT INTO funciones (pelicula_id, sala_id, fecha, hora, precio) VALUES (?, ?, ?, ?, ?)')
        .run(f.pelicula_id, f.sala_id, f.fecha, f.hora, f.precio);
    return obtenerFuncion(Number(r.lastInsertRowid));
};

const actualizarFuncion = (id, f) => {
    db.prepare('UPDATE funciones SET pelicula_id = ?, sala_id = ?, fecha = ?, hora = ?, precio = ? WHERE id = ?')
        .run(f.pelicula_id, f.sala_id, f.fecha, f.hora, f.precio, id);
    return obtenerFuncion(id);
};

const eliminarFuncion = (id) => {
    const reservas = db.prepare("SELECT id FROM reservaciones WHERE funcion_id = ? AND estado = 'activa'").all(id);
    if (reservas.length > 0) return { bloqueo: 'reservas' };
    db.prepare('DELETE FROM funciones WHERE id = ?').run(id);
    return { ok: true };
};

// Mapa visual por filas y números (guía, pág. 4) con estados
// libre/ocupado calculados por función.
const asientosDeFuncion = (funcionId) => {
    const funcion = obtenerFuncion(funcionId);
    if (!funcion) return null;
    const asientos = db.prepare(`SELECT a.id, a.fila, a.numero,
        CASE WHEN r.id IS NULL THEN 'libre' ELSE 'ocupado' END AS estado
        FROM asientos a
        LEFT JOIN reservaciones r ON r.asiento_id = a.id AND r.funcion_id = ? AND r.estado = 'activa'
        WHERE a.sala_id = ?
        ORDER BY a.fila, a.numero`).all(funcionId, funcion.sala_id);
    return { funcion, asientos };
};

// El total SIEMPRE lo calcula el servidor (precio de la función × asientos);
// nunca se confía en un total enviado por el cliente.
const crearReservacion = ({ funcionId, asientoIds, nombre, correo }) => {
    const funcion = obtenerFuncion(funcionId);
    if (!funcion) return { error: 'funcion' };

    const validar = db.prepare('SELECT id, fila, numero FROM asientos WHERE id = ? AND sala_id = ?');
    const asientos = [];
    for (const idAsiento of new Set(asientoIds)) {
        const a = validar.get(idAsiento, funcion.sala_id);
        if (!a) return { error: 'asiento', idAsiento };
        asientos.push(a);
    }
    if (asientos.length === 0) return { error: 'sin_asientos' };

    const ocupado = db.prepare("SELECT id FROM reservaciones WHERE funcion_id = ? AND asiento_id = ? AND estado = 'activa'");
    const conflictos = asientos.filter(a => ocupado.get(funcionId, a.id)).map(etiquetaAsiento);
    if (conflictos.length > 0) return { conflicto: conflictos };

    db.exec('BEGIN');
    try {
        const folio = siguienteFolio();
        const stmt = db.prepare(`INSERT INTO reservaciones
            (folio, funcion_id, asiento_id, cliente_nombre, cliente_correo, estado)
            VALUES (?, ?, ?, ?, ?, 'activa')`);
        for (const a of asientos) stmt.run(folio, funcionId, a.id, nombre, correo);
        db.exec('COMMIT');
        return {
            ok: true, folio,
            total: funcion.precio * asientos.length,
            asientos: asientos.sort((x, y) => x.fila.localeCompare(y.fila) || x.numero - y.numero).map(etiquetaAsiento),
            pago_simulado: true
        };
    } catch (e) {
        db.exec('ROLLBACK'); // el índice único ganó la carrera: mismo asiento, misma función
        return { conflicto: ['asiento ya reservado por otra persona'] };
    }
};

const CONSULTA_RESERVA = `SELECT r.id, r.folio, r.estado, r.cliente_nombre, r.cliente_correo,
    r.creado_en, a.fila, a.numero,
    f.id AS funcion_id, f.fecha, f.hora, f.precio, s.nombre AS sala_nombre, p.titulo AS pelicula_titulo
    FROM reservaciones r
    JOIN asientos a ON a.id = r.asiento_id
    JOIN funciones f ON f.id = r.funcion_id
    JOIN salas s ON s.id = f.sala_id
    JOIN peliculas p ON p.id = f.pelicula_id`;

const buscarReservacion = ({ folio, correo }) => {
    const filas = db.prepare(`${CONSULTA_RESERVA} WHERE r.folio = ? AND lower(r.cliente_correo) = lower(?) ORDER BY a.fila, a.numero`)
        .all(folio, correo);
    if (filas.length === 0) return null;
    return {
        folio: filas[0].folio,
        cliente_nombre: filas[0].cliente_nombre,
        cliente_correo: filas[0].cliente_correo,
        estado: filas.some(x => x.estado === 'activa') ? 'activa' : 'cancelada',
        pelicula_titulo: filas[0].pelicula_titulo,
        fecha: filas[0].fecha, hora: filas[0].hora, sala_nombre: filas[0].sala_nombre,
        precio: filas[0].precio,
        asientos: filas.map(x => etiquetaAsiento(x)),
        total: filas[0].precio * filas.length
    };
};

// Cancelación por grupo (folio completo), con verificación de dueño.
const cancelarReservacion = ({ folio, correo }) => {
    const r = db.prepare(`UPDATE reservaciones SET estado = 'cancelada'
        WHERE folio = ? AND lower(cliente_correo) = lower(?) AND estado = 'activa'`).run(folio, correo);
    return { cambiados: Number(r.changes) };
};

const listarReservaciones = () => db.prepare(`${CONSULTA_RESERVA} ORDER BY r.creado_en DESC, a.fila, a.numero`).all();

const resumen = () => ({
    archivo: path.basename(DB_PATH),
    peliculas: db.prepare('SELECT COUNT(*) AS n FROM peliculas').get().n,
    salas: db.prepare('SELECT COUNT(*) AS n FROM salas').get().n,
    funciones: db.prepare('SELECT COUNT(*) AS n FROM funciones').get().n,
    asientos: db.prepare('SELECT COUNT(*) AS n FROM asientos').get().n,
    reservaciones: db.prepare("SELECT COUNT(*) AS n FROM reservaciones WHERE estado = 'activa'").get().n
});

seed();

module.exports = {
    db, dbPath: DB_PATH, seed, resumen, siguienteFolio, etiquetaAsiento,
    listarPeliculas, obtenerPelicula, crearPelicula, actualizarPelicula, eliminarPelicula,
    listarSalas, listarFunciones, obtenerFuncion, crearFuncion, actualizarFuncion, eliminarFuncion,
    asientosDeFuncion, crearReservacion, buscarReservacion, cancelarReservacion, listarReservaciones
};

// Ejecución directa: `node src/db.js` imprime el estado de la base de datos.
if (require.main === module) {
    console.log('CinePass · base de datos:', JSON.stringify(resumen(), null, 2));
}
