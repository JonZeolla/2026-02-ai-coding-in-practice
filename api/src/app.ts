import express from "express";
import routes from "./routes";
import assessmentRoutes from "./routes/assessments";
import candidateRoutes from "./routes/candidates";
import interviewRoutes from "./routes/interview";
import prReviewRoutes from "./routes/pr-review";
import behavioralRoutes from "./routes/behavioral";

const app = express();

app.use(express.json());
app.use(routes);
app.use(assessmentRoutes);
app.use(candidateRoutes);
app.use(interviewRoutes);
app.use(prReviewRoutes);
app.use(behavioralRoutes);

export default app;
