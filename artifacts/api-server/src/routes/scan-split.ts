import { Router } from "express";
import OpenAI from "openai";

const router = Router();

const openai = new OpenAI({
  baseURL: process.env["AI_INTEGRATIONS_OPENAI_BASE_URL"],
  apiKey: process.env["AI_INTEGRATIONS_OPENAI_API_KEY"] ?? "dummy",
});

const SYSTEM_PROMPT = `You are a fitness assistant that parses workout plans from images.
Extract the workout split information and return ONLY a valid JSON object with this exact structure:
{
  "name": "Split name (e.g. Push Pull Legs, 5-Day Bro Split)",
  "days": [
    {
      "dayOfWeek": "Monday",
      "sessionType": "Push",
      "exercises": [
        {
          "name": "Bench Press",
          "muscleGroup": "Chest",
          "sets": 4,
          "reps": "6-10",
          "weight": 0,
          "unit": "kg",
          "restSeconds": 90,
          "notes": "",
          "type": "strength"
        }
      ]
    }
  ]
}

Rules:
- sessionType must be one of: Push, Pull, Legs, Upper, Lower, Full Body, Cardio, Rest, Custom
- type must be "strength" or "cardio"
- unit must be "kg" or "lbs"
- If day has no exercises, set exercises to []
- If a day is a rest day, set sessionType to "Rest"
- Always include all 7 days of the week (Monday through Sunday)
- Return ONLY the JSON, no markdown, no explanation`;

router.post("/scan-split", async (req, res) => {
  const { imageBase64, mimeType } = req.body as { imageBase64?: string; mimeType?: string };

  if (!imageBase64 || !mimeType) {
    res.status(400).json({ error: "imageBase64 and mimeType are required" });
    return;
  }

  const dataUrl = `data:${mimeType};base64,${imageBase64}`;

  const completion = await openai.chat.completions.create({
    model: "gpt-5-mini",
    max_completion_tokens: 4096,
    messages: [
      { role: "system", content: SYSTEM_PROMPT },
      {
        role: "user",
        content: [
          { type: "image_url", image_url: { url: dataUrl } },
          { type: "text", text: "Parse this workout plan into the JSON structure specified." },
        ],
      },
    ],
  });

  const raw = completion.choices[0]?.message?.content ?? "{}";

  let parsed: unknown;
  try {
    const clean = raw.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
    parsed = JSON.parse(clean);
  } catch {
    req.log.error({ raw }, "Failed to parse AI response as JSON");
    res.status(422).json({ error: "Could not parse workout plan from image" });
    return;
  }

  res.json({ split: parsed });
});

export default router;
