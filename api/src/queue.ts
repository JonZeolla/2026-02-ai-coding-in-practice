import { Queue } from "bullmq";
import { config } from "./config";

let jobQueue: Queue;

export function getQueue(connection?: { host: string; port: number }): Queue {
  if (!jobQueue) {
    jobQueue = new Queue("jobs", {
      connection: connection || config.redis,
    });
  }
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
