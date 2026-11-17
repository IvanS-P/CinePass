// CinePass — Módulo 04: mapa visual de asientos con selección múltiple.
// Los estados llegan de la API (libre/ocupado POR FUNCIÓN); lo seleccionado
// vive en un arreglo del cliente y viaja a la confirmación por la URL.
const infoFuncion = document.querySelector('#info-funcion');
const zonaMapa = document.querySelector('#zona-mapa');
const mapa = document.querySelector('#mapa-butacas');
const resumenSeleccion = document.querySelector('#resumen-seleccion');
const resumenPrecio = document.querySelector('#resumen-precio');
const botonContinuar = document.querySelector('#boton-continuar');

let funcionActual = null;
const seleccionados = new Set(); // arreglo asociativo de asientos elegidos

function numeroDeURL(nombre) {
    const valor = new URLSearchParams(window.location.search).get(nombre);
    const n = Number(valor);
    return Number.isInteger(n) && n > 0 ? n : null;
}

function etiquetaAsiento(a) {
    return 'Fila ' + a.fila + ' · Asiento ' + a.numero;
}

function actualizarResumen() {
    const precioTotal = (funcionActual.precio || 0) * seleccionados.size;
    resumenSeleccion.textContent = seleccionados.size === 0
        ? 'Aún no has elegido asientos.'
        : seleccionados.size + ' asiento(s): ' + [...seleccionados].join(', ');
    resumenPrecio.textContent = '$' + precioTotal + ' MXN';
    if (seleccionados.size === 0) {
        botonContinuar.setAttribute('aria-disabled', 'true');
        botonContinuar.removeAttribute('href');
    } else {
        botonContinuar.setAttribute('aria-disabled', 'false');
        botonContinuar.href = 'confirmacion.html?funcion=' + funcionActual.id +
            '&asientos=' + [...seleccionados].join(',');
    }
}

function pintarButaca(a) {
    const estado = seleccionados.has(a.id) ? 'seleccionado' : a.estado;
    const boton = document.createElement('button');
    boton.type = 'button';
    boton.className = 'butaca ' + estado;
    boton.textContent = a.numero;
    boton.setAttribute('aria-label', etiquetaAsiento(a) + ' — ' + estado);
    if (estado === 'ocupado') {
        boton.disabled = true;
    } else {
        boton.addEventListener('click', () => {
            // Selección múltiple dentro de la misma función
            if (seleccionados.has(a.id)) seleccionados.delete(a.id);
            else seleccionados.add(a.id);
            mapa.innerHTML = '';
            pintarMapa(mapaDatos);
            actualizarResumen();
        });
    }
    return boton;
}

let mapaDatos = [];

function pintarMapa(asientos) {
    mapaDatos = asientos;
    mapa.innerHTML = '';
    const filas = [...new Set(asientos.map(a => a.fila))].sort();
    for (const fila of filas) {
        const filaDiv = document.createElement('div');
        filaDiv.className = 'fila-butacas';
        filaDiv.style.setProperty('--cols', asientos.filter(a => a.fila === fila).length);
        const etiqueta = document.createElement('span');
        etiqueta.className = 'fila-nombre';
        etiqueta.textContent = fila;
        filaDiv.appendChild(etiqueta);
        for (const a of asientos.filter(x => x.fila === fila)) filaDiv.appendChild(pintarButaca(a));
        mapa.appendChild(filaDiv);
    }
}

async function cargarMapa() {
    const id = numeroDeURL('funcion');
    if (!id) return; // la página ya explica qué hacer en el párrafo inicial

    const respuesta = await fetch('/api/funciones/' + id + '/asientos');
    if (!respuesta.ok) {
        infoFuncion.textContent = 'Función no encontrada. Elige una película y una función en el detalle.';
        return;
    }
    const { funcion, asientos } = await respuesta.json();
    funcionActual = funcion;

    infoFuncion.textContent = funcion.pelicula_titulo + ' · ' + funcion.sala_nombre +
        ' · ' + funcion.fecha + ' ' + funcion.hora + ' · $' + funcion.precio + ' MXN por asiento';
    zonaMapa.hidden = false;

    pintarMapa(asientos);
    actualizarResumen();
}

cargarMapa().catch(() => {
    infoFuncion.textContent = 'No se pudo consultar la API. Revisa que el servidor esté funcionando (npm start).';
});
