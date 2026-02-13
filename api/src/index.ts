import app from "./app";
import { config } from "./config";

app.listen(config.port, () => {
  console.log(`Job Queue API listening on port ${config.port}`);
});
