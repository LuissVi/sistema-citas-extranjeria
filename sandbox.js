//ARCHIVO DE PRUEBAS
// sandbox.js — archivo de pruebas manuales durante el desarrollo.
// NO es un test automatizado. Se ejecuta con `node sandbox.js`.
import {
  obtenerProvincias,
  obtenerOficinasPorProvincia,
  obtenerTramitesPorOficina,
  obtenerHorariosDisponibles,
  obtenerPrimeraDisponibilidad,
  consultarCitaPorNie,
  esFechaFutura,
  horaValida,
  esDiaLaborable,
  reservarCita,
  anularCita,
  limpiarCitasPasadas
} from "./citasLogic.js";

console.log('provincias:', obtenerProvincias('Madrid'));
console.log('oficinas Madrid:', obtenerOficinasPorProvincia('madrid'));
console.log('trámites oficina 2:', obtenerTramitesPorOficina(7));

//prueba de horarios disponibles
console.log('Obtener horarios disponibles: ', obtenerHorariosDisponibles(1111, '2026-09-21'));

console.log('=== 1. Primera disponibilidad oficina 1, desde 21/09/2026 ===');
console.log(obtenerPrimeraDisponibilidad(1,'2026-09-21'));

console.log('\n=== 2. Primera disponibilidad oficina 1, sin fecha (mañana) ===');
console.log(obtenerPrimeraDisponibilidad(1));

console.log('\n=== 3. Primera disponibilidad oficina 4, desde 22/09/2026 ===');
console.log(obtenerPrimeraDisponibilidad(4, '2026-09-22'));

console.log('\n=== 4. Primera disponibilidad oficina 3, desde 23/09/2026 ===');
console.log(obtenerPrimeraDisponibilidad(3, '2026-09-23'));

console.log('\n=== 5. Caso null: oficina 999 (no existe) ===');
console.log(obtenerPrimeraDisponibilidad(999, '2026-09-25'));

//consulta de cita
console.log('\n=== 6. consulta de cita existente');
console.log(consultarCitaPorNie('X1234567A'))
console.log('\n=== 7. consulta de cita inexistente');
console.log(consultarCitaPorNie('X1234568A'))

console.log('=====verificar fecha que no sea pasada======');
console.log(esFechaFutura('2026-09-30'));

console.log('=====validar Fecha verificar hora valida======');
console.log(horaValida('15:00'));

console.log('=====verificar si es dia laborable======');
console.log(esDiaLaborable('2026-09-26'));

console.log('=====PRUEBA RESERVA DE CITA======');
console.log(reservarCita(1,3,'2026-10-08','11:30',{nroNie:'J1234567P',nombre:'Carmen Arias Soto', pais:'Peru'}));
console.log('===========');
// 1. Mismo hueco otra vez → SLOT_OCUPADO
console.log('Slot ocupado:', reservarCita(2, 6, '2026-10-02', '12:00', {
  nroNie: 'TEST002', nombre: 'Otro User', pais: 'Chile'
}));

// 2. Mismo usuario reservando otra vez → YA_TIENE_CITA
console.log('Ya tiene cita:', reservarCita(2, 4, '2026-10-06', '11:00', {
  nroNie: 'W1234567V', nombre: 'Miguel', pais: 'Cuba'
}));

// 3. Oficina inexistente
console.log('Oficina no existe:', reservarCita(999, 1, '2026-10-05', '10:00', {
  nroNie: 'TEST003', nombre: 'User', pais: 'Perú'
}));

// 4. Fecha pasada
console.log('Fecha pasada:', reservarCita(1, 1, '2020-01-01', '10:00', {
  nroNie: 'TEST004', nombre: 'User', pais: 'Perú'
}));

// 5. Sábado
console.log('Sábado:', reservarCita(1, 1, '2026-10-03', '10:00', {
  nroNie: 'TEST005', nombre: 'User', pais: 'Perú'
}));

// 6. Hora inválida
console.log('Hora inválida:', reservarCita(1, 1, '2026-10-05', '15:00', {
  nroNie: 'TEST006', nombre: 'User', pais: 'Perú'
}));

// 7. Trámite incorrecto (que no pertenece a la oficina)
console.log('Trámite incorrecto:', reservarCita(1, 7, '2026-10-05', '10:00', {
  nroNie: 'TEST007', nombre: 'User', pais: 'Perú'
}));

// 8. Mismo usuario reservando otra vez → YA_TIENE_CITA
console.log('Ya tiene cita:', reservarCita(2, 7, '2026-10-06', '11:00', {
  nroNie: 'W1234567V', nombre: 'Miguel', pais: 'Cuba'
}));

//9. Eliminar cita
console.log('ELIMINAR CITA: ', anularCita(4));

console.log(limpiarCitasPasadas());
