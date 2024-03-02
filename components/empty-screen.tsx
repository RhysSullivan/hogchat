import { Button } from "@/components/ui/button";
import { ExternalLink } from "@/components/external-link";
import { IconArrowRight } from "@/components/ui/icons";

export function EmptyScreen({
  submitMessage,
  zeroState,
}: {
  submitMessage: (message: string) => void;
  zeroState: React.ReactNode;
}) {
  return (
    <div className="mx-auto max-w-2xl px-4">
      <div className="rounded-lg border bg-background p-8 mb-4">
        <h1 className="mb-2 text-lg font-semibold">Welcome to HogChat!</h1>
        <p className="mb-2 leading-normal text-muted-foreground">
          This is a demo of an interactive financial assistant. It can show you
          stocks, tell you their prices, and even help you buy shares.
        </p>
        <p className="mb-2 leading-normal text-muted-foreground">
          The demo is built with{" "}
          <ExternalLink href="https://nextjs.org">Next.js</ExternalLink> and the{" "}
          <ExternalLink href="https://sdk.vercel.ai/docs">
            Vercel AI SDK
          </ExternalLink>
          .
        </p>
        <p className="mb-2 leading-normal text-muted-foreground">
          It uses{" "}
          <ExternalLink href="https://vercel.com/blog/ai-sdk-3-generative-ui">
            React Server Components
          </ExternalLink>{" "}
          to combine text with UI generated as output of the LLM. The UI state
          is synced through the SDK so the model is aware of your interactions
          as they happen.
        </p>
        <p className="leading-normal text-muted-foreground">Try an example:</p>
      </div>
      <p className="leading-normal text-muted-foreground text-[0.8rem] text-center">
        Note: This is not real financial advice.
      </p>
    </div>
  );
}
