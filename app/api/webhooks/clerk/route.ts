import { verifyWebhook } from "@clerk/nextjs/webhooks";
import { NextRequest, NextResponse } from "next/server";
import { upsertUser, deleteUser } from "@/app/features/users/db";

export async function POST(request: NextRequest) {
  try {
    const event = await verifyWebhook(request);

    switch (event.type) {
      case "user.created":
      case "user.updated":
        const clerkData = event.data;
        const email = clerkData.email_addresses.find(
          (e) => e.id === clerkData.primary_email_address_id,
        )?.email_address;

        if (!email) {
          return NextResponse.json(
            { error: "Email not found" },
            { status: 400 },
          );
        }

        await upsertUser({
          id: clerkData.id,
          email,
          name: `${clerkData.first_name} ${clerkData.last_name}`,
          imageUrl: clerkData.image_url,
          createdAt: new Date(clerkData.created_at),
          updatedAt: new Date(clerkData.updated_at),
        });

        break;
      case "user.deleted":
        if (!event.data.id) {
          return NextResponse.json(
            { error: "User ID not found" },
            { status: 400 },
          );
        }
        await deleteUser(event.data.id);
    }

    return NextResponse.json({ success: true }, { status: 200 });
  } catch (error) {
    console.error("Webhook error:", error);
    return NextResponse.json({ error: "Invalid webhook" }, { status: 400 });
  }
}
