# Sistema de Citas para Oficinas de Extranjería

API REST para gestionar citas de oficinas de extranjería: reservar, consultar
y anular. Implementada con Node.js, Express y SQLite. Valida fechas laborables,
horarios de atención y garantiza la consistencia mediante **transacciones**.

## 🚀 Stack

- Node.js (ESM)
- Express
- SQLite (better-sqlite3)

## 🏃 Cómo arrancarlo

### Requisitos
- Node.js 20+

### Pasos
1. Clonar el repositorio: `git clone https://github.com/LuissVi/sistema-citas-extranjeria.git && cd sistema-citas-extranjeria`.
2. Instalar dependencias: `npm install`
3. Poblar la base de datos: `node seed.js`
4. Arrancar el servidor: `node server.js` o `npm start`
5. Comprobar: `curl http://localhost:3000/ping`

## 📚 Endpoints

| Método | Endpoint | Descripción |
|---|---|---|
| GET | `/ping` | Health check |
| GET | `/provincias` | Listar provincias |
| GET | `/oficinas?provincia=X` | Oficinas filtradas por provincia |
| GET | `/tramites?oficinaId=X` | Trámites de una oficina |
| GET | `/disponibilidad?oficinaId=X` | Primera fecha con huecos |
| POST | `/reservar` | Crear una reserva |
| GET | `/consultar?nie=X` | Ver la cita activa de un NIE |
| DELETE | `/anular/:citaId` | Anular una cita |

### Ejemplo: reservar una cita

**Request:**
```http
POST /reservar
Content-Type: application/json

{
  "oficinaId": 1,
  "tramiteId": 1,
  "fecha": "2026-10-15",
  "hora": "09:30",
  "nie": "X1234567L",
  "nombre": "Juan Pérez",
  "pais": "Argentina"
}
```

**Response (201):**
`{ "ok": true, "citaId": 10 }`

### Ejemplo: error de slot ocupado

**Response (409):**
`{
  "ok": false,
  "codigo": "SLOT_OCUPADO",
  "motivo": "..."
}`

## 🧠 Decisiones de diseño

### ¿Por qué el UNIQUE de citas es (oficina_id, fecha_hora) y no incluye tramite_id?
Cada oficina tiene una única agenda compartida por todos los trámites. Es decir, cada hueco (oficina + fecha + hora) solo puede reservarse una vez, sin importar el trámite.

- **Ejemplo**: si alguien reserva las 09:00 del martes en la oficina 1, ese hueco queda ocupado para todos: nadie más podrá reservarlo, ni para NIE ni para TIE ni para ningún otro trámite.
- **Por qué**: modelar una oficina con varias agendas paralelas (una por trámite) añade complejidad sin beneficio real en este escenario. El sistema simplifica el modelo asumiendo una sola ventanilla por oficina.
Si en el futuro cada oficina tuviera varias ventanillas o funcionarios especializados por trámite, este diseño tendría que cambiar (el UNIQUE pasaría a incluir tramite_id o se añadiría una columna de capacidad).

### ¿Por qué anular una cita que no existe no da error?

El DELETE es **idempotente**: si la cita no existe, devuelve 200 igual. El término técnico es "idempotencia", y significa que aplicar la misma operación varias veces tiene el mismo resultado. Anular significa "asegurarse de que esa cita ya no está". Si ya estaba anulada (o nunca existió), el objetivo ya está cumplido: la cita ya no está.

- **Por qué:** el endpoint siempre devuelve éxito, hayas anulado una cita existente o no. Al llamarlo varias veces seguidas con el mismo ID, el resultado es el mismo: **esa cita ya no existe**. Esto es una convención estándar en HTTP para el método DELETE.

### ¿Por qué todas las respuestas tienen la forma `{ ok, ... }`?

**Todas las respuestas de la API** —tanto si la operación fue bien como si falló— **tienen la misma forma básica**: un objeto JSON con un campo `ok` que indica si la operación se completó.

- **Ejemplos:**

- Respuesta de éxito:
```{ "ok": true, "provincias": ["Madrid", "Barcelona"] }```
- Respuesta de error:
```{ "ok": false, "codigo": "PROVINCIA_REQUERIDA", "motivo": "..." }```

- **Por qué:** esta uniformidad simplifica el código del cliente. El frontend solo tiene que comprobar un campo (ok) para saber si la operación fue bien, sin importar el endpoint que haya llamado. Además, es consistente con la capa de negocio, que ya devuelve { ok, ... } en sus resultados.
- **Extensible:** si en el futuro se quiere añadir más información a una respuesta (por ejemplo, el número total de provincias), simplemente se añade un campo nuevo al objeto. Los clientes existentes lo ignoran sin romperse.

### ¿Por qué la lógica de negocio está separada de la capa HTTP?
El código está dividido en dos capas con responsabilidades claras:

- **`citas_logic.js`** → contiene las **reglas del dominio**: qué es una cita,
  cuándo se puede reservar, qué validaciones aplicar, cómo calcular la disponibilidad. **No sabe nada de HTTP**: no usa `req`, `res`, ni `express`.
- **`routes/*.js`** → contiene la **capa HTTP**: define URLs, valida la forma de los datos de entrada, llama a `citas_logic.js`, y traduce los códigos de negocio a status HTTP. **No sabe nada de SQL**: no usa `db`.

**Ejemplo:** cuando llega un `POST /reservar`, el handler:
1. Valida que los campos vienen y tienen el formato correcto (tarea HTTP).
2. Llama a `reservarCita(...)` de `citas_logic.js`.
3. Según el resultado, decide el status HTTP y envía la respuesta.

La regla de negocio "un usuario no puede tener dos citas activas" **vive en `citas_logic.js`**, no en el handler.

**Por qué se decidió así:**

- **Testeable:** la lógica de negocio se puede probar sin levantar el servidor.
- **Reutilizable:** la misma lógica puede usarse desde una CLI, un cron job o tests, sin pasar por HTTP.
- **Cambios aislados:** modificar una regla de negocio no obliga a tocar las rutas, ni al revés.
- **Onboarding:** cada archivo tiene una única responsabilidad, es más fácil entender el proyecto.

**Contrapartida:** más archivos, más saltos entre ellos, y algo de código "de pegamento". Se asume el coste porque el proyecto ya tiene tamaño suficiente para que la separación aporte más que moleste.

**En un script pequeño, no se haría.** La separación se justifica cuando el proyecto crece.

## 🚧 Qué NO hace (y por qué)

- **Sin autenticación.** El NIE no es un mecanismo de autenticación; es solo un identificador. Cualquiera con un `citaId` puede anular una cita. En un sistema real habría login + autorización.
- **Sin histórico.** Las citas anuladas se borran definitivamente. En Fase 2 se añadiría una tabla `citas_historico`.
- **Sin limpieza periódica.** Las citas viejas solo se limpian al arrancar el servidor. En Fase 2 se añadiría un endpoint `/admin/limpiar` + cron job del hosting.
- **Sin festivos.** Solo se evitan sábados y domingos. En Fase 2 se añadiría una tabla `dias_cerrados`.
- **Sin capacidad por oficina.** Cada oficina tiene una sola ventanilla. En Fase 2 se añadiría una columna `capacidad` en `oficinas`.

## 🗺️ Roadmap (Fase 2)
Ver [ROADMAP.md](./ROADMAP.md) para el detalle de las mejoras planificadas
y decisiones futuras.

- [ ] Frontend
- [ ] Autenticación JWT
- [ ] Histórico de citas
- [ ] Calendario de festivos
- [ ] Capacidad por oficina
- [ ] Validación estricta del NIE
- [ ] Limpieza periódica (cron + endpoint admin)
- [ ] .env + dotenv
- [ ] Tests automatizados

Detalle completo (con todas las mejoras técnicas) en [ROADMAP.md](./ROADMAP.md).

## 📁 Estructura del proyecto

```
sistemaCitas
├─ citasLogic.js       # Lógica de negocio (independiente de HTTP)
├─ db.js               # Conexión y esquema de SQLite
├─ package-lock.json
├─ package.json
├─ readme.md
├─ ROADMAP.md
├─ routes
│  ├─ catalogo.js       # /provincias, /oficinas, /tramites
│  └─ reservas.js       # /disponibilidad, /reservar, /consultar, /anular
├─ seed.js              # Datos iniciales de ejemplo
├─ server.js            # Punto de entrada: config, middleware, montaje de routers
├─ server.js                 
└─ test.js

```

## 📄 Licencia

MIT

