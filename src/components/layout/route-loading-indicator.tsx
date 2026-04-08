export function RouteLoadingIndicator() {
  return (
    <div
      aria-hidden="true"
      className="flex items-center gap-3 text-sm text-muted-foreground/80"
    >
      <div className="h-4 w-4 animate-spin rounded-full border-2 border-muted border-t-foreground/40" />
      <div className="h-4 w-28 animate-pulse rounded bg-muted/50" />
    </div>
  );
}
