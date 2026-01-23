import { supabase } from "@/lib/supabaseClient";

export async function trackEvent(
  eventName: string,
  properties: Record<string, any> = {}
) {
  try {
    // get current user (may be null if not logged in)
    const { data } = await supabase.auth.getUser();
    const user = data?.user ?? null;

    const { error } = await supabase.from("events").insert({
      user_id: user?.id ?? null,
      event_name: eventName,
      properties: properties ?? {},
    });

    if (error) {
      console.error("trackEvent insert error:", error.message);
    }
  } catch (err) {
    console.error("trackEvent unexpected error:", err);
  }
}
