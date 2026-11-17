// CinePass — Módulo 03: detalle de película + funciones desde la API.
// Recibe ?pelicula=ID en la URL y arma la tabla con fetch y DOM.
const bloque = {
    titulo: document.querySelector('#detalle-titulo'),
    lema: document.querySelector('#detalle-lema'),
    sinopsis: document.querySelector('#detalle-sinopsis'),
    poster: document.querySelector('#detalle-poster'),
    genero: document.querySelector('#dato-genero'),
    duracion: document.querySelector('#dato-duracion'),
    clasificacion: document.querySelector('#dato-clasificacion'),
    funciones: document.querySelector('#fila-funciones'),
    vacia: document.querySelector('#detalle-vacia')
};

function numeroDeURL(nombre) {
    const valor = new URLSearchParams(window.location.search).get(nombre);
    const n = Number(valor);
    return Number.isInteger(n) && n > 0 ? n : null;
}

async function cargarDetalle() {
    const id = numeroDeURL('pelicula');
    if (!id) {
        bloque.titulo.textContent = 'Elige una película desde la cartelera';
        bloque.sinopsis.textContent = 'Esta página necesita ?pelicula=ID. Vuelve a la cartelera y entra en la película que quieras ver.';
        bloque.poster.alt = 'Póster genérico de CinePass';
        document.querySelector('.detalle-hero').closest('section').querySelector('.detalle-funciones').hidden = true;
        return;
    }

    const respuesta = await fetch('/api/peliculas/' + id);
    if (!respuesta.ok) {
        bloque.titulo.textContent = 'Película no encontrada';
        bloque.sinopsis.textContent = 'Puede que la administración la haya eliminado. Revisa la cartelera.';
        document.querySelector('.detalle-funciones').hidden = true;
        return;
    }
    const pelicula = await respuesta.json();

    document.title = pelicula.titulo + ' | CinePass';
    bloque.titulo.textContent = pelicula.titulo;
    bloque.lema.textContent = pelicula.lema;
    bloque.sinopsis.textContent = pelicula.sinopsis;
    if (pelicula.poster) { bloque.poster.src = pelicula.poster; }
    bloque.poster.alt = 'Póster de ' + pelicula.titulo;
    bloque.genero.textContent = pelicula.genero;
    bloque.duracion.textContent = pelicula.duracion_min + ' min';
    bloque.clasificacion.textContent = 'Clasificación ' + pelicula.clasificacion;

    const funciones = await (await fetch('/api/funciones?pelicula_id=' + id)).json();
    bloque.funciones.innerHTML = '';
    if (funciones.length === 0) { bloque.vacia.hidden = false; return; }

    // Una fila por función con botón hacia la selección de asientos (módulo 04).
    for (const f of funciones) {
        const fila = document.createElement('tr');
        fila.innerHTML = `
            <td>${f.fecha}</td>
            <td>${f.hora}</td>
            <td>${f.sala_nombre}</td>
            <td>$${f.precio} MXN</td>
            <td>${f.ocupados} reservados</td>
            <td class="acciones-celda"><a class="btn-mini" href="asientos.html?funcion=${f.id}">Elegir asientos</a></td>`;
        bloque.funciones.appendChild(fila);
    }
}

cargarDetalle().catch(() => {
    bloque.titulo.textContent = 'No se pudo consultar la API';
    bloque.sinopsis.textContent = 'Revisa que el servidor esté funcionando (npm start).';
});
