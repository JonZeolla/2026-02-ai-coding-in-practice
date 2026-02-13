import { Queue } from "bullmq";
import { config } from "./config";

let jobQueue: Queue = new Queue("jobs", {
  connection: config.redis,
});

export function getQueue(): Queue {
  return jobQueue;
}

export function setQueue(newQueue: Queue): void {
  jobQueue = newQueue;
}

export async function closeQueue(): Promise<void> {
  if (jobQueue) {
    await jobQueue.close();
  }
}
