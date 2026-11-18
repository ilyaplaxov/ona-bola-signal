/** Marks anything Claude wrote, so AI text is never mistaken for the Risk Engine's own output. */
export function AiBadge({ title }: { title?: string }) {
  return (
    <span
      title={title}
      className="inline-block rounded bg-violet-700 px-1.5 py-0.5 align-middle text-[10px] leading-none font-bold tracking-wide text-white"
    >
      AI
    </span>
  );
}
