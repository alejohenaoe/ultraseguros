# UltraSeguros — Arquitectura Resiliente en AWS

## 1. Visión General

UltraSeguros es un sistema de resiliencia automática desplegado sobre AWS que implementa **degradación progresiva de servicio** como estrategia principal para garantizar disponibilidad continua bajo condiciones de fallo.

El sistema opera en **3 niveles de servicio**:

| Nivel | Nombre    | Descripción                                                        | Servicios disponibles                   |
|-------|-----------|--------------------------------------------------------------------|-----------------------------------------|
| 1     | Full      | Sistema operando con normalidad                                    | transactions, analytics, monitoring     |
| 2     | Degradado | Solo servicios esenciales activos                                  | transactions                            |
| 3     | Mínimo    | El sistema responde pero sin procesar operaciones reales           | mensaje de mantenimiento solamente      |

**Problema que resuelve:** En un entorno financiero, detener el sistema ante una avalancha de errores es inaceptable. UltraSeguros sacrifica funcionalidad gradualmente antes de caer por completo, garantizando que siempre haya una respuesta al cliente.

**Recuperación automática:** el sistema monitorea rachas de éxitos consecutivos y sube de nivel sin intervención humana, eliminando la necesidad de on-call para recuperaciones estándar.

---

## 2. Atributo de Calidad Prioritario: Disponibilidad

La disponibilidad fue priorizada sobre rendimiento y seguridad por las siguientes razones:

- **Un sistema lento sigue siendo usable; un sistema caído no.** En servicios financieros, la indisponibilidad genera pérdidas directas e impacto regulatorio.
- **La degradación controlada es preferible al fallo total.** El Nivel 2 mantiene las transacciones activas (el corazón del negocio), sacrificando analytics y monitoring que pueden recuperarse con datos históricos.
- **La recuperación automática reduce el MTTR (Mean Time To Recovery)** eliminando la dependencia de intervención humana en horas fuera de oficina.

El trade-off consciente: el Nivel 3 retorna `200 OK` incluso con `error: true` en el body, porque en ese nivel el sistema prioriza "seguir respondiendo" sobre "reportar el estado real". Esto puede confundir a clientes que esperan `500`, pero garantiza que el circuit breaker del cliente no abra un segundo corte de circuito.

---

## 3. Decisiones de Arquitectura

### DA-01: REST API Gateway como punto de entrada único

- **Decisión:** todo el tráfico POST entra por el path `/prod/service-api` usando una REST API de API Gateway.
- **Justificación:** centraliza el control de tráfico y es el contrato que el cliente K6 espera. La REST API genera el path `/prod/` en la URL mediante stages explícitos.
- **Alternativa descartada:** HTTP API Gateway — no genera el path `/prod/` de forma nativa; requeriría configuración adicional incompatible con el cliente existente.
- **Consecuencia:** único punto de entrada (SPOF potencial), mitigado por ser un servicio administrado por AWS con SLA del 99.95%.

### DA-02: Campo `error` en el body como señal de fallo

- **Decisión:** el Router y las Lambdas de nivel leen `body.error === true` para decidir si la petición genera un error 500.
- **Justificación:** es el contrato definido por el cliente K6. No se puede cambiar sin modificar el cliente.
- **Alternativa descartada:** path `/fail` o query params `?error=true` — incompatibles con el cliente que siempre hace POST a la misma URL.
- **Consecuencia:** el sistema confía en que el cliente envía el campo `error` correctamente. Un cliente malicioso podría forzar errores artificiales, pero está fuera del modelo de amenaza de este sistema académico.

### DA-03: Estado centralizado en DynamoDB con operaciones atómicas

- **Decisión:** el nivel del sistema y los contadores (`error_count`, `success_streak`) viven en un único ítem DynamoDB con `UpdateExpression ADD` para incrementos atómicos.
- **Justificación:** las Lambdas son stateless por naturaleza. `ADD` es una operación atómica que evita condiciones de carrera cuando múltiples invocaciones concurrentes actualizan los contadores simultáneamente.
- **Alternativa descartada:** estado en memoria (variables globales del Lambda) — se pierde entre invocaciones frías y no es compartido entre instancias concurrentes.
- **Consecuencia:** latencia adicional de ~1-2ms por operación GetItem + UpdateItem en cada request. Aceptable dado que el timeout del Lambda es de 30 segundos.

### DA-04: Tres Lambdas independientes por nivel de servicio

- **Decisión:** cada nivel de servicio (`level1`, `level2`, `level3`) es una función Lambda separada, invocada sincrónicamente por el Router.
- **Justificación:** aislamiento de fallos. Un bug en la lógica de `level1` no puede afectar la capacidad de responder desde `level3`. Facilita el despliegue independiente de cada nivel.
- **Alternativa descartada:** una única Lambda con condicionales `if (level === 1) {...} else if (level === 2) {...}` — más frágil, un error de sintaxis en una rama puede romper toda la función.
- **Consecuencia:** invocación Lambda-a-Lambda agrega ~10-50ms de latencia. El Router espera la respuesta de la Lambda de nivel antes de actualizar DynamoDB (`InvocationType: RequestResponse`).

### DA-05: Health Check independiente vía EventBridge (cada minuto)

- **Decisión:** una Lambda separada `health-check` se ejecuta cada minuto mediante una regla de EventBridge para evaluar si el sistema puede subir de nivel.
- **Justificación:** sin tráfico entrante, el sistema igual debe poder recuperarse. Si hay 5 éxitos consecutivos almacenados pero no llegan nuevas peticiones, el health check detecta el momento adecuado para subir de nivel.
- **Alternativa descartada:** evaluar la recuperación únicamente dentro del Router, al procesar cada petición exitosa — el sistema no podría recuperarse en períodos de bajo tráfico.
- **Consecuencia:** puede haber hasta 60 segundos de retraso entre que se cumplen las condiciones de recuperación y la transición efectiva. Aceptable para este modelo de resiliencia.

---

## 4. Tácticas de Arquitectura

### Detección de fallos

El Router actúa como el detector central. Después de invocar la Lambda de nivel y recibir su respuesta:
- Si `statusCode >= 500`: ejecuta `ADD error_count :1` y resetea `success_streak = 0`
- Si `statusCode < 500`: ejecuta `ADD success_streak :1`

La operación `ADD` de DynamoDB es atómica, lo que garantiza que incluso con 10 invocaciones concurrentes del Router, cada una incrementa el contador correctamente sin colisiones.

### Degradación progresiva

Las transiciones se evalúan en **orden estricto** para no saltarse niveles:

1. `level=1 AND error_count >= 10` → Nivel 3 (salto directo en avalancha masiva)
2. `level=1 AND error_count >= 5`  → Nivel 2 (degradación gradual)
3. `level=2 AND error_count >= 10` → Nivel 3 (degradación desde nivel intermedio)

Los umbrales 5 y 10 son deliberados: suficientemente altos para ignorar errores esporádicos (ruido), suficientemente bajos para reaccionar ante patrones de fallo real dentro de una ventana razonable.

### Recuperación conservadora

Para subir de nivel se exige una **racha de éxitos consecutivos**, no solo una mejora momentánea:
- Nivel 3 → Nivel 2: se requieren **5 éxitos consecutivos**
- Nivel 2 → Nivel 1: se requieren **10 éxitos consecutivos**

Esto previene el **efecto ping-pong**: un sistema inestable que oscila entre niveles con cada petición. Al requerir rachas largas, se garantiza que el sistema haya estabilizado antes de restaurar funcionalidad.

Los contadores se resetean a 0 en cada transición (tanto `error_count` como `success_streak`), asegurando que las rachas se miden desde un estado limpio.

### Observabilidad estructurada

Cada transición de nivel genera un log JSON estructurado:

```json
{
  "event": "LEVEL_TRANSITION",
  "from": 1,
  "to": 2,
  "reason": "error_count >= 5",
  "value": 5,
  "timestamp": "2024-01-15T10:30:00.000Z"
}
```

Esto permite:
- Filtrar en CloudWatch con `{ $.event = "LEVEL_TRANSITION" }`
- Construir alarmas sobre transiciones frecuentes
- Auditar el historial completo de degradaciones y recuperaciones

---

## 5. Diagrama ASCII de la arquitectura

```
                         ┌─────────────────────────────────────────┐
                         │             AWS Cloud (us-east-2)        │
                         │                                          │
 K6 Script               │  ┌─────────────────┐                    │
 POST /prod/service-api ─┼─►│  API Gateway    │                    │
 { error: true/false }   │  │  REST API       │                    │
                         │  └────────┬────────┘                    │
                         │           │ AWS_PROXY                    │
                         │           ▼                              │
                         │  ┌─────────────────┐   GetItem          │
                         │  │  Lambda Router  ├──────────────────► │
                         │  │  (ultraseguros- │   UpdateItem       │  ┌──────────────────┐
                         │  │    router)      │◄──────────────────┤  │    DynamoDB      │
                         │  └────────┬────────┘                   │  │ ultraseguros_    │
                         │           │ InvokeFunction              │  │    _state        │
                         │     ┌─────┴──────┐                     │  │                  │
                         │     ▼            ▼                      │  │ pk: "SYSTEM"     │
                         │ ┌──────┐  ┌──────┐  ┌──────┐          │  │ current_level: 1 │
                         │ │  L1  │  │  L2  │  │  L3  │          │  │ error_count: 0   │
                         │ │(Full)│  │(Deg.)│  │(Min.)│          │  │ success_streak: 0│
                         │ └──────┘  └──────┘  └──────┘          │  └──────────────────┘
                         │                                          │           ▲
                         │  ┌─────────────────┐   GetItem/Update   │           │
                         │  │  EventBridge    │                    │           │
                         │  │  rate(1 minute) ├──►  Lambda         ├───────────┘
                         │  └─────────────────┘   Health-Check     │
                         │                                          │
                         │  ┌─────────────────────────────────────┐│
                         │  │            CloudWatch Logs           ││
                         │  │  /aws/lambda/ultraseguros-*          ││
                         │  └─────────────────────────────────────┘│
                         └─────────────────────────────────────────┘
```

---

