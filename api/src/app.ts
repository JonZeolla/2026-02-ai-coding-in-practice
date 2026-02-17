import express from "express";
import routes from "./routes";
import assessmentRoutes from "./routes/assessments";
import candidateRoutes from "./routes/candidates";

const app = express();

app.use(express.json());
app.use(routes);
app.use(assessmentRoutes);
app.use(candidateRoutes);

export default app;
