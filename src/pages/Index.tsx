import { Link } from "react-router-dom";
import { ArrowRight, CheckCircle2, Gift, ListChecks, Repeat, ShieldCheck, Users, Video } from "lucide-react";
import { Button } from "@/components/ui/button";
import { BrandMark, MASCOT } from "@/components/kit";
import { KID_THEME_IDS, getKidTheme, kidThemeStyle } from "@/lib/themes";

const STEPS = [
  { icon: ListChecks, title: "Set up chores", text: "Pick from ready-made ideas or make your own, with simple steps kids can follow." },
  { icon: CheckCircle2, title: "Kids check them off", text: "Big buttons, how-to videos for some chores, and a celebration when they finish." },
  { icon: ShieldCheck, title: "You approve, they earn", text: "Approve with one tap or send it back with a kind note. Points add up to prizes." },
];

const FEATURES = [
  { icon: Video, title: "Step-by-step how-tos", text: "Short videos show how to make a bed and more, with new chores on the way." },
  { icon: ShieldCheck, title: "Gentle approvals", text: "Send a chore back with a reason and a note, and kids get another try." },
  { icon: Gift, title: "Prizes and goals", text: "Movie night, ice cream, extra screen time. Kids watch their progress grow." },
  { icon: Repeat, title: "Fair turns", text: "Chores like the dishwasher can rotate between kids each day, week or month." },
  { icon: Users, title: "More than one grown-up", text: "Every parent gets a profile, with an optional PIN to keep kids out of parent mode." },
  { icon: ListChecks, title: "Works on any screen", text: "Phone, tablet or computer. Add it to your home screen like an app." },
];

export default function Index() {
  return (
    <div className="min-h-dvh bg-background text-foreground">
      <header className="sticky top-0 z-30 border-b border-border bg-background/90 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-3 sm:px-6">
          <BrandMark />
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" asChild><Link to="/login">Log in</Link></Button>
            <Button size="sm" asChild className="hidden sm:inline-flex"><Link to="/login?mode=signup">Get started</Link></Button>
          </div>
        </div>
      </header>

      <section className="mx-auto grid max-w-6xl items-center gap-10 px-4 py-12 sm:px-6 md:grid-cols-[1.1fr_1fr] md:py-20">
        <div>
          <span className="inline-flex items-center gap-2 rounded-full bg-secondary/15 px-3 py-1 text-sm font-bold">12 kid-picked worlds</span>
          <h1 className="mt-4 font-display text-5xl font-semibold leading-[1.05] sm:text-6xl">Chores kids actually <span className="text-primary">want</span> to finish.</h1>
          <p className="mt-4 max-w-xl text-lg text-muted-foreground">Turn daily routines into a little adventure. Clear steps, a theme they choose, and rewards that build real responsibility.</p>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <Button size="lg" asChild><Link to="/login?mode=signup">Create your family<ArrowRight className="h-5 w-5" /></Link></Button>
            <Button size="lg" variant="outline" asChild><a href="#how">See how it works</a></Button>
          </div>
        </div>
        <HeroPreview />
      </section>

      <section id="how" className="mx-auto max-w-6xl px-4 py-12 sm:px-6">
        <h2 className="text-center font-display text-4xl font-semibold">How it works</h2>
        <ol className="mt-8 grid gap-4 md:grid-cols-3">
          {STEPS.map(({ icon: Icon, title, text }, index) => (
            <li key={title} className="rounded-[26px] bg-card p-6 shadow-soft">
              <span className="flex items-center gap-3">
                <span className="grid h-12 w-12 place-items-center rounded-2xl bg-primary/10 text-primary"><Icon className="h-6 w-6" /></span>
                <span className="font-display text-sm font-semibold text-muted-foreground">Step {index + 1}</span>
              </span>
              <h3 className="mt-4 font-display text-2xl font-semibold">{title}</h3>
              <p className="mt-2 text-muted-foreground">{text}</p>
            </li>
          ))}
        </ol>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-12 sm:px-6">
        <h2 className="text-center font-display text-4xl font-semibold">12 worlds they pick themselves</h2>
        <p className="mx-auto mt-2 max-w-xl text-center text-muted-foreground">Each kid chooses a theme with its own colors, font and reward token.</p>
        <ul className="mt-8 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {KID_THEME_IDS.map((id) => {
            const theme = getKidTheme(id);
            return (
              <li key={id} className="rounded-[22px] p-4 shadow-soft" style={{ ...kidThemeStyle(id), backgroundColor: theme.colors.bg, color: theme.colors.ink }}>
                <span className="grid h-12 w-12 place-items-center rounded-2xl text-2xl" style={{ background: theme.colors.primary }} aria-hidden="true">{theme.token}</span>
                <p className="mt-3 font-display text-lg font-semibold">{theme.name}</p>
                <p className="text-sm opacity-80">{theme.vibe}</p>
              </li>
            );
          })}
        </ul>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-12 sm:px-6">
        <h2 className="text-center font-display text-4xl font-semibold">Everything parents need</h2>
        <ul className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map(({ icon: Icon, title, text }) => (
            <li key={title} className="rounded-[22px] bg-card p-5 shadow-soft">
              <span className="grid h-11 w-11 place-items-center rounded-2xl bg-secondary/15 text-secondary"><Icon className="h-5 w-5" /></span>
              <h3 className="mt-3 font-display text-xl font-semibold">{title}</h3>
              <p className="mt-1 text-muted-foreground">{text}</p>
            </li>
          ))}
        </ul>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-12 sm:px-6">
        <div className="rounded-[32px] bg-primary px-6 py-12 text-center text-primary-foreground sm:px-12">
          <span className="float-soft inline-block text-6xl" aria-hidden="true">{MASCOT}</span>
          <h2 className="mt-4 font-display text-4xl font-semibold">Ready for calmer mornings?</h2>
          <p className="mx-auto mt-2 max-w-lg opacity-90">Set up your family in a few minutes. Kids don't need an email.</p>
          <Button size="lg" asChild className="mt-6 bg-white text-primary hover:bg-white/90"><Link to="/login?mode=signup">Get started<ArrowRight className="h-5 w-5" /></Link></Button>
        </div>
      </section>

      <footer className="border-t border-border">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-3 px-4 py-6 text-sm text-muted-foreground sm:flex-row sm:px-6">
          <BrandMark compact />
          <p>&copy; {new Date().getFullYear()} Responsibilities App</p>
        </div>
      </footer>
    </div>
  );
}

function HeroPreview() {
  const rows = [
    { title: "Make your bed", done: true },
    { title: "Brush teeth", done: true },
    { title: "Feed the fish", done: false },
  ];
  return (
    <div className="relative mx-auto w-full max-w-sm">
      <div className="rounded-[32px] bg-card p-5 shadow-soft">
        <div className="flex items-center justify-between">
          <p className="font-display text-2xl font-semibold">Good morning, Mia!</p>
          <span className="rounded-full bg-accent/30 px-3 py-1 font-display font-semibold">⭐ 24</span>
        </div>
        <ul className="mt-4 space-y-3">
          {rows.map((row) => (
            <li key={row.title} className="flex items-center gap-3 rounded-2xl bg-muted/60 p-3">
              <span className="font-display text-lg font-semibold">{row.title}</span>
              <span className={`ml-auto grid h-10 w-10 place-items-center rounded-full ${row.done ? "bg-success text-white" : "border-4 border-muted"}`}>{row.done ? <CheckCircle2 className="h-5 w-5" /> : null}</span>
            </li>
          ))}
        </ul>
      </div>
      <div className="absolute -bottom-5 -left-4 rounded-2xl bg-card px-4 py-3 shadow-soft sm:-left-8">
        <p className="text-sm font-bold">Mom approved ✓</p>
        <p className="text-xs text-muted-foreground">+5 stars for Mia</p>
      </div>
    </div>
  );
}
