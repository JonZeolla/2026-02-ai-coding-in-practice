import { describe, it, expect, vi, beforeEach } from "vitest";
import { simulateWork, createProcessor, JobData } from "../processor";
import { Job } from "bullmq";

// Mock the db module
vi.mock("../db", () => ({
  markJobRunning: vi.fn().mockResolvedValue(undefined),
  markJobCompleted: vi.fn().mockResolvedValue(undefined),
  markJobFailed: vi.fn().mockResolvedValue(undefined),
}));

import { markJobRunning, markJobCompleted, markJobFailed } from "../db";

describe("simulateWork", () => {
  it("should return success for normal job types", async () => {
    const result = await simulateWork("email.send", { to: "user@test.com" }, 10);

    expect(result.success).toBe(true);
    expect(result.data).toBeDefined();
    expect(result.data!.inputType).toBe("email.send");
    expect(result.data!.summary).toContain("email.send");
    expect(result.data!.processedAt).toBeDefined();
  });

  it("should return failure for 'fail' job type", async () => {
    const result = await simulateWork("fail", {}, 10);

    expect(result.success).toBe(false);
    expect(result.error).toContain("Simulated failure");
    expect(result.error).toContain("fail");
  });

  it("should return failure when payload.shouldFail is true", async () => {
    const result = await simulateWork("email.send", { shouldFail: true }, 10);

    expect(result.success).toBe(false);
    expect(result.error).toBeDefined();
  });

  it("should respect the delay parameter", async () => {
    const start = Date.now();
    await simulateWork("test", {}, 100);
    const elapsed = Date.now() - start;

    expect(elapsed).toBeGreaterThanOrEqual(90);
  });

  it("should use default delay when none specified", async () => {
    const start = Date.now();
    await simulateWork("test", {}, 10);
    const elapsed = Date.now() - start;

    expect(elapsed).toBeGreaterThanOrEqual(5);
  });
});

describe("createProcessor", () => {
  const mockPool = {} as any;

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should mark job as running, then completed on success", async () => {
    const processor = createProcessor(mockPool, 10);
    const mockJob = {
      data: {
        jobId: "test-uuid-123",
        type: "email.send",
        payload: { to: "user@test.com" },
      },
    } as Job<JobData>;

    await processor(mockJob);

    expect(markJobRunning).toHaveBeenCalledWith(mockPool, "test-uuid-123");
    expect(markJobCompleted).toHaveBeenCalledWith(
      mockPool,
      "test-uuid-123",
      expect.objectContaining({
        inputType: "email.send",
        summary: expect.stringContaining("email.send"),
      })
    );
    expect(markJobFailed).not.toHaveBeenCalled();
  });

  it("should mark job as running, then failed on failure", async () => {
    const processor = createProcessor(mockPool, 10);
    const mockJob = {
      data: {
        jobId: "test-uuid-456",
        type: "fail",
        payload: {},
      },
    } as Job<JobData>;

    await processor(mockJob);

    expect(markJobRunning).toHaveBeenCalledWith(mockPool, "test-uuid-456");
    expect(markJobFailed).toHaveBeenCalledWith(
      mockPool,
      "test-uuid-456",
      expect.stringContaining("Simulated failure")
    );
    expect(markJobCompleted).not.toHaveBeenCalled();
  });

  it("should mark job as failed when payload indicates failure", async () => {
    const processor = createProcessor(mockPool, 10);
    const mockJob = {
      data: {
        jobId: "test-uuid-789",
        type: "report.generate",
        payload: { shouldFail: true },
      },
    } as Job<JobData>;

    await processor(mockJob);

    expect(markJobRunning).toHaveBeenCalledWith(mockPool, "test-uuid-789");
    expect(markJobFailed).toHaveBeenCalledWith(
      mockPool,
      "test-uuid-789",
      expect.any(String)
    );
    expect(markJobCompleted).not.toHaveBeenCalled();
  });
});
