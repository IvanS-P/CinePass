const express = require("express");
const path = require("node:path");

const app = express();
const PORT = 3000;

// Permite recibir información JSON
app.use(express.json());

// Carpeta de archivos públicos
app.use(express.static(
    path.join(__dirname, "../public")
));

// Primera ruta de prueba de CinePass
app.get("/api/salud", (req, res) => {
    res.status(200).json({
        proyecto: "CinePass",
        estado: "Funcionando",
        mensaje: "Servidor conectado correctamente"
    });
});

// Iniciar servidor
app.listen(PORT, () => {
    console.log(
        `CinePass funcionando en http://localhost:${PORT}`
    );
});
