/// Flujo de ejecución de la skill /bpmn

(start Usuario escribe /bpmn)
Identificar qué se va a modelar
Reunir el material de entrada
Lanzar subagente generador de DSL
[Especificación del DSL v5]
Escribir el DSL Sketch Miner
service Ejecutar bpmn-render
¿Compila y valida el modelo?
Sí
Escribir SVG, PNG, BPMN y DSL en bpmn-out
[Diagrama]
user Mostrar el diagrama al usuario
(finish Diagrama entregado)

(start Usuario escribe /bpmn)
Identificar qué se va a modelar
Reunir el material de entrada
Lanzar subagente generador de DSL
Escribir el DSL Sketch Miner
service Ejecutar bpmn-render
¿Compila y valida el modelo?
No, quedan reintentos
Devolver los errores del motor al subagente
Escribir el DSL Sketch Miner

(start Usuario escribe /bpmn)
Identificar qué se va a modelar
Reunir el material de entrada
Lanzar subagente generador de DSL
Escribir el DSL Sketch Miner
service Ejecutar bpmn-render
¿Compila y valida el modelo?
No, dos reintentos agotados
Mostrar los errores y el DSL al usuario
(error Diagrama no generado)
