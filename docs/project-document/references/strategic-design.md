# EventStorming y Diseño de Arquitectura

## EventStorming

En esta sección el equipo explica y evidencia el proceso de EventStorming, con el fin de plantear una primera aproximación al modelado de nivel general para el dominio del problema, buscando a partir de ahí identificar el mayor nivel de detalle posible.

Es recomendable que el equipo organice la sesión de EventStorming con una duración entre 1 – 2 horas, a fin de concentrar esfuerzos y no extender el proceso de forma innecesaria.

La sección inicia con una introducción y explicación de las actividades realizadas en la sesión de EventStorming, e incluye capturas de lo elaborado en la herramienta indicada.

---

## Candidate Context Discovery

En esta sección el equipo, a partir del dominio modelado como EventStorm, explica y evidencia el proceso realizado para la sesión de Candidate Context Discovery, en la que se busca identificar los bounded contexts.

Puede aplicar las siguientes técnicas:

- **Start-with-value**: Identificar las partes core del dominio que tienen el mayor valor para el negocio.
- **Start-with-simple**: Crear modelos simples, pero con propósito, descomponiendo el timeline en steps secuenciales.
- **Look-for-pivotal-events**: Buscar eventos clave del negocio que indiquen cambios de estado entre diferentes partes del proceso de negocio.

La sesión de Candidate Context Discovery no debería durar más de 2 horas. Utilice para el proceso la herramienta indicada. Complemente la explicación con capturas en imagen de los cambios progresivos del EventStorm.

---

## Domain Message Flows Modeling

En esta sección, el equipo explica y evidencia el proceso seguido para visualizar cómo deben colaborar los bounded contexts para resolver los casos que se presentan en el negocio para los usuarios del sistema.

Para ello debe aplicar la técnica de visualización **Domain Storytelling**. Complemente la explicación con capturas en imágenes de los diagramas de Domain Storytelling elaborados.

---

## Bounded Context Canvases

En esta sección el equipo diseña sus candidate bounded contexts, detallando los criterios de diseño. El equipo debe ir seleccionando cada bounded context, por orden de importancia, para elaborar su Bounded Context Canvas.

La elaboración del Bounded Context Canvas debe seguir un proceso iterativo con los siguientes pasos:

1. Context Overview Definition
2. Business Rules Distillation & Ubiquitous Language Capture
3. Capability Analysis
4. Capability Layering (si aplica)
5. Dependencies Capture
6. Design Critique

---

## Context Mapping

En esta sección el equipo explica y evidencia el proceso de elaboración de un conjunto de context maps (visualizaciones de las relaciones estructurales entre bounded contexts). Para ello el equipo revisa información recolectada y la utiliza para producir los diseños candidatos.

Se recomienda en el proceso incluir preguntas como:

- ¿Qué pasaría si movemos este capability a otro bounded context?
- ¿Qué pasaría si descomponemos este capability y movemos uno de los sub-capabilities a otro bounded context?
- ¿Qué pasaría si partimos el bounded context en múltiples bounded contexts?
- ¿Qué pasaría si tomamos este capability de estos 3 contexts y lo usamos para formar un nuevo context?
- ¿Qué pasaría si duplicamos una funcionalidad para romper la dependencia?
- ¿Qué pasaría si creamos un shared service para reducir la duplicación entre múltiples bounded contexts?
- ¿Qué pasaría si aislamos los core capabilities y movemos los otros a un context aparte?

Debe finalizar este proceso discutiendo cada alternativa de context mapping a fin de llegar a la mejor aproximación. Es importante que el equipo considere los patrones de relaciones entre Bounded Contexts establecidos en Domain-Driven Design, como:

- Anti-corruption Layer
- Conformist
- Customer/Supplier
- Shared Kernel

---

## Software Architecture

En esta sección el equipo presenta y explica la representación, aplicando **C4 Model** y utilizando la herramienta indicada, de la Arquitectura de Software para la solución. Aquí se realiza una introducción y se incluye como secciones internas:

- Software Architecture Context Level Diagram
- Software Architecture Container Level Diagrams

### Software Architecture Context Level Diagram

En esta sección el equipo realiza una introducción, presenta en imagen el context diagram, el cual debe mostrar el sistema como un recuadro en el centro, rodeado por sus usuarios y otros sistemas con los que interactúa. Utilice la herramienta indicada para la elaboración del diagrama. Se incluye en esta sección una explicación del diagrama.

### Software Architecture Container Level Diagram

En esta sección, el equipo realiza una introducción, presenta y explica el Container Diagram. Dicho diagrama debe mostrar los elementos de alto nivel de la arquitectura de software y cómo se distribuyen las responsabilidades entre ellos. Aquí se debe mostrar también las principales decisiones de tecnología y cómo los containers se comunican entre sí.