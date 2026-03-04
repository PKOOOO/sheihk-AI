import { generateText, gateway } from "ai";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const lat = searchParams.get("lat");
  const lon = searchParams.get("lon");

  if (!lat || !lon) {
    return new Response("lat and lon query parameters are required", {
      status: 400,
    });
  }

  const apiKey = process.env.OPENWEATHER_API_KEY;
  if (!apiKey) {
    return new Response("Weather API not configured", { status: 500 });
  }

  // Use current weather endpoint (included in free plan).
  const url = new URL("https://api.openweathermap.org/data/2.5/weather");
  url.searchParams.set("lat", lat);
  url.searchParams.set("lon", lon);
  url.searchParams.set("units", "metric");
  url.searchParams.set("appid", apiKey);

  const weatherRes = await fetch(url.toString());
  if (!weatherRes.ok) {
    const body = await weatherRes.text().catch(() => "");
    console.error(
      "[/api/weather] OpenWeather error:",
      weatherRes.status,
      weatherRes.statusText,
      body,
    );
    return new Response("Failed to fetch weather data from OpenWeather", {
      status: 502,
    });
  }

  const data = (await weatherRes.json()) as {
    main: { temp: number; humidity: number };
    weather: { main: string; description: string }[];
  };

  const currentTemp = data.main?.temp;
  const currentHumidity = data.main?.humidity;
  const currentCondition = data.weather?.[0];

  let tip = "Weather loaded. AI tip is temporarily unavailable.";

  try {
    const { text } = await generateText({
      model: gateway("claude-sonnet-4-20250514"),
      system:
        "You are an agronomist advising African smallholder farmers. " +
        "Given today's weather, return ONE short, practical farming tip sentence for a farmer in East or Sub-Saharan Africa. " +
        "Focus on soil moisture, planting, disease risk, or harvesting as relevant. " +
        "Keep it under 25 words and avoid repeating the weather numbers.",
      prompt: `Today's weather for a farmer:
Location: lat=${lat}, lon=${lon}
Current temperature: ${currentTemp}°C
Current humidity: ${currentHumidity}%
Current condition: ${currentCondition?.main} - ${currentCondition?.description}

Return exactly one concise tip sentence.`,
    });
    tip = text.trim();
  } catch (error) {
    console.error("[/api/weather] Failed to generate AI farming tip:", error);
  }

  return Response.json({
    temperature: currentTemp,
    condition: currentCondition?.main ?? "Unknown",
    humidity: currentHumidity,
    tip,
    forecast: [],
  });
}

