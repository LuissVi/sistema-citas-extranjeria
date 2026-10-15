# Roadmap

Documento con mejoras planificadas, decisiones aplazadas conscientemente y posibles evoluciones del modelo de datos.

El objetivo es no perder el contexto de las decisiones que se han tomado durante el desarrollo. Cuando en el futuro se retome el proyecto, este documento sirve como guía para saber **qué se dejó fuera, por qué, y cómo retomarlo**.

El README explica **lo que el sistema es hoy**. Este documento explica **lo que podría llegar a ser**.
---

## Índice

- [🎯 Fase 2 — Mejoras planificadas](#-fase-2--mejoras-planificadas)
- [⏸️ Decisiones aplazadas conscientemente](#️-decisiones-aplazadas-conscientemente)
- [🔮 Evoluciones posibles del modelo](#-evoluciones-posibles-del-modelo)
---

## 🎯 Fase 2 — Mejoras planificadas

### 1. Frontend (HTML + JS)

 - **Qué:** pantallas del flujo completo (provincia → oficina → trámite → datos del solicitante → menú → solicitar / consultar / anular).
 - **Por qué se dejó:** el backend ya demuestra la lógica; el frontend es una capa aparte que se puede hacer cuando el backend esté pulido.
 - **Cambios necesarios:** nuevo directorio `public/` o `frontend/`, servido como estático desde Express con `express.static()`.

### 2. Autenticación con JWT
 - **Qué:** login de usuario (usuario + contraseña) que devuelve un token JWT.
Middleware que verifique el token en cada petición protegida.
- **Por qué se dejó:** fuera del alcance del proyecto (flujo básico de citas).
El NIE es un identificador, no un mecanismo de autenticación.
- **Cambios necesarios:**
  - Tabla `usuarios` con `password_hash` (bcrypt).
  - Endpoint `POST /login`.
  - Middleware `autenticar` que verifique el token.
  - Endpoints protegidos (`DELETE /anular/:citaId`, admin, etc.).

### 3. Histórico de citas (`citas_historico`)

- **Qué:** cuando se anula o expira una cita, **archivarla** en lugar de borrarla. Snapshot desnormalizado (con nombres, no solo IDs).
- **Por qué se dejó:** complejidad adicional (transacción de archivado, tabla nueva, endpoint de consulta de histórico).
- **Cambios necesarios:**
  - Tabla `citas_historico` con `archivado_en` y datos completos.
  - Modificar `anularCita()` para hacer `INSERT` + `DELETE` en transacción.
  - Renombrar la función a `archivarCita()` (refleja la nueva intención).
  - Endpoint `GET /historico?nie=X` (opcional).

### 4. Calendario de festivos (`dias_cerrados`)

- **Qué:** evitar días festivos (nacionales, autonómicos, locales) además de sábados y domingos.
- **Por qué se dejó:** requiere una tabla con datos, lógica de excepciones por oficina, y mantenimiento anual.
- **Cambios necesarios:**
  - Tabla `dias_cerrados` (fecha + ámbito + descripción).
  - Modificar `esDiaLaborable()` para consultar la tabla.
  - Considerar excepciones por oficina (una columna `oficina_id` opcional).

### 5. Capacidad por oficina

- **Qué:** permitir N reservas por hueco (varias ventanillas).
- **Por qué se dejó:** simplificación consciente. Una oficina = una
ventanilla en este prototipo.
- **Cambios necesarios:**
  - Columna `capacidad INTEGER DEFAULT 1` en `oficinas`.
  - Sustituir el `UNIQUE (oficina_id, fecha_hora)` por un contador de reservas activas por hueco.
  - Añadir validación en `reservarCita()`.

### 6. Validación estricta del NIE

- **Qué:** validar la letra de control del NIE con el algoritmo módulo 23 que usa Extranjería.
- **Por qué se dejó:** no aporta valor al usuario final (escribe su NIE real), puede rechazar NIEs antiguos, y requiere implementación + tests.
- **Cambios necesarios:**
  - Módulo `validaciones/nie.js` con la lógica.
  - Tests con casos conocidos.
  - Reemplazar la regex actual por la llamada a `validarNie()`.

### 7. Limpieza periódica de citas

- **Qué:** además de limpiar al arrancar, permitir disparar la limpieza de citas viejas **a demanda**, con registro de cada ejecución.
- **Contexto:** actualmente, `limpiarCitasPasadas()` solo se ejecuta al arrancar el servidor. Esto es suficiente para un prototipo, pero en producción el servidor puede estar activo durante días o semanas sin reiniciarse. En ese caso, las citas viejas se acumulan.

**Dos disparadores, un endpoint:**

1. **Automático (cron job del hosting):** el hosting llama al endpoint una vez al día. Garantiza que la limpieza se hace regularmente.
2. **Manual (botón en panel de admin):** el admin puede disparar la limpieza cuando quiera. Útil para mantenimiento puntual.
Ambos disparadores llaman al **mismo endpoint** protegido con API key.

**Por qué NO con `setInterval`:**

- En despliegues multi-instancia (Render, Railway, Fly.io escalan horizontalmente), **cada instancia tendría su propio `setInterval`**. Todas limpiarían a la vez → contención innecesaria en SQLite.
- El intervalo **no se sincroniza con la medianoche**. Si el servidor arranca a las 09:00, el `setInterval` dispara a las 09:00 del día siguiente, no a las 00:00.
- Si el proceso muere, el timer muere con él. Un cron externo es independiente del ciclo de vida del servidor.

**Cambios necesarios:**

- Endpoint `POST /admin/limpiar`:
  - Protegido con API key en cabecera (`Authorization: Bearer ...`).
  - Llama a `limpiarCitasPasadas()`.
  - Devuelve `{ ok: true, eliminadas: N }`.
- Guardar el secreto de la API key en `process.env.ADMIN_API_KEY`.
- **Registro de limpiezas** (dos opciones):

  **Opción A — tabla `meta` (mínimo):**
  - Tabla `meta` con `clave TEXT PRIMARY KEY, valor TEXT`.
  - Al terminar la limpieza, actualizar `meta('ultima_limpieza', timestamp)`.
  - El panel de admin lee ese valor y muestra "Última limpieza: hace X".

  **Opción B — tabla `limpiezas` (detallado):**
  - Tabla `limpiezas` con `id, ejecutada_en, eliminadas, origen`.
  - `origen` = `'arranque'` / `'cron'` / `'admin'` (saber por qué se hizo).
  - Se puede consultar el histórico de limpiezas, no solo la última.

  La Opción B es más completa: permite ver **la evolución** de las limpiezas y detectar problemas (¿por qué llevamos 3 días sin limpiar?). La Opción A es más simple.

- **Futuro panel de admin:** botón "Limpiar ahora" que llama al endpoint y muestra el resultado + la última limpieza registrada.

**Conexión con el histórico de citas:** si además se implementa el histórico (`citas_historico`), la limpieza podría **archivar** en lugar de borrar. Ver punto 3.

**Disparadores en el hosting:**

- **Render / Railway / Fly.io:** configurar "Cron Job" en el panel del hosting para que llame al endpoint diariamente.
- **Comando del cron:** `curl -X POST https://tu-app.com/admin/limpiar -H "Authorization: Bearer $ADMIN_API_KEY"`.
- **Horario:** por ejemplo, `0 3 * * *` (todos los días a las 3 AM).

### 8. `.env` + `dotenv`

- **Qué:** sacar configuración (puerto, secretos, API keys) a variables de entorno cargadas desde un archivo `.env`.
- **Por qué se dejó:** no hay secretos actualmente. `process.env.PORT` ya se usa con default, lo cual es suficiente.
- **Cambios necesarios:**
  - `npm install dotenv`.
  - `import 'dotenv/config'` al principio de `server.js`.
  - Crear `.env.example` (con las claves, sin valores).
  - Añadir `.env` al `.gitignore`.

### 9. Tests automatizados

- **Qué:** tests unitarios (lógica de negocio) e integración (endpoints).
- **Por qué se dejó:** no crítico para el alcance actual. La lógica ya se ha probado manualmente.
- **Cambios necesarios:**
  - `npm install --save-dev vitest supertest`.
  - Tests en `tests/` para `citas_logic.js` (unitarios).
  - Tests para los endpoints (integración, con supertest).
  - Script `npm test`.

### 10. Documentación con Swagger / OpenAPI

- **Qué:** documentación interactiva de la API, con ejemplos y posibilidad de probar los endpoints desde el navegador.
- **Por qué se dejó:** el README ya documenta los endpoints. Swagger añade una capa extra de trabajo.
- **Cambios necesarios:**
  - `npm install swagger-ui-express swagger-jsdoc`.
  - Anotaciones JSDoc en cada endpoint.
  - Endpoint `/docs` con la interfaz de Swagger.

### 11. WAL mode en SQLite

- **Qué:** activar el modo WAL (Write-Ahead Logging) para mejorar concurrencia en SQLite.
- **Por qué se dejó:** no hay problemas de concurrencia actualmente (proyecto de portfolio, poca carga).
- **Cambios necesarios:**
  - Añadir `db.pragma('journal_mode = WAL')` en `db.js`.

### 12. Cubrir `usuarios.doc_numero` duplicado en race condition

- **Qué:** cuando dos peticiones simultáneas intentan crear el mismo NIE nuevo, una gana y la otra recibe `SQLITE_CONSTRAINT_UNIQUE` en `usuarios.doc_numero`. Hoy ese error se relanza como 500. Debería devolver un código de negocio claro (`NIE_DUPLICADO` o similar).

- **Por qué se dejó:** es un caso extremadamente raro. Solo ocurre cuando:
  - El NIE **no existe** todavía en el sistema.
  - **Dos peticiones** con ese NIE llegan **casi al mismo tiempo**.
  - **Ambas** pasan el `SELECT` de "¿existe usuario?" antes de que la otra haya hecho el `INSERT`.

En la práctica, con un solo usuario probando, es imposible de reproducir.
El `UNIQUE (citas.usuario_id)` ya cubre el caso más común (usuario existente reservando dos veces).

**Cambios necesarios:**
- Añadir un `case` más en el `catch` de `reservarCita`:
  ```js
  if (err.message.includes('usuarios.doc_numero')) {
      return { ok: false, codigo: 'NIE_DUPLICADO', motivo: '...' };
  }

### 13. Logging estructurado

- **Qué:** sustituir `console.log`/`console.error` por un logger profesional
(pino, winston) que escriba a archivos y/o servicios externos.
- **Por qué se dejó:** `console` es suficiente para desarrollo y portfolio.
- **Cambios necesarios:**
  - `npm install pino`.
  - Logger global en `utils/logger.js`.
  - Reemplazar `console.*` por `logger.*`.

### 14. Seguridad de cabeceras (Helmet)

- **Qué:** añadir cabeceras HTTP de seguridad (CSP, HSTS, X-Frame-Options...).
- **Por qué se dejó:** no crítico para un proyecto de portfolio sin usuarios reales.
- **Cambios necesarios:**
  - `npm install helmet`.
  - `app.use(helmet())` en `server.js`.

### 15. CORS

- **Qué:** permitir peticiones desde dominios distintos (útil si el frontend está desplegado en otro host).
- **Por qué se dejó:** frontend y backend se servirán desde el mismo origen en este proyecto.
- **Cambios necesarios:**
  - `npm install cors`.
  - `app.use(cors({ origin: 'https://frontend.com' }))` en `server.js`.
---

## ⏸️ Decisiones aplazadas conscientemente

Estas son decisiones que se tomaron en su momento **sabiendo que dejaban una limitación**, y que se aplazan deliberadamente. No son "olvidos": son **trade-offs asumidos**.

### Sin autenticación

El NIE **no es un mecanismo de autenticación**, es un identificador público. Cualquiera que sepa un `citaId` puede anular una cita. En un sistema real esto sería un agujero de seguridad. **Se aplaza hasta que exista una capa de autenticación real (JWT).**

### Sin histórico

Las citas anuladas se borran **definitivamente**. No hay registro de qué citas hubo. Esto simplifica el modelo, pero impide auditoría o estadísticas. **Se aplaza hasta que se implemente `citas_historico`.**
     
### Sin festivos

Solo se evitan sábados y domingos. **Los festivos nacionales, autonómicos y locales no se consideran.** En España esto es relevante (hay ~12 festivos al año). **Se aplaza hasta que se implemente `dias_cerrados`.**

### Sin capacidad por oficina

Cada oficina tiene **una sola ventanilla** (implícita). No se puede reservar más de una cita por hueco. **Se aplaza hasta que se añada la columna `capacidad`.**

### Sin validación estricta del NIE

Solo se valida el **formato** (`X/Y/Z + 7 dígitos + letra`), no que la letra de control sea correcta. **Se aplaza por falta de valor real para el usuario y por riesgo de rechazar NIEs legítimos con formatos especiales.**

### Sin `setInterval` para limpieza

La limpieza de citas viejas **solo ocurre al arrancar el servidor**. No hay limpieza periódica automática. **Se aplaza por los problemas conocidos de `setInterval` en despliegues multi-instancia** (todas las instancias
limpiarían a la vez). La solución correcta (cron externo + endpoint admin) es más trabajo y se hará en Fase 2.

### Sin `.env`

La configuración se maneja con `process.env.PORT` con default. **No hay secretos actualmente**, así que no hay nada que proteger. **Se aplaza hasta que aparezcan secretos reales (JWT secret, API keys, etc.).**
---

## 🔮 Evoluciones posibles del modelo

Escenarios hipotéticos y **cómo se abordarían**. Son útiles para entender que el modelo actual no es rígido: se puede evolucionar.

### ¿Y si cada oficina tiene varias ventanillas?

**Situación:** una oficina puede atender a varias personas a la vez (varios funcionarios). 

**Cambio:** añadir `capacidad INTEGER DEFAULT 1` en `oficinas`. Sustituir
el `UNIQUE (oficina_id, fecha_hora)` por un **contador de reservas activas**: en lugar de "una reserva por hueco", sería "hasta N reservas por hueco".

**Impacto:** cambia la validación de `reservarCita()` (de "no existe ninguna" a "hay menos de N"). Requiere consulta agregada en lugar de consulta puntual.

### ¿Y si cada trámite tiene su propia agenda?

**Situación:** la oficina tiene funcionarios especializados por trámite (ventanilla NIE, ventanilla TIE, etc.), cada una con su propia cola.

**Cambio:** el `UNIQUE` de `citas` pasaría a ser `(oficina_id, tramite_id, fecha_hora)`. `obtenerHorariosDisponibles()` filtraría también por `tramite_id`.

**Impacto:** afecta a la decisión clave del proyecto. Cambia el modelo de "una agenda por oficina" a "una agenda por trámite en cada oficina". La consulta de disponibilidad cambia para recibir también `tramiteId`.

### ¿Y si un usuario puede tener varias citas activas?

**Situación:** un usuario quiere reservar varias citas (para distintos trámites, o para varias personas de la misma familia).

**Cambio:** quitar el `UNIQUE (usuario_id)` de `citas`. Permitir N citas por usuario.

**Situación:** un usuario quiere reservar varias citas (para distintos trámites, o para varias personas de la misma familia).

**Cambio:** quitar el `UNIQUE (usuario_id)` de `citas`. Permitir N citas por usuario.

**Impacto:** el endpoint `GET /consultar?nie=X` tendría que devolver un array en vez de un objeto. El flujo de anulación tendría que mostrar todas las citas y dejar elegir cuál anular.

### ¿Y si quiero servir en varios idiomas?

**Situación:** el frontend debe soportar español, inglés, catalán, etc.

**Cambio:** integrar una librería de internacionalización (`i18next`). Los mensajes de error del backend (`motivo`) pasarían a ser **códigos** que el frontend traduce, o se internacionalizarían en el backend.

**Impacto:** todas las `motivo` de los errores actuales tendrían que cambiar. El contrato de error pasaría a tener `codigo` como fuente de verdad y `motivo` como traducción por defecto.

### ¿Y si quiero notificar por email?

**Situación:** al reservar o anular una cita, enviar un email de confirmación al usuario.

**Cambio:** integrar un servicio de email (SendGrid, Mailgun, Resend). Añadir un campo `email` a `usuarios`. Enviar tras la transacción (no dentro, para no bloquearla).

**Impacto:** los endpoints `POST /reservar` y `DELETE /anular/:citaId` tendrían que disparar el envío. Considerar hacerlo asíncrono (cola de trabajos) para no bloquear la respuesta.

## 📌 Notas finales

Este documento **no es una promesa**, es una **guía viva**. Las prioridades
pueden cambiar con el tiempo, y algunas entradas pueden volverse
irrelevantes o urgentes según cómo evolucione el proyecto.

Su propósito es servir como **punto de partida** cuando se retome el
desarrollo, evitando tener que reconstruir desde cero el contexto de las
decisiones tomadas.

*Última revisión: 2026-10-14.*