import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
);

async function run() {
  const { data } = await supabase.from("passkeys").select("*").limit(1);
  console.log("Returned public_key:", data[0]?.public_key);
}
run();
