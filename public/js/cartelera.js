const buscador = document.querySelector("#buscar-pelicula");
const tarjetas = document.querySelectorAll(".tarjeta");
const mensaje = document.querySelector("#sin-resultados");

buscador.addEventListener("input", () => {
    const busqueda = buscador.value.toLowerCase().trim();
    let encontradas = 0;

    tarjetas.forEach((tarjeta) => {
        const titulo = tarjeta
            .querySelector("h2")
            .textContent.toLowerCase();

        const coincide = titulo.includes(busqueda);

        tarjeta.hidden = !coincide;

        if (coincide) {
            encontradas++;
        }
    });

    mensaje.hidden = encontradas > 0;
});
