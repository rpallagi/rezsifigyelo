export async function sendEmail({
  to,
  subject,
  html,
}: {
  to: string;
  subject: string;
  html: string;
}) {
  const apiKey = process.env.RESEND_API_KEY;
  const from =
    process.env.EMAIL_FROM ?? "Rezsi Figyelő <noreply@rezsikovetes.hu>";

  if (!apiKey) {
    console.log(`[Email] (dev mode) To: ${to}, Subject: ${subject}`);
    return { success: true, dev: true };
  }

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ from, to, subject, html }),
  });

  if (!res.ok) {
    const error = await res.text();
    console.error(`[Email] Failed to send: ${error}`);
    return { success: false, error };
  }

  return { success: true };
}
