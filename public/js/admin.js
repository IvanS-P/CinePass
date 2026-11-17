// CinePass — Módulo 07: panel de administración con CRUD desde la interfaz.
// El login no es decorativo: el servidor responde 401 a las rutas admin, así
// que primero hay que iniciar sesión (demo del equipo en el README).
const formLogin = document.querySelector('#form-login');
const zonaAdmin = document.querySelector('#zona-admin');
const adminEstado = document.querySelector('#admin-estado');
const loginErrores = document.querySelector('#login-errores');
const formPelicula = document.querySelector('#form-pelicula');
const campoId = document.querySelector('#p-id');
const botonGuardar = document.querySelector('#boton-guardar');

function mostrarErrores(ul, mensaje) {
    ul.hidden = !mensaje;
    if (mensaje) ul.textContent = mensaje;
}

// Campos del formulario de películas
const campos = {
    titulo: document.querySelector('#p-titulo'),
    genero: document.querySelector('#p-genero'),
    clasificacion: document.querySelector('#p-clasificacion'),
    duracion: document.querySelector('#p-duracion'),
    lema: document.querySelector('#p-lema'),
    sinopsis: document.querySelector('#p-sinopsis')
};

async function api(ruta, opciones) {
    const r = await fetch('/api' + ruta, opciones);
    if (r.status === 204) return { ok: true, status: 204 };
    const cuerpo = await r.json();
    return { ok: r.ok, status: r.status, cuerpo };
}

async function iniciarSesion(usuario, clave) {
    const r = await api('/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ usuario, clave }) });
    return r.ok;
}

function mostrarPanel(mostrar) {
    formLogin.hidden = mostrar;
    zonaAdmin.hidden = !mostrar;
}

formLogin.addEventListener('submit', async (e) => {
    e.preventDefault();
    const ok = await iniciarSesion(document.querySelector('#login-usuario').value.trim(), document.querySelector('#login-clave').value);
    if (!ok) { mostrarErrores(loginErrores, 'Usuario o contraseña incorrectos.'); return; }
    mostrarErrores(loginErrores, null);
    mostrarPanel(true);
    cargarTodo();
});

document.querySelector('#boton-logout').addEventListener('click', async () => {
    await api('/logout', { method: 'POST' });
    mostrarPanel(false);
});

function cuerpoJSON() {
    return {
        titulo: campos.titulo.value.trim(),
        genero: campos.genero.value,
        duracion_min: Number(campos.duracion.value),
        clasificacion: campos.clasificacion.value,
        sinopsis: campos.sinopsis.value.trim(),
        lema: campos.lema.value.trim()
    };
}

function llenarFormulario(p) {
    campoId.value = p ? p.id : '';
    campos.titulo.value = p ? p.titulo : '';
    campos.genero.value = p ? p.genero : campos.genero.options[0].value;
    campos.clasificacion.value = p ? p.clasificacion : campos.clasificacion.options[0].value;
    campos.duracion.value = p ? p.duracion_min : '';
    campos.lema.value = p ? p.lema : '';
    campos.sinopsis.value = p ? p.sinopsis : '';
    botonGuardar.textContent = p ? 'Guardar cambios (PUT)' : 'Crear película (POST)';
}

document.querySelector('#boton-limpiar').addEventListener('click', () => { llenarFormulario(null); mostrarErrores(document.querySelector('#pelicula-errores'), null); });

// POST (crear) o PUT (actualizar) según haya ID en el formulario
formPelicula.addEventListener('submit', async (e) => {
    e.preventDefault();
    const opciones = { method: campoId.value ? 'PUT' : 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(cuerpoJSON()) };
    const r = await api(campoId.value ? '/peliculas/' + campoId.value : '/peliculas', opciones);
    if (!r.ok) { mostrarErrores(document.querySelector('#pelicula-errores'), (r.cuerpo.mensaje || 'HTTP ' + r.status) + (r.cuerpo.errores ? ' → ' + r.cuerpo.errores.join(' · ') : '')); return; }
    mostrarErrores(document.querySelector('#pelicula-errores'), null);
    llenarFormulario(null);
    cargarTodo();
});

function filaTabla(celdas, accionesHTML) {
    const tr = document.createElement('tr');
    tr.innerHTML = celdas.map(c => `<td>${c}</td>`).join('') + `<td class="acciones-celda">${accionesHTML}</td>`;
    return tr;
}

async function cargarTodo() {
    if (!(await api('/sesion')).ok) { mostrarPanel(false); return; } // el servidor manda; la UI acata
    adminEstado.textContent = 'Sesión de administrador activa. La lista se recarga desde la API tras cada operación.';

    // GET películas -> tabla con Editar (carga el formulario) y Eliminar (confirmación)
    const tbodyPeliculas = document.querySelector('#tabla-peliculas');
    tbodyPeliculas.innerHTML = '';
    const peliculas = await api('/peliculas');
    for (const p of peliculas.cuerpo) {
        const tr = filaTabla([p.id, p.titulo, p.genero, p.duracion_min + ' min', p.clasificacion, p.destacada ? 'sí' : 'no'],
            `<button class="btn-mini" data-accion="editar" data-json='${JSON.stringify(p).replace(/'/g, '&#39;')}'>Editar</button> <button class="btn-mini peligro" data-accion="borrar" data-id="${p.id}" data-nombre="${p.titulo}">Eliminar</button>`);
        tbodyPeliculas.appendChild(tr);
    }
    tbodyPeliculas.querySelectorAll('button').forEach(b => b.addEventListener('click', alClicAdmin));

    // GET funciones -> tabla con baja (y su bloqueo por integridad)
    const tbodyFunciones = document.querySelector('#tabla-funciones');
    tbodyFunciones.innerHTML = '';
    const funciones = await api('/funciones');
    for (const f of funciones.cuerpo) {
        const tr = filaTabla([f.id, f.pelicula_titulo, f.fecha, f.hora, f.sala_nombre, '$' + f.precio, f.ocupados + ' res.'],
            `<button class="btn-mini peligro" data-accion="borrar-funcion" data-id="${f.id}" data-nombre="${f.pelicula_titulo} ${f.fecha} ${f.hora}">Eliminar</button>`);
        tbodyFunciones.appendChild(tr);
    }
    tbodyFunciones.querySelectorAll('button').forEach(b => b.addEventListener('click', alClicAdmin));

    // GET reservaciones (lista completa, solo admin)
    const tbodyReservas = document.querySelector('#tabla-reservas');
    tbodyReservas.innerHTML = '';
    const reservas = await api('/reservaciones');
    for (const r of reservas.cuerpo) {
        tbodyReservas.appendChild(filaTabla(
            [r.folio, r.cliente_nombre, r.cliente_correo, r.pelicula_titulo, r.fecha + ' ' + r.hora + ' · ' + r.sala_nombre, r.fila + ' ' + r.numero, r.estado], null));
    }
}

async function alClicAdmin(e) {
    const b = e.currentTarget;
    if (b.dataset.accion === 'editar') {
        llenarFormulario(JSON.parse(b.dataset.json.replace(/&#39;/g, "'")));
        formPelicula.scrollIntoView({ behavior: 'smooth' });
    }
    if (b.dataset.accion === 'borrar') {
        // Confirmación antes de la baja (como pide el panel de la guía)
        if (!confirm('¿Eliminar la película «' + b.dataset.nombre + '»? Solo es posible si no tiene funciones o reservas.')) return;
        const r = await api('/peliculas/' + b.dataset.id, { method: 'DELETE' });
        if (!r.ok && r.status !== 204) alert('El servidor rechazó la eliminación: ' + (r.cuerpo.mensaje || r.status));
        cargarTodo();
    }
    if (b.dataset.accion === 'borrar-funcion') {
        if (!confirm('¿Eliminar la función «' + b.dataset.nombre + '»? Solo es posible si no tiene reservas activas.')) return;
        const r = await api('/funciones/' + b.dataset.id, { method: 'DELETE' });
        if (!r.ok && r.status !== 204) alert('El servidor rechazó la eliminación: ' + (r.cuerpo.mensaje || r.status));
        cargarTodo();
    }
}

// Si ya hay sesión (por ejemplo tras un login en otra pestaña), mostrar el panel.
api('/sesion').then(r => { if (r.ok) { mostrarPanel(true); cargarTodo(); } });
