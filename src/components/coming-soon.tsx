import { Card, PageHeader } from "./ui";

export function ComingSoon({ title, phase, description }: { title: string; phase: number; description: string }) {
  return (
    <>
      <PageHeader title={title} />
      <Card className="p-8 text-center">
        <p className="text-sm font-medium uppercase tracking-wide text-brand-700">Arrives in Phase {phase}</p>
        <p className="mx-auto mt-2 max-w-md text-sm text-slate-600">{description}</p>
      </Card>
    </>
  );
}
