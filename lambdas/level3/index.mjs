export const handler = async (event) => {
  const body = JSON.parse(event.body || "{}");
  const simulateError = body.error === true;
  const timestamp = new Date().toISOString();

  if (simulateError) {
    console.log(JSON.stringify({ event: "REQUEST", level: 3, result: "maintenance_error", timestamp }));
    return {
      statusCode: 500,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        level: 3,
        status: "maintenance_error",
        message: "Nivel 3: Sistema bajo mantenimiento, intente más tarde",
        timestamp,
      }),
    };
  }

  console.log(JSON.stringify({ event: "REQUEST", level: 3, result: "minimum", timestamp }));
  return {
    statusCode: 200,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      level: 3,
      status: "minimum",
      message: "Nivel 3: Operación al mínimo",
      timestamp,
    }),
  };
};
