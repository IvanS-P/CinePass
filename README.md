# CinePass

Proyecto final de Programación Web.

Aplicación web para consultar películas, seleccionar funciones,
reservar asientos y gestionar boletos digitales.

## Tecnologías

- HTML
- CSS
- JavaScript
- Node.js
- Express
- SQLite (módulo integrado `node:sqlite` de Node.js 24+, capa `src/db.js`)
- Pruebas de API con PowerShell (`tests/api-test.ps1`)

## Instalación

1. Instalar Node.js (24 o superior).
2. Clonar el repositorio.
3. Ejecutar `npm ci`.
4. Ejecutar `npm start` (abre en http://localhost:3000; admite `PORT`).
5. La base de datos `data/cinepass.sqlite` se crea y se rellena sola al arrancar.

Pruebas de la API (con el servidor arrancado): `pwsh -File tests/api-test.ps1`.

## Estado actual

- Inicio: rediseñado según la referencia (hero centrado con logo, carrusel
  de destacadas con flechas, avatar en el encabezado y chat flotante); las
  tarjetas se sirven desde la API.
- Cartelera: versión inicial con buscador, ahora alimentada por la API.
- Módulos 03-07 de la guía: detalle de película, selección de asientos,
  confirmación con pago simulado, Mis boletos (folio + correo) y panel de
  administración con CRUD completo desde la interfaz.
- API REST con GET/POST/PUT/DELETE, JSON y códigos HTTP; la doble reserva y
  el acceso de administración se restringen EN EL SERVIDOR (guía, págs. 4-6).
- Pendientes de equipo: video demostración (12-15 min) y despliegue en
  GitHub Pages.

Acceso de administración (demo del equipo): usuario `admin`,
contraseña `cinepass2026` (viene de `CINEPASS_ADMIN_USUARIO` /
`CINEPASS_ADMIN_CLAVE` si se define un `.env`).

Datos de prueba del módulo Mis boletos: folio `CP-0001` con correo
`equipo@cinepass.local` (reserva activa de muestra con asientos B3/B4).

## Entidades (guía, pág. 7)

película → funciones → sala → asientos → reservación (folio CP-XXXX).
Clave: un asiento pertenece a una sala, pero está ocupado **por función**;
un índice único parcial impide dos reservas activas del mismo
función-asiento, incluso en competencia.

## Colaboración

Cada integrante trabajará en una rama propia.
Los cambios se integrarán mediante pull requests.
