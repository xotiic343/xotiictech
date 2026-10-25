// Browser helper for /support/api calls. Returns the parsed body or throws an Error with the server's message.
export async function postJson<T = unknown>(url: string, body: unknown): Promise<T> {
  let res: Response;
  try {
    res = await fetch(url, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
  } catch {
    throw new Error("Network error. Check your connection and try again.");
  }
  const json = (await res.json().catch(() => ({}))) as { data?: T; error?: { message?: string } };
  if (!res.ok) throw new Error(json.error?.message ?? "Something went wrong. Please try again.");
  return json.data as T;
}
