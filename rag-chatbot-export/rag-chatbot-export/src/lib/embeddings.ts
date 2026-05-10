export async function embedText(input: string): Promise<number[]> {
  const HF_API_KEY = process.env.HUGGING_FACE_API_KEY;

  if (!HF_API_KEY) {
    throw new Error("HUGGING_FACE_API_KEY is not set in environment");
  }

  const response = await fetch(
    "https://router.huggingface.co/hf-inference/models/BAAI/bge-small-en-v1.5",
    {
      headers: {
        Authorization: `Bearer ${HF_API_KEY}`,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      method: "POST",
      body: JSON.stringify({
        inputs: input,
        options: { wait_for_model: true },
      }),
    }
  );

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(
      `HF API error: ${response.status} ${response.statusText} - ${errorText}`
    );
  }

  const result = await response.json();

  // HF returns [[0.1, 0.2, ...]] for single string input
  if (Array.isArray(result)) {
    if (Array.isArray(result[0]) && typeof result[0][0] === "number") {
      return result[0];
    }
    if (typeof result[0] === "number") {
      return result as number[];
    }
  }

  throw new Error(
    `Unexpected embedding response format: ${JSON.stringify(result).substring(0, 200)}`
  );
}

export default { embedText };