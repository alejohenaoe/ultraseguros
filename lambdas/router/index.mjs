import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, GetCommand, UpdateCommand } from "@aws-sdk/lib-dynamodb";
import { LambdaClient, InvokeCommand } from "@aws-sdk/client-lambda";

const dynamoClient = new DynamoDBClient({});
const dynamo = DynamoDBDocumentClient.from(dynamoClient);
const lambdaClient = new LambdaClient({});

const TABLE_NAME = process.env.TABLE_NAME;
const LEVEL_FUNCTIONS = {
  1: process.env.LEVEL1_FUNCTION,
  2: process.env.LEVEL2_FUNCTION,
  3: process.env.LEVEL3_FUNCTION,
};

export const handler = async (event) => {
  // 1. Parsear body
  const body = JSON.parse(event.body || "{}");

  // 2. Leer estado actual del sistema
  const stateResult = await dynamo.send(
    new GetCommand({
      TableName: TABLE_NAME,
      Key: { pk: "SYSTEM" },
    })
  );
  const state = stateResult.Item;
  const currentLevel = Number(state.current_level);

  // 3. Invocar la Lambda del nivel actual
  const functionName = LEVEL_FUNCTIONS[currentLevel];
  const lambdaResult = await lambdaClient.send(
    new InvokeCommand({
      FunctionName: functionName,
      InvocationType: "RequestResponse",
      Payload: JSON.stringify(event),
    })
  );

  // 5. Parsear la respuesta de la Lambda de nivel
  const levelResponse = JSON.parse(Buffer.from(lambdaResult.Payload).toString());
  const responseStatusCode = levelResponse.statusCode;

  // 6-8. Actualizar contadores según el statusCode
  const timestamp = new Date().toISOString();
  if (responseStatusCode >= 500) {
    await dynamo.send(
      new UpdateCommand({
        TableName: TABLE_NAME,
        Key: { pk: "SYSTEM" },
        UpdateExpression: "ADD error_count :one SET success_streak = :zero, last_updated = :timestamp",
        ExpressionAttributeValues: {
          ":one": 1,
          ":zero": 0,
          ":timestamp": timestamp,
        },
      })
    );
  } else {
    await dynamo.send(
      new UpdateCommand({
        TableName: TABLE_NAME,
        Key: { pk: "SYSTEM" },
        UpdateExpression: "ADD success_streak :one SET last_updated = :timestamp",
        ExpressionAttributeValues: {
          ":one": 1,
          ":timestamp": timestamp,
        },
      })
    );
  }

  // 9. Leer estado actualizado para evaluar transiciones
  const updatedResult = await dynamo.send(
    new GetCommand({
      TableName: TABLE_NAME,
      Key: { pk: "SYSTEM" },
    })
  );
  const updated = updatedResult.Item;
  const level = Number(updated.current_level);
  const errorCount = Number(updated.error_count);
  const successStreak = Number(updated.success_streak);
  const now = new Date().toISOString();

  // Evaluar transiciones en orden exacto
  if (level === 1 && errorCount >= 10) {
    await dynamo.send(
      new UpdateCommand({
        TableName: TABLE_NAME,
        Key: { pk: "SYSTEM" },
        UpdateExpression: "SET current_level = :newLevel, error_count = :zero, success_streak = :zero, last_updated = :timestamp",
        ExpressionAttributeValues: {
          ":newLevel": 3,
          ":zero": 0,
          ":timestamp": now,
        },
      })
    );
    console.log(JSON.stringify({ event: "LEVEL_TRANSITION", from: 1, to: 3, reason: "error_count >= 10", value: errorCount, timestamp: now }));
  } else if (level === 1 && errorCount >= 5) {
    await dynamo.send(
      new UpdateCommand({
        TableName: TABLE_NAME,
        Key: { pk: "SYSTEM" },
        UpdateExpression: "SET current_level = :newLevel, success_streak = :zero, last_updated = :timestamp",
        ExpressionAttributeValues: {
          ":newLevel": 2,
          ":zero": 0,
          ":timestamp": now,
        },
      })
    );
    console.log(JSON.stringify({ event: "LEVEL_TRANSITION", from: 1, to: 2, reason: "error_count >= 5", value: errorCount, timestamp: now }));
  } else if (level === 2 && errorCount >= 10) {
    await dynamo.send(
      new UpdateCommand({
        TableName: TABLE_NAME,
        Key: { pk: "SYSTEM" },
        UpdateExpression: "SET current_level = :newLevel, error_count = :zero, success_streak = :zero, last_updated = :timestamp",
        ExpressionAttributeValues: {
          ":newLevel": 3,
          ":zero": 0,
          ":timestamp": now,
        },
      })
    );
    console.log(JSON.stringify({ event: "LEVEL_TRANSITION", from: 2, to: 3, reason: "error_count >= 10", value: errorCount, timestamp: now }));
  } else if (level === 3 && successStreak >= 5) {
    await dynamo.send(
      new UpdateCommand({
        TableName: TABLE_NAME,
        Key: { pk: "SYSTEM" },
        UpdateExpression: "SET current_level = :newLevel, error_count = :zero, success_streak = :zero, last_updated = :timestamp",
        ExpressionAttributeValues: {
          ":newLevel": 2,
          ":zero": 0,
          ":timestamp": now,
        },
      })
    );
    console.log(JSON.stringify({ event: "LEVEL_TRANSITION", from: 3, to: 2, reason: "success_streak >= 5", value: successStreak, timestamp: now }));
  } else if (level === 2 && successStreak >= 10) {
    await dynamo.send(
      new UpdateCommand({
        TableName: TABLE_NAME,
        Key: { pk: "SYSTEM" },
        UpdateExpression: "SET current_level = :newLevel, error_count = :zero, success_streak = :zero, last_updated = :timestamp",
        ExpressionAttributeValues: {
          ":newLevel": 1,
          ":zero": 0,
          ":timestamp": now,
        },
      })
    );
    console.log(JSON.stringify({ event: "LEVEL_TRANSITION", from: 2, to: 1, reason: "success_streak >= 10", value: successStreak, timestamp: now }));
  }

  // 11. Retornar exactamente lo que devolvió la Lambda de nivel
  return levelResponse;
};
