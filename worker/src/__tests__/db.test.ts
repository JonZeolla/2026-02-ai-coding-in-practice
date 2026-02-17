import { describe, it, expect, vi, beforeEach } from "vitest";
import { markJobRunning, markJobCompleted, markJobFailed, getJob } from "../db";

describe("database operations", () => {
  let mockPool: any;

  beforeEach(() => {
    mockPool = {
      query: vi.fn().mockResolvedValue({ rows: [], rowCount: 1 }),
    };
  });

  describe("markJobRunning", () => {
    it("should update job status to running with started_at", async () => {
      await markJobRunning(mockPool, "uuid-123");

      expect(mockPool.query).toHaveBeenCalledTimes(1);
      const [sql, params] = mockPool.query.mock.calls[0];
      expect(sql).toContain("status = 'running'");
      expect(sql).toContain("started_at = NOW()");
      expect(sql).toContain("updated_at = NOW()");
      expect(params).toEqual(["uuid-123"]);
    });
  });

  describe("markJobCompleted", () => {
    it("should update job with completed status and result JSON", async () => {
      const result = { processedAt: "2024-01-01", summary: "done" };
      await markJobCompleted(mockPool, "uuid-456", result);

      expect(mockPool.query).toHaveBeenCalledTimes(1);
      const [sql, params] = mockPool.query.mock.calls[0];
      expect(sql).toContain("status = 'completed'");
      expect(sql).toContain("completed_at = NOW()");
      expect(params[0]).toBe(JSON.stringify(result));
      expect(params[1]).toBe("uuid-456");
    });
  });

  describe("markJobFailed", () => {
    it("should update job with failed status and error text", async () => {
      await markJobFailed(mockPool, "uuid-789", "Something went wrong");

      expect(mockPool.query).toHaveBeenCalledTimes(1);
      const [sql, params] = mockPool.query.mock.calls[0];
      expect(sql).toContain("status = 'failed'");
      expect(sql).toContain("completed_at = NOW()");
      expect(params[0]).toBe("Something went wrong");
      expect(params[1]).toBe("uuid-789");
    });
  });

  describe("getJob", () => {
    it("should return the job when found", async () => {
      const mockJob = {
        id: "uuid-abc",
        type: "email.send",
        status: "completed",
        payload: { to: "user@test.com" },
        result: { summary: "done" },
        error: null,
        created_at: new Date(),
        updated_at: new Date(),
        started_at: new Date(),
        completed_at: new Date(),
      };
      mockPool.query.mockResolvedValue({ rows: [mockJob] });

      const job = await getJob(mockPool, "uuid-abc");

      expect(job).toEqual(mockJob);
      expect(mockPool.query).toHaveBeenCalledWith(
        expect.stringContaining("SELECT * FROM jobs"),
        ["uuid-abc"]
      );
    });

    it("should return null when job not found", async () => {
      mockPool.query.mockResolvedValue({ rows: [] });

      const job = await getJob(mockPool, "nonexistent");

      expect(job).toBeNull();
    });
  });
});
