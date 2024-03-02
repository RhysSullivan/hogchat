"use client";

import { useActions, useUIState } from "ai/rsc";

import type { AI } from "../../app/action";

export function Stocks({ stocks }: { stocks: any }) {
  const [, setMessages] = useUIState<typeof AI>();
  const { submitUserMessage } = useActions();
  return (
    <div className="flex flex-col sm:flex-row text-sm gap-2 mb-4 overflow-y-scroll pb-4 prose-dark">
      <span></span>
    </div>
  );
}
