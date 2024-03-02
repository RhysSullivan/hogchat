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
import { Chart } from "./query-chart";
import { Code } from "bright";
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY || "",
});

export const chartTypes = ["table", "chart", "number"] as const;
export type ChartType = (typeof chartTypes)[number];

const zOpenAIQueryResponse = z.object({
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
  
  To count the number of events, you can use countIf(event = '{event_name}')

  IMPORTANT: To filter to a specific property, use WHERE properties.{property_name} = {value}
  PROPERTY VALUES HAVE TO BE PREFIXED WITH \`properties.\`
  PROPERTY VALUES HAVE TO BE PREFIXED WITH \`properties.\`
  PROPERTY VALUES HAVE TO BE PREFIXED WITH \`properties.\`
  PROPERTY VALUES HAVE TO BE PREFIXED WITH \`properties.\`
  If you do not prefix the property with \`properties.\`, the query will not work.
  In the select clause, you have to use properties.{property_name} to select a property.

  `),
  format: z.enum(chartTypes).describe("The format of the result"),
  title: z.string().optional().describe("The title of the chart"),
});

type OpenAIQueryResponse = z.infer<typeof zOpenAIQueryResponse>;

export type QueryResult = {
  columns: string[];
  results: (number | string)[][];
};

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
  
  Messages inside [] means that it's a UI element or a user event. For example:
  - "[Results for query: query with format: format and title: title and description: description. with data" means that a chart/table/number card is shown to that user.

  The user has the following events and properties:
  ${stingifiedEvents}
        
  Feel free to be creative with suggesting queries and follow ups based on what you think. Keep responses short and to the point.`;
  const completion = runOpenAICompletion(openai, {
    model: "gpt-3.5-turbo",
    stream: true,
    messages: [
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
        parameters: zOpenAIQueryResponse,
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
    async (input: OpenAIQueryResponse) => {
      const { format, title } = input;
      let query = input.query;
      const propertyNames = new Set(
        events.flatMap((event) =>
          event.properties.map((property) => property.name)
        )
      );

      // for each word in propertyNames, replace it with properties.{word} unless it's already prefixed with properties.
      // if the property name has a space in it, wrap it in quotes
      query = query.replace(
        new RegExp(Array.from(propertyNames).join("|"), "g"),
        (match) => {
          if (match.includes(" ")) {
            return `properties.${match}`;
          }
          if (match.startsWith("properties.")) {
            return match;
          }
          return `properties.${match}`;
        }
      );

      // replace $sent_at with timestamp
      query = query.replace("$sent_at", "timestamp");

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

      const queryRes = (await res.json()) as QueryResult;

      reply.done(
        <BotCard>
          <SystemMessage>
            <div className="py-4">
              <Chart chartType={format} queryResult={queryRes} title={title} />
              <div className="py-4">
                <Code lang="sql">{query}</Code>
              </div>
            </div>
          </SystemMessage>
        </BotCard>
      );

      aiState.done([
        ...aiState.get(),
        {
          role: "function",
          name: "query_data",
          content: `[Results for query: ${query} with format: ${format} and title: ${title}]`,
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
