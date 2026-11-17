// CinePass — Módulo 06: consultar reservación y mostrar boleto digital.
// La API exige folio + correo (no se muestran reservaciones ajenas con solo
// conocer un ID), y la cancelación solo procede cuando las reglas lo permiten.
const form = document.querySelector('#form-consulta');
const campoFolio = document.querySelector('#campo-folio');
const campoCorreo = document.querySelector('#campo-correo');
const listaErrores = document.querySelector('#lista-errores');
const zona = document.querySelector('#zona-boleto');

// Permite llegar aquí desde la confirmación con los datos ya escritos.
const params = new URLSearchParams(window.location.search);
campoFolio.value = params.get('folio') || '';
campoCorreo.value = params.get('correo') || '';

function mostrarErrores(mensaje) {
    listaErrores.hidden = !mensaje;
    if (mensaje) listaErrores.textContent = mensaje;
}

function estadoClase(estado) {
    return estado === 'activa' ? 'estado-activa' : 'estado-cancelada';
}

// Comprobante digital con botón de cancelación cuando aplica.
function boletoHTML(b) {
    const cancelable = b.estado === 'activa';
    return `
        <article class="boleto">
            <div class="boleto-cab">
                <strong>Boleto CinePass</strong>
                <img src="img/logo-cinepass.svg" alt="">
            </div>
            <div class="boleto-cuerpo">
                <div class="boleto-fila"><span>Película</span><span>${b.pelicula_titulo}</span></div>
                <div class="boleto-fila"><span>Función</span><span>${b.fecha} · ${b.hora} · ${b.sala_nombre}</span></div>
                <div class="boleto-fila"><span>Butacas</span><span>${b.asientos.join(', ')}</span></div>
                <div class="boleto-fila"><span>Titular</span><span>${b.cliente_nombre} (${b.cliente_correo})</span></div>
                <div class="boleto-fila"><span>Estado</span><span class="${estadoClase(b.estado)}">${b.estado}</span></div>
                <div class="boleto-fila" style="border-bottom:none"><span>Total (pago simulado)</span><span><strong>$${b.total} MXN</strong></span></div>
                <p style="margin:6px 0 0;font-size:13px;color:#5a6780">Folio</p>
                <p class="folio" style="margin:0">${b.folio}</p>
            </div>
            <div class="boleto-pie">
                <span>Presenta este folio en la funciones.</span>
                ${cancelable ? `<button class="btn-mini peligro" data-folio="${b.folio}" data-correo="${b.cliente_correo}">Cancelar reservación</button>` : '<span>—</span>'}
            </div>
        </article>`;
}

async function buscarBoleto() {
    mostrarErrores(null);
    if (!campoFolio.value.trim() || !campoCorreo.value.trim()) {
        mostrarErrores('Escribe el folio Y el correo con el que reservaste.');
        return;
    }
    const url = '/api/reservaciones?folio=' + encodeURIComponent(campoFolio.value.trim()) +
        '&correo=' + encodeURIComponent(campoCorreo.value.trim());
    const respuesta = await fetch(url);
    const cuerpo = await respuesta.json();

    if (respuesta.status === 404) { mostrarErrores('No hay una reservación con ese folio y correo.'); zona.innerHTML = ''; return; }
    if (!respuesta.ok) { mostrarErrores((cuerpo.mensaje || 'La API respondió ' + respuesta.status) + ' ' + (cuerpo.errores ? cuerpo.errores.join(' · ') : '')); zona.innerHTML = ''; return; }

    zona.innerHTML = boletoHTML(cuerpo);
    // Delegación de eventos: un solo oyente para los botones de cancelar.
    zona.querySelectorAll('button.btn-mini').forEach(boton => {
        boton.addEventListener('click', async () => {
            const r = await fetch('/api/reservaciones/cancelar', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ folio: boton.dataset.folio, correo: boton.dataset.correo })
            });
            const cb = await r.json();
            if (r.ok) { mostrarErrores('Reservación ' + cb.folio + ' cancelada (' + cb.cancelados + ' asientos liberados).'); }
            else { mostrarErrores('No se pudo cancelar: ' + (cb.mensaje || r.status)); }
            buscarBoleto();
        });
    });
}

form.addEventListener('submit', (e) => { e.preventDefault(); buscarBoleto(); });

// Si llegamos con parámetros desde la confirmación, buscamos de una vez.
if (campoFolio.value && campoCorreo.value) buscarBoleto();
