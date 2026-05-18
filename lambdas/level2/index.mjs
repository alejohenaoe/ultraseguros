export const handler = async (event) => {
  const body = JSON.parse(event.body || "{}");
  const simulateError = body.error === true;
  const timestamp = new Date().toISOString();

  if (simulateError) {
    console.log(JSON.stringify({ event: "REQUEST", level: 2, result: "error", timestamp }));
    return {
      statusCode: 500,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        level: 2,
        status: "error",
        message: "Nivel 2: Error en sistema degradado",
        timestamp,
      }),
    };
  }

  console.log(JSON.stringify({ event: "REQUEST", level: 2, result: "ok", timestamp }));
  return {
    statusCode: 200,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      level: 2,
      status: "degraded",
      message: "Nivel 2: Sistema degradado - solo operaciones críticas disponibles",
      services: ["transactions"],
      unavailable: ["analytics", "monitoring"],
      timestamp,
    }),
  };
};
