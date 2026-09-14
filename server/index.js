import { app } from "./app.js";
const server = app.listen(
  Number(process.env.PORT || 3001),
  process.env.HOST || "127.0.0.1",
  () =>
    console.log("QAANSHEEG API ready on port " + (process.env.PORT || 3001)),
);
server.requestTimeout = 30000;
server.headersTimeout = 15000;
