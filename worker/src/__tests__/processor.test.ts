import { describe, it, expect, vi, beforeEach } from "vitest";
import { createProcessor, registerHandler, getHandler, JobData } from "../processor";
import { Job } from "bullmq";

vi.mock("../db", () => ({
  markJobRunning: vi.fn().mockResolvedValue(undefined),
  markJobCompleted: vi.fn().mockResolvedValue(undefined),
  markJobFailed: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("../handlers/rubric", () => ({
  handleRubricGenerate: vi.fn().mockResolvedValue({
    success: true,
    data: { assessmentId: "test", rubric: {}, generatedAt: "2026-01-01" },
  }),
}));

import { markJobRunning, markJobCompleted, markJobFailed } from "../db";

describe("createProcessor", () => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const mockPool = {} as any;

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should dispatch rubric.generate to the rubric handler", async () => {
    const processor = createProcessor(mockPool);
    const mockJob = {
      data: {
        jobId: "test-uuid-1",
        type: "rubric.generate",
        payload: { assessmentId: "assess-123" },
      },
      name: "rubric.generate",
    } as Job<JobData>;

    await processor(mockJob);

    expect(markJobRunning).toHaveBeenCalledWith(mockPool, "test-uuid-1");
    expect(markJobCompleted).toHaveBeenCalledWith(
      mockPool,
      "test-uuid-1",
      expect.objectContaining({ assessmentId: "test" })
    );
    expect(markJobFailed).not.toHaveBeenCalled();
  });

  it("should fail for unknown job types", async () => {
    const processor = createProcessor(mockPool);
    const mockJob = {
      data: {
        jobId: "test-uuid-2",
        type: "unknown.type",
        payload: {},
      },
      name: "unknown.type",
    } as Job<JobData>;

    await processor(mockJob);

    expect(markJobRunning).toHaveBeenCalledWith(mockPool, "test-uuid-2");
    expect(markJobFailed).toHaveBeenCalledWith(
      mockPool,
      "test-uuid-2",
      expect.stringContaining("No handler registered")
    );
    expect(markJobCompleted).not.toHaveBeenCalled();
  });

  it("should use job.name as fallback when job.data.type is missing", async () => {
    const processor = createProcessor(mockPool);
    const mockJob = {
      data: {
        jobId: "test-uuid-3",
        payload: { assessmentId: "assess-456" },
      },
      name: "rubric.generate",
    } as unknown as Job<JobData>;

    await processor(mockJob);

    expect(markJobRunning).toHaveBeenCalledWith(mockPool, "test-uuid-3");
    expect(markJobCompleted).toHaveBeenCalled();
  });

  it("should handle unhandled errors and mark job as failed", async () => {
    const errorHandler = vi.fn().mockRejectedValue(new Error("Handler crash"));
    registerHandler("crash.test", errorHandler);

    const processor = createProcessor(mockPool);
    const mockJob = {
      data: {
        jobId: "test-uuid-4",
        type: "crash.test",
        payload: {},
      },
      name: "crash.test",
    } as Job<JobData>;

    await expect(processor(mockJob)).rejects.toThrow("Handler crash");

    expect(markJobRunning).toHaveBeenCalledWith(mockPool, "test-uuid-4");
    expect(markJobFailed).toHaveBeenCalledWith(
      mockPool,
      "test-uuid-4",
      "Handler crash"
    );
  });
});

describe("registerHandler / getHandler", () => {
  it("should register and retrieve a handler", () => {
    const handler = vi.fn();
    registerHandler("test.handler", handler);
    expect(getHandler("test.handler")).toBe(handler);
  });

  it("should return undefined for unregistered type", () => {
    expect(getHandler("nonexistent.type")).toBeUndefined();
  });
});
