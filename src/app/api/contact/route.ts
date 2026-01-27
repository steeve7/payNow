import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY);

function sanitize(s: any) {
  return String(s || "").trim();
}

function getClientIp(req: Request) {
  // Common headers from Vercel/Cloudflare/Nginx
  const xff = req.headers.get("x-forwarded-for");
  const realIp = req.headers.get("x-real-ip");
  const cfIp = req.headers.get("cf-connecting-ip");

  // x-forwarded-for can be: "client, proxy1, proxy2"
  const ip =
    (xff ? xff.split(",")[0].trim() : "") ||
    (cfIp || "").trim() ||
    (realIp || "").trim();

  return ip || null;
}

export async function POST(req: Request) {
  try {
    const supabase = await createSupabaseServerClient();

    const body = await req.json();
    const name = sanitize(body?.name);
    const email = sanitize(body?.email);
    const subject = sanitize(body?.subject);
    const message = sanitize(body?.message);

    if (!name || !email || !subject || !message) {
      return NextResponse.json({ error: "Missing fields" }, { status: 400 });
    }

    const ip = getClientIp(req);
    const userAgent = req.headers.get("user-agent") || null;

    // ---------------------------
    // 1) Rate limit (5 per 10 mins per IP)
    // ---------------------------
    if (ip) {
      const tenMinsAgo = new Date(Date.now() - 10 * 60 * 1000).toISOString();

      const { count, error: countErr } = await supabase
        .from("contact_submissions")
        .select("id", { count: "exact", head: true })
        .eq("ip_address", ip) // inet can compare to string ip safely
        .gte("created_at", tenMinsAgo);

      if (countErr) {
        // If rate-limit check fails, do not block user; just log it
        console.error("Rate limit check failed:", countErr);
      } else if ((count || 0) >= 5) {
        return NextResponse.json(
          {
            error:
              "Too many messages from your network. Please wait a bit and try again.",
          },
          { status: 429 }
        );
      }
    }

    // ---------------------------
    // 2) Save submission (+ ip + user_agent)
    // ---------------------------
    const { data: inserted, error: insertErr } = await supabase
      .from("contact_submissions")
      .insert([
        {
          name,
          email,
          subject,
          message,
          status: "unread",
          ip_address: ip, // inet
          user_agent: userAgent,
        },
      ])
      .select("id, created_at")
      .single();

    if (insertErr) {
      return NextResponse.json({ error: insertErr.message }, { status: 500 });
    }

    // ---------------------------
    // 3) Email all customer_support users (+ fallback inbox)
    // ---------------------------
    const { data: supportUsers, error: supportErr } = await supabaseAdmin
      .from("profiles")
      .select("email")
      .eq("role", "customer_support");

    if (supportErr) {
      console.error("Failed to load customer_support emails:", supportErr);
    }

    const recipients = Array.from(
      new Set(
        [
          ...(supportUsers || [])
            .map((u) => (u?.email ? String(u.email).trim() : ""))
            .filter(Boolean),
          (process.env.SUPPORT_FALLBACK_EMAIL || "").trim(),
        ].filter(Boolean)
      )
    );

    const from = process.env.RESEND_FROM || "PayNow <no-reply@paynow.ng>";

    // ---------------------------
    // 4) Send support notification email (don’t fail request if email fails)
    // ---------------------------
    if (process.env.RESEND_API_KEY && recipients.length) {
      try {
        await resend.emails.send({
          from,
          to: recipients,
          subject: `New Contact Submission: ${subject}`,
          html: `
            <h2>New Contact Submission</h2>
            <p><strong>ID:</strong> ${inserted?.id}</p>
            <p><strong>Name:</strong> ${name}</p>
            <p><strong>Email:</strong> ${email}</p>
            <p><strong>Subject:</strong> ${subject}</p>
            <p><strong>Message:</strong><br/>${message.replace(/\n/g, "<br/>")}</p>
            <p><strong>Created:</strong> ${inserted?.created_at}</p>
            <hr/>
            <p style="color:#6b7280;font-size:12px;">
              IP: ${ip || "-"}<br/>
              UA: ${userAgent || "-"}
            </p>
          `,
        });
      } catch (mailErr) {
        console.error("Support notification email failed:", mailErr);
      }
    }

    // ---------------------------
    // 5) Auto-reply to customer (don’t fail request if email fails)
    // ---------------------------
    if (process.env.RESEND_API_KEY) {
      try {
        await resend.emails.send({
          from,
          to: email,
          subject: "We received your message — PayNow Support",
          html: `
            <div style="font-family:Arial,sans-serif;line-height:1.6;">
              <h2>Thanks for contacting PayNow 👋</h2>
              <p>Hi ${name},</p>
              <p>We received your message and our support team will get back to you shortly.</p>
              <p><strong>Your subject:</strong> ${subject}</p>
              <p style="color:#6b7280;font-size:14px;">
                Reference ID: <strong>${inserted?.id}</strong>
              </p>
              <hr/>
              <p style="color:#6b7280;font-size:12px;">
                If you didn’t submit this request, you can ignore this email.
              </p>
            </div>
          `,
        });
      } catch (autoReplyErr) {
        console.error("Customer auto-reply failed:", autoReplyErr);
      }
    }

    return NextResponse.json(
      {
        ok: true,
        id: inserted?.id,
        message: "Message sent! Our support team will reach out shortly.",
      },
      { status: 201 }
    );
  } catch (e: any) {
    return NextResponse.json(
      { error: e?.message || "Server error" },
      { status: 500 }
    );
  }
}
