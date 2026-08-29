export function ComingSoon({ title, note }: { title: string; note: string }) {
  return (
    <div>
      <h1 className="mb-1 text-xl font-semibold text-neutral-900">{title}</h1>
      <p className="mb-6 text-sm text-neutral-500">{note}</p>
      <div className="rounded-lg border border-dashed border-neutral-300 bg-white p-8 text-center text-sm text-neutral-400">
        Not built yet — tracked in the project task list.
      </div>
    </div>
  );
}
