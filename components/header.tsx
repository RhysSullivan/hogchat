import Link from "next/link";

import {
  IconGitHub,
  IconSeparator,
  IconSparkles,
  IconVercel,
} from "@/components/ui/icons";
import { Button } from "@/components/ui/button";

export async function Header() {
  return (
    <header className="sticky top-0 z-50 flex items-center justify-between w-full px-4 border-b h-14 shrink-0 bg-background backdrop-blur-xl">
      <span className="inline-flex items-center home-links whitespace-nowrap">
        <Link href="/">
          <span className="text-lg font-bold">
            <IconSparkles className="inline mr-0 w-4 sm:w-5 mb-0.5" />
            HogChat
          </span>
        </Link>
      </span>
      <div className="flex items-center justify-end space-x-2">
        <Button variant="outline" asChild>
          <a
            target="_blank"
            href="https://github.com/vercel/ai/tree/main/examples/next-ai-rsc"
            rel="noopener noreferrer"
          >
            <IconGitHub />
            <span className="hidden ml-2 md:flex">GitHub</span>
          </a>
        </Button>
      </div>
    </header>
  );
}
