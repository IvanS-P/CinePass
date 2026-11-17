// CinePass: búsqueda y filtro de películas, ahora con datos desde la API.
// El arreglo de tarjetas llega de /api/peliculas; el filtrado se hace en el
// cliente con eventos del DOM (rubrica 05: DOM, eventos, arreglos y fetch).
const buscador = document.querySelector('#buscar-pelicula');
const selectorGenero = document.querySelector('#filtrar-genero');
const lista = document.querySelector('#lista-peliculas');
const contador = document.querySelector('#contador-peliculas');
const mensaje = document.querySelector('#sin-resultados');

let peliculas = []; // arreglo con todas las películas de la API
let tarjetas = [];  // su representación como elementos del DOM

function normalizar(texto) {
    return texto.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
}

// Plantilla común de tarjeta clara (misma estructura que el Inicio).
function tarjetaHTML(pelicula) {
    const articulo = document.createElement('article');
    articulo.className = 'tarjeta';
    articulo.setAttribute('data-titulo', pelicula.titulo);
    articulo.setAttribute('data-genero', pelicula.genero);
    articulo.innerHTML = `
        <a class="card-enlace" href="detalle.html?pelicula=${pelicula.id}" aria-label="Ver detalles de ${pelicula.titulo}">
            <span class="card-poster">
                <img class="poster-img" src="${pelicula.poster || 'img/posters/generica.svg'}" alt="Póster de ${pelicula.titulo}">
                <span class="badge">${pelicula.clasificacion}</span>
            </span>
            <span class="card-info">
                <span>
                    <span class="card-titulo">${pelicula.titulo}</span>
                    <span class="card-meta">${pelicula.duracion_min} min · ${pelicula.genero}</span>
                </span>
                <span class="pill-clasif ${pelicula.clasificacion}">${pelicula.clasificacion}</span>
            </span>
        </a>`;
    return articulo;
}

function renderizarTarjetas() {
    lista.innerHTML = '';
    for (const articulo of tarjetas) lista.appendChild(articulo);
}

function filtrarPeliculas() {
    const busqueda = normalizar(buscador.value);
    const generoElegido = selectorGenero.value;
    let visibles = 0;

    tarjetas.forEach((tarjeta) => {
        const coincideTitulo = normalizar(tarjeta.getAttribute('data-titulo')).includes(busqueda);
        const coincideGenero = generoElegido === 'todos' || tarjeta.getAttribute('data-genero') === generoElegido;
        const mostrar = coincideTitulo && coincideGenero;

        tarjeta.hidden = !mostrar;
        if (mostrar) visibles++;
    });

    contador.textContent = `Mostrando ${visibles} de ${tarjetas.length} películas`;
    mensaje.hidden = visibles !== 0;
}

async function cargarDesdeLaAPI() {
    const respuesta = await fetch('/api/peliculas');
    if (!respuesta.ok) throw new Error('La API respondió ' + respuesta.status);
    peliculas = await respuesta.json();
    tarjetas = peliculas.map(tarjetaHTML);
    renderizarTarjetas();
    buscador.addEventListener('input', filtrarPeliculas);
    selectorGenero.addEventListener('change', filtrarPeliculas);
    filtrarPeliculas();
}

cargarDesdeLaAPI().catch(() => {
    contador.textContent = 'No se pudo consultar la API. Revisa que el servidor esté funcionando (npm start).';
});
