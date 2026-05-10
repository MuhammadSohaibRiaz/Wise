import { NextResponse } from "next/server";
import nodemailer from "nodemailer";
import { z } from "zod";

export const runtime = "nodejs";

const requestSchema = z.object({
  name: z.string().min(2),
  email: z.string().email(),
  datetime: z.string().min(4),
  timezone: z.string().optional(),
  channel: z.string().optional(),
  agenda: z.string().optional(),
});

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: Number(process.env.SMTP_PORT || 587),
  secure: Number(process.env.SMTP_PORT || 587) === 465,
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

export async function POST(req: Request) {
  try {
    const json = await req.json();
    const data = requestSchema.parse(json);

    const to = process.env.MEETING_NOTIFY_EMAIL || process.env.SMTP_USER;
    const from = process.env.FROM_EMAIL || process.env.SMTP_USER;

    if (!to || !from) {
      return NextResponse.json(
        { error: "Email configuration missing" },
        { status: 500 }
      );
    }

    await transporter.sendMail({
      to,
      from,
      subject: `📅 New meeting request from ${data.name}`,
      text: [
        `Name: ${data.name}`,
        `Email: ${data.email}`,
        `Preferred time: ${data.datetime}`,
        `Timezone: ${data.timezone || "not provided"}`,
        `Channel: ${data.channel || "not provided"}`,
        `Agenda: ${data.agenda || "not provided"}`,
      ].join("\n"),
      html: `
        <h2>New Meeting Request</h2>
        <p><strong>Name:</strong> ${data.name}</p>
        <p><strong>Email:</strong> ${data.email}</p>
        <p><strong>Preferred time:</strong> ${data.datetime}</p>
        <p><strong>Timezone:</strong> ${data.timezone || "not provided"}</p>
        <p><strong>Channel:</strong> ${data.channel || "not provided"}</p>
        <p><strong>Agenda:</strong> ${data.agenda || "not provided"}</p>
      `,
    });

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("Meeting API error:", err);
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}