// CinePass: búsqueda y filtro de películas de muestra.
// Más adelante estas tarjetas se cargarán desde la API REST.
const buscador = document.querySelector("#buscar-pelicula");
const selectorGenero = document.querySelector("#filtrar-genero");
const tarjetas = Array.from(document.querySelectorAll("#lista-peliculas .tarjeta"));
const contador = document.querySelector("#contador-peliculas");
const mensaje = document.querySelector("#sin-resultados");

function normalizar(texto) {
    return texto.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
}

function filtrarPeliculas() {
    const busqueda = normalizar(buscador.value);
    const generoElegido = selectorGenero.value;
    let visibles = 0;

    tarjetas.forEach((tarjeta) => {
        const coincideTitulo = normalizar(tarjeta.dataset.titulo).includes(busqueda);
        const coincideGenero = generoElegido === "todos" || tarjeta.dataset.genero === generoElegido;
        const mostrar = coincideTitulo && coincideGenero;

        tarjeta.hidden = !mostrar;
        if (mostrar) visibles++;
    });

    contador.textContent = `Mostrando ${visibles} de ${tarjetas.length} películas de ejemplo`;
    mensaje.hidden = visibles !== 0;
}

buscador.addEventListener("input", filtrarPeliculas);
selectorGenero.addEventListener("change", filtrarPeliculas);
filtrarPeliculas();
