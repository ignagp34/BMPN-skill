(start Residuo generado en origen)
Generador: Separar residuos en origen
[Bolsa o contenedor de residuos]
Generador: Depositar residuos en contenedor correspondiente
(send Aviso de recogida programada)

Servicio de recogida:
(receive Aviso de recogida programada)
Servicio de recogida: Recoger contenedores
Servicio de recogida: Transportar residuos a planta de clasificación
(send Carga de residuos)

Planta de clasificación:
(receive Carga de residuos)
Recepción: Registrar entrada de camión
Báscula: Pesar carga entrante
[Ticket de pesaje]
Recepción: Descargar residuos en playa de recepción
Operarios: Realizar inspección visual inicial
¿La carga es aceptable?
Sí
Operarios: Alimentar línea de clasificación
Sistema de clasificación: Abrir bolsas y dosificar flujo
Sistema de clasificación: Separar residuos voluminosos|Sistema de clasificación: Separar metales férricos|Sistema de clasificación: Separar metales no férricos|Sistema de clasificación: Separar plásticos|Sistema de clasificación: Separar papel y cartón|Sistema de clasificación: Separar vidrio|Sistema de clasificación: Separar materia orgánica|Sistema de clasificación: Separar rechazo
Operarios: Revisar clasificación manual
Calidad: Controlar calidad de fracciones
¿La fracción cumple especificaciones?
Sí
Operarios: Prensar y embalar fracciones valorizables
[Balas de material reciclable]
Expediciones: Almacenar material clasificado
Expediciones: Preparar expedición a reciclador
(send Material reciclable expedido)

Reciclador:
(receive Material reciclable expedido)
Reciclador: Recepcionar material reciclable
Reciclador: Verificar calidad del material recibido
¿El material es reciclable?
Sí
Reciclador: Triturar y lavar material
Reciclador: Transformar material en materia prima secundaria
[Materia prima secundaria]
Reciclador: Comercializar materia prima secundaria
(send Certificado de reciclaje)

Planta de clasificación:
(receive Certificado de reciclaje)
Calidad: Registrar certificado de reciclaje
[db Registro de trazabilidad]
Autoridad ambiental: Recibir informe de trazabilidad
(finish Residuos reciclados y trazabilidad registrada)

(start Residuo generado en origen)
Generador: Separar residuos en origen
[Bolsa o contenedor de residuos]
Generador: Depositar residuos en contenedor correspondiente
(send Aviso de recogida programada)

Servicio de recogida:
(receive Aviso de recogida programada)
Servicio de recogida: Recoger contenedores
Servicio de recogida: Transportar residuos a planta de clasificación
(send Carga de residuos)

Planta de clasificación:
(receive Carga de residuos)
Recepción: Registrar entrada de camión
Báscula: Pesar carga entrante
[Ticket de pesaje]
Recepción: Descargar residuos en playa de recepción
Operarios: Realizar inspección visual inicial
¿La carga es aceptable?
Sí
Operarios: Alimentar línea de clasificación
Sistema de clasificación: Abrir bolsas y dosificar flujo
Sistema de clasificación: Separar residuos voluminosos|Sistema de clasificación: Separar metales férricos|Sistema de clasificación: Separar metales no férricos|Sistema de clasificación: Separar plásticos|Sistema de clasificación: Separar papel y cartón|Sistema de clasificación: Separar vidrio|Sistema de clasificación: Separar materia orgánica|Sistema de clasificación: Separar rechazo
Operarios: Revisar clasificación manual
Calidad: Controlar calidad de fracciones
¿La fracción cumple especificaciones?
No
Operarios: Reclasificar fracción no conforme
Calidad: Controlar calidad de fracciones
¿La fracción cumple especificaciones?
Sí
Operarios: Prensar y embalar fracciones valorizables
[Balas de material reciclable]
Expediciones: Almacenar material clasificado
Expediciones: Preparar expedición a reciclador
(send Material reciclable expedido)

Reciclador:
(receive Material reciclable expedido)
Reciclador: Recepcionar material reciclable
Reciclador: Verificar calidad del material recibido
¿El material es reciclable?
Sí
Reciclador: Triturar y lavar material
Reciclador: Transformar material en materia prima secundaria
[Materia prima secundaria]
Reciclador: Comercializar materia prima secundaria
(send Certificado de reciclaje)

Planta de clasificación:
(receive Certificado de reciclaje)
Calidad: Registrar certificado de reciclaje
[db Registro de trazabilidad]
Autoridad ambiental: Recibir informe de trazabilidad
(finish Fracción reclasificada y reciclada)

(start Residuo generado en origen)
Generador: Separar residuos en origen
[Bolsa o contenedor de residuos]
Generador: Depositar residuos en contenedor correspondiente
(send Aviso de recogida programada)

Servicio de recogida:
(receive Aviso de recogida programada)
Servicio de recogida: Recoger contenedores
Servicio de recogida: Transportar residuos a planta de clasificación
(send Carga de residuos)

Planta de clasificación:
(receive Carga de residuos)
Recepción: Registrar entrada de camión
Báscula: Pesar carga entrante
[Ticket de pesaje]
Recepción: Descargar residuos en playa de recepción
Operarios: Realizar inspección visual inicial
¿La carga es aceptable?
No
Calidad: Bloquear carga no conforme
[Incidencia de carga]
Calidad: Notificar incidencia al servicio de recogida
(send Incidencia de carga)

Servicio de recogida:
(receive Incidencia de carga)
Servicio de recogida: Retirar carga no conforme
Servicio de recogida: Transportar carga a gestor autorizado
(send Carga no conforme)

Gestor autorizado:
(receive Carga no conforme)
Gestor autorizado: Tratar carga no conforme
Gestor autorizado: Emitir justificante de gestión
(send Justificante de gestión)

Planta de clasificación:
(receive Justificante de gestión)
Calidad: Registrar justificante de gestión
[db Registro de trazabilidad]
Autoridad ambiental: Recibir informe de trazabilidad
(finish Carga no conforme gestionada)

(start Residuo generado en origen)
Generador: Separar residuos en origen
[Bolsa o contenedor de residuos]
Generador: Depositar residuos en contenedor correspondiente
(send Aviso de recogida programada)

Servicio de recogida:
(receive Aviso de recogida programada)
Servicio de recogida: Recoger contenedores
Servicio de recogida: Transportar residuos a planta de clasificación
(send Carga de residuos)

Planta de clasificación:
(receive Carga de residuos)
Recepción: Registrar entrada de camión
Báscula: Pesar carga entrante
[Ticket de pesaje]
Recepción: Descargar residuos en playa de recepción
Operarios: Realizar inspección visual inicial
¿La carga es aceptable?
Sí
Operarios: Alimentar línea de clasificación
Sistema de clasificación: Abrir bolsas y dosificar flujo
Sistema de clasificación: Separar residuos voluminosos|Sistema de clasificación: Separar metales férricos|Sistema de clasificación: Separar metales no férricos|Sistema de clasificación: Separar plásticos|Sistema de clasificación: Separar papel y cartón|Sistema de clasificación: Separar vidrio|Sistema de clasificación: Separar materia orgánica|Sistema de clasificación: Separar rechazo
Operarios: Revisar clasificación manual
Calidad: Controlar calidad de fracciones
¿La fracción cumple especificaciones?
Sí
Operarios: Prensar y embalar fracciones valorizables
[Balas de material reciclable]
Expediciones: Almacenar material clasificado
Expediciones: Preparar expedición a reciclador
(send Material reciclable expedido)

Reciclador:
(receive Material reciclable expedido)
Reciclador: Recepcionar material reciclable
Reciclador: Verificar calidad del material recibido
¿El material es reciclable?
No
Reciclador: Rechazar material no reciclable
(send Material rechazado)

Planta de clasificación:
(receive Material rechazado)
Calidad: Registrar rechazo del reciclador
Operarios: Separar rechazo para valorización
Expediciones: Preparar expedición a valorización energética
(send Rechazo valorizable)

Valorizador energético:
(receive Rechazo valorizable)
Valorizador energético: Recepcionar rechazo valorizable
Valorizador energético: Valorizar energéticamente rechazo
Valorizador energético: Emitir certificado de valorización
(send Certificado de valorización)

Planta de clasificación:
(receive Certificado de valorización)
Calidad: Registrar certificado de valorización
[db Registro de trazabilidad]
Autoridad ambiental: Recibir informe de trazabilidad
(finish Rechazo valorizado energéticamente)

(start Residuo generado en origen)
Generador: Separar residuos en origen
[Bolsa o contenedor de residuos]
Generador: Depositar residuos en contenedor correspondiente
(send Aviso de recogida programada)

Servicio de recogida:
(receive Aviso de recogida programada)
Servicio de recogida: Recoger contenedores
Servicio de recogida: Transportar residuos a planta de clasificación
(send Carga de residuos)

Planta de clasificación:
(receive Carga de residuos)
Recepción: Registrar entrada de camión
Báscula: Pesar carga entrante
[Ticket de pesaje]
Recepción: Descargar residuos en playa de recepción
Operarios: Realizar inspección visual inicial
¿La carga es aceptable?
Sí
Operarios: Alimentar línea de clasificación
Sistema de clasificación: Abrir bolsas y dosificar flujo
Sistema de clasificación: Separar residuos voluminosos|Sistema de clasificación: Separar metales férricos|Sistema de clasificación: Separar metales no férricos|Sistema de clasificación: Separar plásticos|Sistema de clasificación: Separar papel y cartón|Sistema de clasificación: Separar vidrio|Sistema de clasificación: Separar materia orgánica|Sistema de clasificación: Separar rechazo
Operarios: Revisar clasificación manual
Calidad: Controlar calidad de fracciones
¿La fracción cumple especificaciones?
Sí
Operarios: Separar rechazo para vertedero
Expediciones: Preparar expedición a vertedero autorizado
(send Rechazo a vertedero)

Vertedero autorizado:
(receive Rechazo a vertedero)
Vertedero autorizado: Recepcionar rechazo final
Vertedero autorizado: Disponer rechazo en celda autorizada
Vertedero autorizado: Emitir justificante de eliminación
(send Justificante de eliminación)

Planta de clasificación:
(receive Justificante de eliminación)
Calidad: Registrar justificante de eliminación
[db Registro de trazabilidad]
Autoridad ambiental: Recibir informe de trazabilidad
(finish Rechazo eliminado en vertedero autorizado)

(start Residuo generado en origen)
Generador: Separar residuos en origen
[Bolsa o contenedor de residuos]
Generador: Depositar residuos en contenedor correspondiente
(send Aviso de recogida programada)

Servicio de recogida:
(receive Aviso de recogida programada)
Servicio de recogida: Recoger contenedores
Servicio de recogida: Transportar residuos a planta de clasificación
(send Carga de residuos)

Planta de clasificación:
(receive Carga de residuos)
Recepción: Registrar entrada de camión
Báscula: Pesar carga entrante
[Ticket de pesaje]
Recepción: Descargar residuos en playa de recepción
Operarios: Realizar inspección visual inicial
¿La carga es aceptable?
Sí
Operarios: Alimentar línea de clasificación
Sistema de clasificación: Abrir bolsas y dosificar flujo
Sistema de clasificación: Separar residuos voluminosos|Sistema de clasificación: Separar metales férricos|Sistema de clasificación: Separar metales no férricos|Sistema de clasificación: Separar plásticos|Sistema de clasificación: Separar papel y cartón|Sistema de clasificación: Separar vidrio|Sistema de clasificación: Separar materia orgánica|Sistema de clasificación: Separar rechazo
Operarios: Revisar clasificación manual
Calidad: Controlar calidad de fracciones
¿La fracción cumple especificaciones?
Sí
Operarios: Separar materia orgánica para compostaje
Expediciones: Preparar expedición a planta de compostaje
(send Materia orgánica clasificada)

Planta de compostaje:
(receive Materia orgánica clasificada)
Planta de compostaje: Recepcionar materia orgánica
Planta de compostaje: Compostar materia orgánica
Laboratorio: Analizar compost
¿El compost cumple especificaciones?
Sí
Planta de compostaje: Envasar compost certificado
[Compost certificado]
Planta de compostaje: Emitir certificado de compostaje
(send Certificado de compostaje)

Planta de clasificación:
(receive Certificado de compostaje)
Calidad: Registrar certificado de compostaje
[db Registro de trazabilidad]
Autoridad ambiental: Recibir informe de trazabilidad
(finish Materia orgánica convertida en compost)

(start Residuo generado en origen)
Generador: Separar residuos en origen
[Bolsa o contenedor de residuos]
Generador: Depositar residuos en contenedor correspondiente
(send Aviso de recogida programada)

Servicio de recogida:
(receive Aviso de recogida programada)
Servicio de recogida: Recoger contenedores
Servicio de recogida: Transportar residuos a planta de clasificación
(send Carga de residuos)

Planta de clasificación:
(receive Carga de residuos)
Recepción: Registrar entrada de camión
Báscula: Pesar carga entrante
[Ticket de pesaje]
Recepción: Descargar residuos en playa de recepción
Operarios: Realizar inspección visual inicial
¿La carga es aceptable?
Sí
Operarios: Alimentar línea de clasificación
Sistema de clasificación: Abrir bolsas y dosificar flujo
Sistema de clasificación: Separar residuos voluminosos|Sistema de clasificación: Separar metales férricos|Sistema de clasificación: Separar metales no férricos|Sistema de clasificación: Separar plásticos|Sistema de clasificación: Separar papel y cartón|Sistema de clasificación: Separar vidrio|Sistema de clasificación: Separar materia orgánica|Sistema de clasificación: Separar rechazo
Sistema de clasificación: Detectar avería en línea
Mantenimiento: Parar línea de clasificación
Mantenimiento: Reparar equipo de clasificación
Mantenimiento: Reiniciar línea de clasificación
Operarios: Revisar clasificación manual
Calidad: Controlar calidad de fracciones
¿La fracción cumple especificaciones?
Sí
Operarios: Prensar y embalar fracciones valorizables
[Balas de material reciclable]
Expediciones: Almacenar material clasificado
Expediciones: Preparar expedición a reciclador
(send Material reciclable expedido)

Reciclador:
(receive Material reciclable expedido)
Reciclador: Recepcionar material reciclable
Reciclador: Verificar calidad del material recibido
¿El material es reciclable?
Sí
Reciclador: Triturar y lavar material
Reciclador: Transformar material en materia prima secundaria
[Materia prima secundaria]
Reciclador: Comercializar materia prima secundaria
(send Certificado de reciclaje)

Planta de clasificación:
(receive Certificado de reciclaje)
Calidad: Registrar certificado de reciclaje
[db Registro de trazabilidad]
Autoridad ambiental: Recibir informe de trazabilidad
(finish Residuos reciclados tras reparación de línea)

== pools ==
Generadores de residuos -> Generador
Servicio municipal de recogida -> Servicio de recogida
Planta de clasificación -> Recepción; Báscula; Operarios; Sistema de clasificación; Calidad; Mantenimiento; Expediciones; Autoridad ambiental
Industria recicladora -> Reciclador
Gestor de residuos no conformes -> Gestor autorizado
Valorización energética -> Valorizador energético
Vertedero autorizado -> Vertedero autorizado
Planta de compostaje -> Planta de compostaje; Laboratorio
