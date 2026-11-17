// CinePass — Inicio: carrusel de destacadas cargado desde la API (fetch).
// Las tarjetas se generan con arreglos y DOM; las flechas desplazan la fila.
const carrusel = document.querySelector('#destacadas-carrusel');
const flechaIzq = document.querySelector('#flecha-izq');
const flechaDer = document.querySelector('#flecha-der');
const aviso = document.querySelector('#carrusel-aviso');
const movimientoSuave = !window.matchMedia('(prefers-reduced-motion: reduce)').matches;

// Plantilla de tarjeta clara (póster con badge + barra inferior), como la referencia.
function tarjetaHTML(pelicula) {
    const articulo = document.createElement('article');
    articulo.className = 'tarjeta';
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

async function cargarDestacadas() {
    const respuesta = await fetch('/api/peliculas?destacada=1');
    const peliculas = await respuesta.json();
    carrusel.innerHTML = '';
    for (const pelicula of peliculas) carrusel.appendChild(tarjetaHTML(pelicula));
    actualizarFlechas();
}

// Las flechas solo aparecen cuando hay hacia dónde desplazar.
function actualizarFlechas() {
    const alInicio = carrusel.scrollLeft <= 4;
    const alFinal = carrusel.scrollLeft + carrusel.clientWidth >= carrusel.scrollWidth - 4;
    flechaIzq.disabled = alInicio;
    flechaDer.disabled = alFinal;
}

function desplazar(direccion) {
    carrusel.scrollBy({ left: direccion * (carrusel.clientWidth - 60), behavior: movimientoSuave ? 'smooth' : 'auto' });
}

flechaIzq.addEventListener('click', () => desplazar(-1));
flechaDer.addEventListener('click', () => desplazar(1));
carrusel.addEventListener('scroll', actualizarFlechas);

cargarDestacadas().catch(() => {
    aviso.hidden = false;
    aviso.textContent = 'No se pudo consultar la API. Revisa que el servidor esté funcionando (npm start).';
});
