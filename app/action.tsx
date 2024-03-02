import "server-only";

import { createAI, createStreamableUI, getMutableAIState } from "ai/rsc";
import OpenAI from "openai";

import {
  spinner,
  BotCard,
  BotMessage,
  SystemMessage,
  Stock,
  Purchase,
  Stocks,
  Events,
} from "@/components/llm-stocks";

import {
  runAsyncFnWithoutBlocking,
  sleep,
  formatNumber,
  runOpenAICompletion,
} from "@/lib/utils";
import { z } from "zod";
import { StockSkeleton } from "@/components/llm-stocks/stock-skeleton";
import { EventsSkeleton } from "@/components/llm-stocks/events-skeleton";
import { StocksSkeleton } from "@/components/llm-stocks/stocks-skeleton";
import { fetchAllEventsWithProperties } from "./posthog";
import { MDXRemote } from "next-mdx-remote/rsc";
import { supportedAggregates, supportedFunctions } from "./supported";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY || "",
});

export const chartTypes = ["table", "chart", "number"] as const;

async function submitUserMessage(content: string) {
  "use server";
  const events = await fetchAllEventsWithProperties({
    posthogProjectId: process.env.POSTHOG_PROJECT_ID,
    posthogToken: process.env.POSTHOG_API_KEY,
  });
  const aiState = getMutableAIState<typeof AI>();
  aiState.update([
    ...aiState.get(),
    {
      role: "user",
      content,
    },
  ]);

  const reply = createStreamableUI(
    <BotMessage className="items-center">{spinner}</BotMessage>
  );

  const stingifiedEvents = events
    .map(
      (event) => `${event.name}: {
      ${event.properties.map((property) => `${property.name}: ${property.type}`).join(", ")}
    }`
    )
    .join(", ")
    .replace("$sent_at", "timestamp");
  const prompt = `\
  You are a data analytics bot for the product PostHog and you can help users query their data.
  You and the user can discuss their events and the user can request to create new queries or refine existing ones, in the UI.
  
  The user has the following events and properties:
  ${stingifiedEvents}
        
  Feel free to be creative with suggesting queries and follow ups based on what you think. Keep responses short and to the point.`;
  const completion = runOpenAICompletion(openai, {
    model: "gpt-3.5-turbo",
    stream: true,
    messages: [
      // TODO: Add back to prompt
      // Messages inside [] means that it's a UI element or a user event. For example:
      // - "[Price of AAPL = 100]" means that an interface of the stock price of AAPL is shown to the user.
      // - "[User has changed the amount of AAPL to 10]" means that the user has changed the amount of AAPL to 10 in the UI.
      {
        role: "system",
        content: prompt,
      },
      ...aiState.get().map((info: any) => ({
        role: info.role,
        content: info.content,
        name: info.name,
      })),
    ],
    functions: [
      {
        name: "query_data",
        description: `Gets the results for a query about the data
        `,
        parameters: z.object({
          query: z.string().describe(`
          Creates a HogQL ClickHouse SQL Query for the given query.
          HogQL Rules:

          HogQL is based on ClickHouse SQL.
          
          The following ClickHouse functions are available:
          ${supportedFunctions.join(", ")}

          The following ClickHouse aggregate functions are available:
          ${supportedAggregates.join(", ")}
          
          If an event or property name has a space, it should be wrapped in quotes.
          
          IMPORTANT: To filter to a specific event, use FROM events WHERE event = '{event_name}'
          The only table that exists is events, every query will select from events.
          
          To get events older than 5 days, use the expression:
          
          dateDiff('day', timestamp, now()) > 5
          
          IMPORTANT: Don't end queries with a semicolon.
          IMPORTANT: Put the whole query in one line with no newlines.
          
          Use inclusive matching unless explicitly stated otherwise, i.e strings including the value rather than equal to
          For example, if you want to filter out all of Google events it would be: WHERE properties.{property_name} NOT LIKE '%Google%'
          
          Make comparisons case insensitive by using the ILIKE operator. For example, WHERE properties.{property_name} ILIKE '%google%'

          Timestamp is a DateTime type.
          
          IMPORTANT: To filter to a specific property, use WHERE properties.{property_name} = {value}
          PROPERTY VALUES HAVE TO BE PREFIXED WITH \`properties.\`
          PROPERTY VALUES HAVE TO BE PREFIXED WITH \`properties.\`
          PROPERTY VALUES HAVE TO BE PREFIXED WITH \`properties.\`
          PROPERTY VALUES HAVE TO BE PREFIXED WITH \`properties.\`
          If you do not prefix the property with \`properties.\`, the query will not work.
          In the select clause, you have to use properties.{property_name} to select a property.

          `),
          format: z.enum(chartTypes).describe("The format of the result"),
        }),
      },
    ],
    temperature: 0,
  });

  completion.onTextContent((content: string, isFinal: boolean) => {
    reply.update(
      <BotMessage>
        <MDXRemote source={content} />
      </BotMessage>
    );
    if (isFinal) {
      reply.done();
      aiState.done([...aiState.get(), { role: "assistant", content }]);
    }
  });

  completion.onFunctionCall(
    "query_data",
    async ({
      query,
      format,
    }: {
      query: string;
      format: (typeof chartTypes)[number];
    }) => {
      // for the query, split it the start to FROM
      // then split by spaces
      // for each word, check if it is a property
      // if it is and it does not have properties. in front of it, add it
      // then join the words back together
      // then join the query back together
      const splitQuery = query.split("FROM");
      const from = splitQuery[1];
      const select = splitQuery[0];
      const splitSelect = select.split(" ")!;
      const propertyNames = new Set(
        events.flatMap((event) =>
          event.properties.map((property) => property.name)
        )
      );

      const newSelect = splitSelect
        .map((word) => {
          if (propertyNames.has(word) && !word.startsWith("properties.")) {
            return `properties.${word}`;
          }
          return word;
        })
        .join(" ");
      query = `${newSelect} FROM ${from}`;

      // replace $sent_at with timestamp
      query = query.replace("$sent_at", "timestamp");
      reply.update(
        <BotCard>
          <StocksSkeleton />
        </BotCard>
      );

      const payload = {
        query: {
          kind: "HogQLQuery",
          query,
        },
      };
      const res = await fetch(
        `https://us.posthog.com/api/projects/${process.env.POSTHOG_PROJECT_ID}/query/`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${process.env.POSTHOG_API_KEY}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify(payload),
        }
      );

      const { results } = await res.json();
      console.log(results);

      reply.done(
        <BotCard>
          <div>
            <span>{query}</span>
          </div>
          <span>{JSON.stringify(results)}</span>
        </BotCard>
      );

      aiState.done([
        ...aiState.get(),
        {
          role: "function",
          name: "query_data",
          content: JSON.stringify(query),
        },
      ]);
    }
  );

  return {
    id: Date.now(),
    display: reply.value,
  };
}

// Define necessary types and create the AI.

const initialAIState: {
  role: "user" | "assistant" | "system" | "function";
  content: string;
  id?: string;
  name?: string;
}[] = [];

const initialUIState: {
  id: number;
  display: React.ReactNode;
}[] = [];

export const AI = createAI({
  actions: {
    submitUserMessage,
  },
  initialUIState,
  initialAIState,
});
