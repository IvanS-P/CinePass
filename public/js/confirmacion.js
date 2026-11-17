// CinePass — Módulo 05: resumen, formulario validado y POST a la API.
// Validación doble (rubrica 06): el cliente rechaza datos inválidos con
// mensajes claros y el servidor vuelve a validarlos al recibirlos.
const form = document.querySelector('#form-reserva');
const campoNombre = document.querySelector('#campo-nombre');
const campoCorreo = document.querySelector('#campo-correo');
const campoPago = document.querySelector('#campo-pago');
const listaErrores = document.querySelector('#lista-errores');
const panelExito = document.querySelector('#panel-exito');
const resumenFuncion = document.querySelector('#resumen-funcion').querySelector('span');
const resumenPrecio = document.querySelector('#resumen-precio');

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
let funcionActual = null;
let asientoIds = [];

function leerURL() {
    const params = new URLSearchParams(window.location.search);
    const n = Number(params.get('funcion'));
    funcionActual = Number.isInteger(n) && n > 0 ? n : null;
    asientoIds = (params.get('asientos') || '').split(',').map(Number).filter(n => Number.isInteger(n) && n > 0);
}

async function cargarResumen() {
    leerURL();
    if (!funcionActual || asientoIds.length === 0) {
        resumenFuncion.textContent = 'Sin función o asientos en la URL — llega aquí desde el mapa de asientos.';
        form.hidden = true;
        return;
    }
    const funcion = await (await fetch('/api/funciones/' + funcionActual)).json();
    resumenFuncion.textContent = funcion.pelicula_titulo + ' · ' + funcion.sala_nombre +
        ' · ' + funcion.fecha + ' ' + funcion.hora + ' · ' + asientoIds.length + ' asiento(s)';
    resumenPrecio.textContent = '$' + funcion.precio * asientoIds.length + ' MXN';
}

// Validación del cliente: rechaza entradas inválidas con mensajes claros.
function validarFormulario() {
    const errores = [];
    if (campoNombre.value.trim().length < 3) errores.push('El nombre debe tener al menos 3 caracteres.');
    if (!EMAIL_RE.test(campoCorreo.value.trim())) errores.push('El correo no tiene un formato válido.');
    if (!campoPago.checked) errores.push('Debes aceptar el pago simulado para confirmar.');
    if (asientoIds.length === 0) errores.push('No llegaron asientos desde el mapa.');
    if (errores.length > 0) {
        listaErrores.hidden = false;
        listaErrores.innerHTML = errores.map(e => '<li>' + e + '</li>').join('');
        return false;
    }
    listaErrores.hidden = true;
    return true;
}

form.addEventListener('submit', async (evento) => {
    evento.preventDefault();
    if (!validarFormulario()) return;

    // POST /api/reservaciones: el servidor valida, calcula el total definitivo
    // e impide la doble reserva del mismo asiento (rubricas 05-07).
    const respuesta = await fetch('/api/reservaciones', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            funcion_id: funcionActual,
            asiento_ids: asientoIds,
            nombre: campoNombre.value.trim(),
            correo: campoCorreo.value.trim()
        })
    });
    const cuerpo = await respuesta.json();

    if (respuesta.status === 409) {
        // Conflictos de asiento: mensaje claro con la lista (guía, pág. 4).
        listaErrores.hidden = false;
        listaErrores.innerHTML = ('El servidor rechazó la reserva: ' + (cuerpo.mensaje || '') +
            (cuerpo.asientos_en_conflicto ? ' → ' + cuerpo.asientos_en_conflicto.join(', ') : '') +
            '. Vuelve al mapa y elige otros asientos.').split('\n');
        return;
    }
    if (!respuesta.ok) {
        listaErrores.hidden = false;
        listaErrores.innerHTML = ('El servidor rechazó los datos: ' +
            (cuerpo.errores ? cuerpo.errores.join(' · ') : cuerpo.mensaje)).split('\n');
        return;
    }

    // Éxito (201): pago simulado registrado; mostramos el folio generado.
    form.hidden = true;
    panelExito.hidden = false;
    document.querySelector('#exito-folio').textContent = cuerpo.folio;
    document.querySelector('#exito-asientos').textContent = cuerpo.asientos.join(', ');
    document.querySelector('#exito-total').textContent = '$' + cuerpo.total + ' MXN';
    document.querySelector('#exito-ver-boleto').href =
        'boletos.html?folio=' + encodeURIComponent(cuerpo.folio) +
        '&correo=' + encodeURIComponent(campoCorreo.value.trim());
    window.scrollTo({ top: 0, behavior: 'smooth' });
});

cargarResumen().catch(() => {
    resumenFuncion.textContent = 'No se pudo consultar la API. Revisa que el servidor esté funcionando (npm start).';
});
