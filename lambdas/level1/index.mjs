export const handler = async (event) => {
  const body = JSON.parse(event.body || "{}");
  const simulateError = body.error === true;
  const timestamp = new Date().toISOString();

  if (simulateError) {
    console.log(JSON.stringify({ event: "REQUEST", level: 1, result: "error", timestamp }));
    return {
      statusCode: 500,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        level: 1,
        status: "error",
        message: "Nivel 1: Error simulado en servicio completo",
        timestamp,
      }),
    };
  }

  console.log(JSON.stringify({ event: "REQUEST", level: 1, result: "ok", timestamp }));
  return {
    statusCode: 200,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      level: 1,
      status: "ok",
      message: "Nivel 1: Todos los servicios operando normalmente",
      services: ["transactions", "analytics", "monitoring"],
      timestamp,
    }),
  };
};
