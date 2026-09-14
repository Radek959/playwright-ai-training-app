const fs = require('fs');
const path = require('path');

const p = path.join(__dirname, '../server/src/swagger.json');
const swagger = JSON.parse(fs.readFileSync(p, 'utf8'));

// Add schemas
swagger.components.schemas.ActivityType = {
  "type": "string",
  "enum": ["task_created", "task_updated", "approval_decided"]
};
swagger.components.schemas.TaskActivityChange = {
  "type": "object",
  "properties": {
    "field": { "type": "string" },
    "before": { "type": ["string", "number", "boolean", "array", "null"] },
    "after": { "type": ["string", "number", "boolean", "array", "null"] }
  },
  "required": ["field", "before", "after"]
};
swagger.components.schemas.TaskActivity = {
  "type": "object",
  "properties": {
    "id": { "type": "string" },
    "taskId": { "type": "string" },
    "type": { "$ref": "#/components/schemas/ActivityType" },
    "changes": {
      "type": "array",
      "items": { "$ref": "#/components/schemas/TaskActivityChange" }
    },
    "createdAt": { "type": "string", "format": "date-time" }
  },
  "required": ["id", "taskId", "type", "changes", "createdAt"]
};

// Add /api/tasks/{id}/activity
swagger.paths["/api/tasks/{id}/activity"] = {
  "get": {
    "summary": "Get task activity history",
    "description": "Returns a history of successful final changes to the task (creation, updates, approval decisions). The history is stored in-memory, resets on server restart, and does not identify authenticated users. It is purely an audit of final operations recorded by the app. Events are returned sorted from newest to oldest.",
    "parameters": [
      { "name": "id", "in": "path", "required": true, "schema": { "type": "string" } }
    ],
    "responses": {
      "200": {
        "description": "List of activities",
        "content": {
          "application/json": {
            "schema": {
              "type": "array",
              "items": { "$ref": "#/components/schemas/TaskActivity" }
            }
          }
        }
      },
      "404": { "description": "Task not found" }
    }
  }
};

fs.writeFileSync(p, JSON.stringify(swagger, null, 2));
console.log("swagger updated");
