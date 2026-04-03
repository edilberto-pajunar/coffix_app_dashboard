import { NextRequest, NextResponse } from "next/server";
import { Resend } from "resend";
import { adminDb } from "@/app/lib/firebaseAdmin";
import { renderEmailTemplate } from "@/app/lib/renderEmailTemplate";

export async function POST(req: NextRequest) {
  try {
    const { templateId, to, variables = {} } = await req.json();

    if (!templateId || !to) {
      return NextResponse.json(
        { error: "templateId and to are required" },
        { status: 400 }
      );
    }

    const snap = await adminDb.collection("emails").doc(templateId).get();
    if (!snap.exists) {
      return NextResponse.json({ error: "Template not found" }, { status: 404 });
    }

    const template = snap.data()!;
    const html = renderEmailTemplate(template.content, variables);

    const resend = new Resend(process.env.RESEND_API_KEY);
    const { data, error } = await resend.emails.send({
      from: process.env.RESEND_FROM_EMAIL ?? "Coffix <no-reply@coffix.com>",
      to,
      subject: variables.subject ? String(variables.subject) : template.name,
      html,
    });

    if (error) throw new Error(error.message);
    return NextResponse.json({ id: data?.id }, { status: 200 });
  } catch (err: unknown) {
    console.error("[POST /api/send-email]", err);
    const message = err instanceof Error ? err.message : "Internal server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
