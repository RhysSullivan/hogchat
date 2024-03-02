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
          This is an interactive chat with your PostHog data. You can ask for
          insights, compare events, and visualize your data.
        </p>
      </div>
      <p className="leading-normal text-muted-foreground text-[0.8rem] text-center">
        Note: This is not real financial advice.
      </p>
    </div>
  );
}
