import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { MASCOT } from "@/components/kit";

export default function NotFound() {
  return (
    <main className="grid min-h-dvh place-items-center bg-background p-4 text-center">
      <div>
        <span className="float-soft inline-block text-7xl" aria-hidden="true">{MASCOT}</span>
        <h1 className="mt-4 font-display text-4xl font-semibold">We can't find that page</h1>
        <p className="mt-2 text-muted-foreground">It may have moved. Let's get you back home.</p>
        <Button asChild className="mt-6"><Link to="/">Go home</Link></Button>
      </div>
    </main>
  );
}
