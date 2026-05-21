-- Tabla glosario ACK: estados por área con configuración de liberación
create table if not exists ack_glosario (
  id               uuid default gen_random_uuid() primary key,
  gap              text not null,
  area             text not null,
  secuencia        int,
  descripcion      text,
  gestion          text,
  se_puede_liberar boolean,   -- true=SI, false=NO, null=no aplica / no definido
  created_at       timestamptz default now(),
  unique (gap, area)
);

alter table ack_glosario enable row level security;

-- Lectura: todos los autenticados (necesario para filtro en Facturación)
create policy "ack_glosario_read" on ack_glosario
  for select to authenticated using (true);

-- Escritura: solo admin
create policy "ack_glosario_write" on ack_glosario
  for all to authenticated
  using (
    (select role from user_roles where id = auth.uid()) = 'admin'
  )
  with check (
    (select role from user_roles where id = auth.uid()) = 'admin'
  );

-- ── Seed: estados del glosario ────────────────────────────────────────
insert into ack_glosario (gap, area, secuencia, descripcion, gestion, se_puede_liberar) values

-- DOC
('0000.Sin Radicar',                          'DOC', 1,  'SMP integrado, con documentacion pendiente de carga en SP CLARO y/o confirmacion por correo de RNI a Nokia. (SLA Radicacion 4/6 dias despues de integracion)', 'SS_E2E', null),
('0100.Radicado/en revision CLARO',           'DOC', 2,  'Documentacion radicada en evaluacion por parte de auditor CLARO', 'Nokia', null),
('0020.Pte. devolucion material Nokia',       'DOC', 2,  null, null, null),
('0002.No radicado a Nokla/No ejecutado',     'DOC', 2,  null, null, null),
('0005.NDP revision DOC Nokia',               'DOC', 2,  null, null, null),
('0200.Radicado/Rechazado',                   'DOC', 3,  'Documentacion con pendientes de calidad, el SS debe atender un pendiente mayor (SLA subsanacion de 5 dias)', 'SS_E2E', null),
('0030.Aceptacion Nokia',                     'DOC', 3,  null, null, null),
('0010.Rechazo Nokia',                        'DOC', 3,  null, null, null),
('0250.Radicado/Subsanado',                   'DOC', 4,  'Documentacion subsanada en SFD, con o sin Logistica, en validacion de CLARO', 'Nokia', null),
('0050.No radicado/No ejecutado',             'DOC', 4,  null, null, null),
('0300.Pendiente devolucion material',        'DOC', 5,  'Documentacion completa y validada en SFD incluido HB, pendiente por logistica HFD, HFNI según aplique', 'SS_E2E', null),
('0060.sin radicar a CLARO/Cargado NDP 100%','DOC', 5,  null, null, null),
('0400.Completo 100%, notificado a Claro',    'DOC', 6,  'Documentacion completa incluyendo logistica, en espera de revision CLARO', 'Nokia', null),
('9999.Aprobado',                             'DOC', 7,  'Documentacion aprobada por CLARO', 'SS_E2E', null),
('0500.OT Approved/ Pdte.Notificar_Log_SS',  'DOC', 10, null, null, null),
('0500.OT Approved/ Pdte.Notificar_Log.SS',  'DOC', 11, null, null, null),

-- HW_Cierre
('0100.Proceso_Asignacion_HW',       'HW_Cierre', 1,  'Gestionar finalizacion de proceso asignacion de HW', 'SS_E2E', false),
('0150.Proceso_Picking',             'HW_Cierre', 2,  'Gestionar finalizacion de proceso picking de HW', 'SS_E2E', false),
('0170.HW_Cocepto_Externo',          'HW_Cierre', 3,  'Esperando concepto HW asociado al SMP en fuente externa', 'HW_Team', false),
('0200.Creacion_Sesion_SS_E2E',      'HW_Cierre', 4,  'Despachado sin creacion de sesion SS_E2E', 'SS_E2E', false),
('0250.Evaluacion_SS_E2E',           'HW_Cierre', 5,  'Sesion creada sin solicitud de evaluacion a HW_Team', 'SS_E2E', false),
('0300.Evaluacion_HW_Team',          'HW_Cierre', 6,  'Evaluacion solicitada sin concepto de HW_Team', 'HW_Team', false),
('0350.Evaluacion_Rechazo_SS_E2E',   'HW_Cierre', 7,  'Sesion de rechazo sin solicitud de evaluacion a HW_Team', 'SS_E2E', false),
('0400.Radicacion_Costumer_Audit',   'HW_Cierre', 8,  'Aprobacion HW_Team sin radicacion a cliente', 'HW_Team', true),
('0450.Evaluacion_Costumer_Audit',   'HW_Cierre', 9,  'Esperando concepto de auditor cliente', 'HW_Team', true),
('0500.Rechazado_Costumer_Audit',    'HW_Cierre', 10, 'Auditor cliente rechaza al menos una linea de la radicacion', 'HW_Team', true),
('0550.Proceso_GAP_OnAir',           'HW_Cierre', 11, 'Esperando estado maximo de OnAir', 'HW_Team', true),
('0600.Proceso_GAP_SO',              'HW_Cierre', 12, 'Esperando estado maximo de SO', 'HW_Team', true),
('0650.Proceso_LOG_INV',             'HW_Cierre', 13, 'Esperando estado procesado de LOG INV', 'SS_E2E', true),
('0700.Cierre_LOG_INV',              'HW_Cierre', 14, 'Verificacion lineas en actas de devolucion (Estado Temporal)', 'HW_Team', true),
('9999.Finalizado_SS_E2E',           'HW_Cierre', 15, 'Desbloqueo IA NDPD SS_E2E', 'Skytool', true),

-- LI
('0000.PreActas_SS_E2E',  'LI', 1, 'Esperando radicacion de PreActas', 'SS_E2E', null),
('0010.Iniciando',        'LI', 2, 'PreActas radicadas iniciando proceso de evaluacion para solucitud de firma', 'Nokia', null),
('0020.Esperando_Firma',  'LI', 3, 'Esperando firma del acta por parte de regional Claro', 'Nokia', null),
('0030.Solicitando_Cita', 'LI', 4, 'Firmas regional realizadas, solicitando cita a Almaviva', 'Nokia', null),
('0040.Conf_Cita',        'LI', 5, 'Esperando confirmacion de cita para entrega por parte de Almaviva', 'Nokia', null),
('0050.Programada_Cita',  'LI', 6, 'SMP con cita confirmada y programada', 'SS_E2E', null),
('0060.Feedback_Cita',    'LI', 7, 'Cita ejecutada esperando retroalimentacion del resultado', 'SS_E2E', null),
('0099.Procesado',        'LI', 8, 'Esperando concepto de DOC Nokia para cierre de LOG INV', 'SS_E2E', null),
('9999.Finalizado',       'LI', 9, 'SMP con LOG INV ejecutada y confirmacion de DOC Nokia', 'SS_E2E', null),

-- LOG_INV
('0100.PreActa_HFxx_SS_E2E',      'LOG_INV', 1,  null, null, null),
('0200.PreActa_HB_SS_E2E',        'LOG_INV', 2,  null, null, null),
('1000.Requerimiento_Baja_SS_E2E','LOG_INV', 3,  null, null, null),
('2010.Iniciando',                'LOG_INV', 4,  null, null, null),
('2020.Esperando_Firma',          'LOG_INV', 5,  null, null, null),
('2030.Solicitando_Cita',         'LOG_INV', 6,  null, null, null),
('2040.Conf_Cita',                'LOG_INV', 7,  null, null, null),
('2050.Programada_Cita',          'LOG_INV', 8,  null, null, null),
('2060.Feedback_Cita',            'LOG_INV', 9,  null, null, null),
('2099.Procesado',                'LOG_INV', 10, null, null, null),
('3010.Proceso_Transito',         'LOG_INV', 11, null, null, null),
('3020.Eval_Cierre_Transito',     'LOG_INV', 12, null, null, null),
('3050.Cierre_Descargos',         'LOG_INV', 13, null, null, null),
('3080.Eval_Cierre_Descargos',    'LOG_INV', 14, null, null, null),
('9999.Finalizado',               'LOG_INV', 15, null, null, null),

-- ONAIR
('10. En Revisión Calidad (NI)',                  'ONAIR', 1,  'SMP Integrado sin Encender LTE700MHz. Pendiente PostCheck Integración', 'SS_E2E', false),
('11. Pend HW (NI)',                              'ONAIR', 2,  'SMP Integrado sin Encender LTE700MHz. Pendiente HW para PostCheck Integración', 'SS_E2E', false),
('20. Primera Revisión NPO',                      'ONAIR', 3,  'SMP Recién Encendido LTE700MHz. En Primera revisión de KPIs de NPO', 'Nokia', false),
('21. En Revisión Optimización',                  'ONAIR', 4,  'SMP Rechazado por KPIs. En Revisión de NPO para dar concepto y acciones requeridas', 'Nokia', false),
('22. Segunda Revisión NPO',                      'ONAIR', 5,  'SMP solucionado o justificado en segunda revisión de KPIs.', 'Nokia', false),
('30. Revisión Instalación',                      'ONAIR', 6,  'Requiere Revisita para solucionar falla en Sitio.', 'SS_E2E', false),
('24. 5G Esperando Concepto Actividad Sinergia',  'OnAir', 6,  null, null, false),
('23. Revisión Caso Especial NPO',                'OnAir', 6,  null, null, false),
('31. Falla HW',                                  'ONAIR', 7,  'Requiere Revisita para solucionar falla en Sitio. HW identificado en falla que debe solicitarse en Skytool y con el ROM', 'SS_E2E', false),
('40. Recolectando Evidencias',                   'ONAIR', 8,  'SMP Supera Primer Filtro de Calidad para Enviar a aprobación de Claro', 'SS_E2E', true),
('33. Diferencia RTWP Entre Puertos',             'OnAir', 8,  null, null, false),
('50. Escalado a Claro',                          'ONAIR', 9,  'SMP escalado a Claro por un problema no atribuible a la implementación.', 'Nokia', false),
('34. Alto RTWP',                                 'OnAir', 9,  null, null, false),
('60. Pend Revisión RF-NOC',                      'ONAIR', 10, 'SMP en proceso de aprobación de RF Claro', 'Nokia', true),
('35. Otros KPIs',                                'OnAir', 10, null, null, false),
('61. Rechazado RF. Revisita',                    'ONAIR', 11, 'SMP rechazado por RF Claro. Requiere Intervención en Sitio', 'SS_E2E', true),
('36. Instalación/Integración',                   'OnAir', 11, null, null, false),
('62. Rechazado RF. Optimización',                'ONAIR', 12, 'SMP Rechazado por RF Claro. Requiere segundo concepto de Optimización', 'Nokia', true),
('37. Pend Reporte Radiante Aprobado',            'OnAir', 12, null, null, false),
('63. Rechazado RF. Reiniciado',                  'ONAIR', 13, 'SMP en proceso de aprobación de RF Claro', 'Nokia', true),
('40. Pend OT INT UMB',                           'OnAir', 13, null, null, true),
('41. Pend OT Acceso UMB',                        'OnAir', 13, null, null, true),
('64. Pend Revisión NOC',                         'ONAIR', 14, 'SMP en aprobación del NOC Claro', 'Nokia', true),
('65. Rechazado NOC. Revisita',                   'ONAIR', 15, 'SMP rechazado por NOC Claro. Requiere Intervención en Sitio', 'SS_E2E', true),
('43. Cargando Evidencias',                       'OnAir', 15, null, null, true),
('66. Rechazado NOC. Reiniciado',                 'ONAIR', 16, 'SMP en aprobación del NOC Claro', 'Nokia', true),
('45. Segunda Revisión SSV - Pend Espectro',      'OnAir', 16, null, null, true),
('67. Pend Marcar RFTool',                        'ONAIR', 17, 'SMP aprobado por RF y NOC. Pendiente administrativo de Claro', 'Nokia', true),
('46. OK SSV Pend Espectro',                      'OnAir', 17, null, null, true),
('9999. Producción',                              'ONAIR', 18, 'SMP Aceptado en Onair por Claro', 'SS_E2E', true),
('51. Falla Tx',                                  'OnAir', 18, null, null, false),
('52. Falla Energia',                             'OnAir', 19, null, null, false),
('53. Falla HW Existente',                        'OnAir', 20, null, null, false),
('56. Problema Acceso',                           'OnAir', 21, null, null, false),
('57. Problema Orden Público',                    'OnAir', 22, null, null, false),
('58. Problema de RF Claro',                      'OnAir', 23, null, null, false),
('62. Rechazado RF. Falla HW',                    'OnAir', 26, null, null, true),
('63. Rechazado RF. Optimización',                'OnAir', 27, null, null, true),
('64. Rechazado RF. Reiniciado',                  'OnAir', 28, null, null, true),
('65. Pend Revisión NOC',                         'OnAir', 29, null, null, true),
('66. Rechazado NOC. Falla HW',                   'OnAir', 30, null, null, true),
('67. Rechazado NOC. Revisita',                   'OnAir', 31, null, null, true),
('68. Rechazado NOC. Reiniciado',                 'OnAir', 32, null, null, true),
('69. Pend Marcar RFTool',                        'OnAir', 33, null, null, true),

-- SO
('0100.Configurando_OT',          'SO', 1,  'OT creada en Maximo iniciando carga de DOC en Maximo', 'SS_E2E', null),
('0200.Integrando',               'SO', 2,  'OT asociada en proceso de Integracion', 'SS_E2E', null),
('0300.Cargando_DOC',             'SO', 3,  'OTs asociadas a SMP finalizando carga de DOC en Maximo', 'SS_E2E', null),
('0350.Calidad_Agendamiento',     'SO', 4,  'Ots asociadas a SMP no han sido notificadas a Nokia con OK DEC', 'SS_E2E', null),
('0370.Programacion_Agendamiento','SO', 5,  'Ots asociadas a SMP en proceso de agendamiento de cita', 'SS_E2E', null),
('0400.Aprobacion_Agendamiento',  'SO', 6,  'Esperando aprobacion de agendamiento para las Ots asociadas al SMP', 'Nokia', null),
('0500.Interventoria_Sin_Visita', 'SO', 7,  'Esperando confirmacion de visita por parte de SS E2E', 'SS_E2E', null),
('0550.Interventoria_Con_Visita', 'SO', 8,  'Esperando concepto de Site Owner para las Ots asociadas al SMP', 'SS_E2E', null),
('0600.Pendientes_Interventoria', 'SO', 9,  'Requiere solucion de pendientes en Maximo para las Ots asociadas al SMP', 'SS_E2E', null),
('9999.Aceptado',                 'SO', 10, 'Ots asociadas a SMP cerradas', 'SS_E2E', null),

-- SO_DEC
('0050.Sitio Sin Iniciar',                  'SO_DEC', 1,  null, null, null),
('0060.Error_Administrativo',               'SO_DEC', 2,  null, null, null),
('0100.Creando_OT',                         'SO_DEC', 3,  null, null, null),
('0200.Integrando',                         'SO_DEC', 4,  null, null, null),
('0600.Pendiente_Entrega_Infraestructura',  'SO_DEC', 5,  null, null, null),
('0650.Pendiente_Cierre_Admin_S.O.',        'SO_DEC', 6,  null, null, null),
('0710.Rechazo_1',                          'SO_DEC', 7,  null, null, null),
('0720.Rechazo_2',                          'SO_DEC', 8,  null, null, null),
('0800.Pendiente_Concepto_Claro_Rechazo',   'SO_DEC', 9,  null, null, null),
('0810.Pendiente_Concepto_S.O.',            'SO_DEC', 10, null, null, null),
('9990.Proyecto fuera scope',               'SO_DEC', 11, null, null, null),
('9999.Aprobado',                           'SO_DEC', 12, null, null, null)

on conflict (gap, area) do nothing;
