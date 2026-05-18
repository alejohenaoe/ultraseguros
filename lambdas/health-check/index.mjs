import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, GetCommand, UpdateCommand } from "@aws-sdk/lib-dynamodb";

const dynamoClient = new DynamoDBClient({});
const dynamo = DynamoDBDocumentClient.from(dynamoClient);

const TABLE_NAME = process.env.TABLE_NAME;

export const handler = async (event) => {
  // 1. Leer estado actual del sistema
  const result = await dynamo.send(
    new GetCommand({
      TableName: TABLE_NAME,
      Key: { pk: "SYSTEM" },
    })
  );
  const state = result.Item;
  const currentLevel = Number(state.current_level);
  const errorCount = Number(state.error_count);
  const successStreak = Number(state.success_streak);
  const timestamp = new Date().toISOString();

  // 2. Loggear estado actual
  console.log(JSON.stringify({ event: "HEALTH_CHECK", current_level: currentLevel, error_count: errorCount, success_streak: successStreak, timestamp }));

  // 3. Nivel 3 con racha de éxitos suficiente → subir a Nivel 2
  if (currentLevel === 3 && successStreak >= 5) {
    await dynamo.send(
      new UpdateCommand({
        TableName: TABLE_NAME,
        Key: { pk: "SYSTEM" },
        UpdateExpression: "SET current_level = :newLevel, error_count = :zero, success_streak = :zero, last_updated = :timestamp",
        ExpressionAttributeValues: {
          ":newLevel": 2,
          ":zero": 0,
          ":timestamp": timestamp,
        },
      })
    );
    console.log(JSON.stringify({ event: "LEVEL_TRANSITION", from: 3, to: 2, reason: "success_streak", value: successStreak, timestamp }));
    return;
  }

  // 4. Nivel 2 con racha de éxitos suficiente → subir a Nivel 1
  if (currentLevel === 2 && successStreak >= 10) {
    await dynamo.send(
      new UpdateCommand({
        TableName: TABLE_NAME,
        Key: { pk: "SYSTEM" },
        UpdateExpression: "SET current_level = :newLevel, error_count = :zero, success_streak = :zero, last_updated = :timestamp",
        ExpressionAttributeValues: {
          ":newLevel": 1,
          ":zero": 0,
          ":timestamp": timestamp,
        },
      })
    );
    console.log(JSON.stringify({ event: "LEVEL_TRANSITION", from: 2, to: 1, reason: "success_streak", value: successStreak, timestamp }));
  }
};
