import OpenAI from "openai";
import { ClientPage } from "./client-page";
import { fetchAllEventsWithProperties } from "./posthog";
import { EventsSkeleton } from "@/components/llm-stocks/events-skeleton";
import { Suspense } from "react";
import { Button } from "@/components/ui/button";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY || "",
});

async function AutoSuggested() {
  const events = await fetchAllEventsWithProperties({
    posthogProjectId: process.env.POSTHOG_PROJECT_ID,
    posthogToken: process.env.POSTHOG_API_KEY,
  });
  const suggestedQueries = await openai.chat.completions.create({
    model: "gpt-3.5-turbo",
    temperature: 0.8,
    messages: [
      {
        role: "system",
        content: `\
        You are a data analytics bot for the product PostHog and you can help users query their data.
        You and the user can discuss their events and the user can request to create new queries or refine existing ones, in the UI.
        To help the user, you can suggest queries based on the events and their properties.
        Here are some examples of queries you can suggest to the user based on the events and their properties:
        1. Show me the number of users who have signed up in the last 30 days.
        2. How many page views did we have in the last 7 days?
        3. How many page views came from Google?
        
        Here are the events and their properties:
        ${events
          .map(
            (event) =>
              `${event.name} (${event.properties
                .map((property) => property.name)
                .join(", ")})`
          )
          .join("\n")}
        Come up with 4 queries based on the events and their properties, and suggest them to the user.
        Each query should be a single sentence and on a new line. Do not number, bullet point, or add anything extra the queries, just write them out as plain text.
        `,
      },
    ],
  });
  const completed = (
    suggestedQueries.choices.at(0)?.message?.content ?? ""
  ).split("\n");
  // put the results into 4 evenly sized buttons, aligned in a 2x2 grid
  const buttons = [];
  for (let i = 0; i < 4; i++) {
    buttons.push(completed[i]);
  }
  return buttons;
}

export default async function Page() {
  const suggestions = await AutoSuggested();
  return <ClientPage zeroState={suggestions} />;
}
