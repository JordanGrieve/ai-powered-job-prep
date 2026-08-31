import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@clerk/nextjs/webhooks", () => ({ verifyWebhook: vi.fn() }));
vi.mock("@/app/features/users/db", () => ({
  upsertUser: vi.fn(),
  deleteUser: vi.fn(),
}));
vi.mock("@/app/data/env/server", () => ({
  env: { CLERK_WEBHOOK_SIGNING_SECRET: "whsec_test" },
}));

import { verifyWebhook } from "@clerk/nextjs/webhooks";
import { deleteUser, upsertUser } from "@/app/features/users/db";
import { POST } from "./route";

const mockedVerify = vi.mocked(verifyWebhook);
const request = {} as never;

function userEvent(
  type: "user.created" | "user.updated",
  data: Record<string, unknown> = {},
) {
  return {
    type,
    data: {
      id: "user_abc",
      primary_email_address_id: "email_1",
      email_addresses: [{ id: "email_1", email_address: "ada@example.com" }],
      first_name: "Ada",
      last_name: "Lovelace",
      image_url: "https://img.clerk.com/ada",
      created_at: 1700000000000,
      updated_at: 1700000000000,
      ...data,
    },
  };
}

beforeEach(() => vi.clearAllMocks());

describe("clerk webhook", () => {
  it("upserts the user with the primary email on user.created", async () => {
    mockedVerify.mockResolvedValue(userEvent("user.created") as never);

    const res = await POST(request);

    expect(res.status).toBe(200);
    expect(upsertUser).toHaveBeenCalledWith(
      expect.objectContaining({
        id: "user_abc",
        email: "ada@example.com",
        name: "Ada Lovelace",
        imageUrl: "https://img.clerk.com/ada",
      }),
    );
  });

  it("picks the PRIMARY email, not merely the first one", async () => {
    mockedVerify.mockResolvedValue(
      userEvent("user.created", {
        primary_email_address_id: "email_2",
        email_addresses: [
          { id: "email_1", email_address: "old@example.com" },
          { id: "email_2", email_address: "primary@example.com" },
        ],
      }) as never,
    );

    await POST(request);

    expect(upsertUser).toHaveBeenCalledWith(
      expect.objectContaining({ email: "primary@example.com" }),
    );
  });

  // The original built name as `${first_name} ${last_name}` while Clerk types
  // both as string | null, so name-less accounts were persisted as the literal
  // "null null" into a notNull column - then rendered as avatar initials and
  // sent to Gemini as the interviewee's name.
  it("never stores the literal 'null null' when both names are null", async () => {
    mockedVerify.mockResolvedValue(
      userEvent("user.created", {
        first_name: null,
        last_name: null,
        username: null,
      }) as never,
    );

    await POST(request);

    const payload = vi.mocked(upsertUser).mock.calls[0][0];
    expect(payload.name).not.toContain("null");
    expect(payload.name).toBe("ada"); // email local part fallback
  });

  it("falls back to username when both names are null", async () => {
    mockedVerify.mockResolvedValue(
      userEvent("user.created", {
        first_name: null,
        last_name: null,
        username: "countess",
      }) as never,
    );

    await POST(request);

    expect(upsertUser).toHaveBeenCalledWith(
      expect.objectContaining({ name: "countess" }),
    );
  });

  it("uses only the non-null half when one name is missing", async () => {
    mockedVerify.mockResolvedValue(
      userEvent("user.created", { last_name: null }) as never,
    );

    await POST(request);

    expect(upsertUser).toHaveBeenCalledWith(
      expect.objectContaining({ name: "Ada" }),
    );
  });

  it("returns 400 and does not write when no email matches the primary id", async () => {
    mockedVerify.mockResolvedValue(
      userEvent("user.created", {
        primary_email_address_id: "missing",
      }) as never,
    );

    const res = await POST(request);

    expect(res.status).toBe(400);
    expect(upsertUser).not.toHaveBeenCalled();
  });

  it("deletes on user.deleted", async () => {
    mockedVerify.mockResolvedValue({
      type: "user.deleted",
      data: { id: "user_abc" },
    } as never);

    const res = await POST(request);

    expect(res.status).toBe(200);
    expect(deleteUser).toHaveBeenCalledWith("user_abc");
  });

  it("returns 400 and does not delete when user.deleted carries no id", async () => {
    mockedVerify.mockResolvedValue({
      type: "user.deleted",
      data: {},
    } as never);

    const res = await POST(request);

    expect(res.status).toBe(400);
    expect(deleteUser).not.toHaveBeenCalled();
  });

  it("returns 200 and touches no db for an unknown event type", async () => {
    mockedVerify.mockResolvedValue({
      type: "session.created",
      data: { id: "sess_1" },
    } as never);

    const res = await POST(request);

    expect(res.status).toBe(200);
    expect(upsertUser).not.toHaveBeenCalled();
    expect(deleteUser).not.toHaveBeenCalled();
  });

  // Signature failure is a config problem and must NOT be retried, so it gets
  // a 4xx. A handler failure below is retryable and must get a 5xx - the
  // original collapsed both into the same 400, so Clerk dropped events during
  // a database outage.
  it("returns 401 when signature verification fails", async () => {
    mockedVerify.mockRejectedValue(new Error("bad signature"));

    const res = await POST(request);

    expect(res.status).toBe(401);
    expect(upsertUser).not.toHaveBeenCalled();
  });

  it("returns 500 when the database write fails, so Clerk retries", async () => {
    mockedVerify.mockResolvedValue(userEvent("user.created") as never);
    vi.mocked(upsertUser).mockRejectedValue(new Error("connection terminated"));

    const res = await POST(request);

    expect(res.status).toBe(500);
  });
});
