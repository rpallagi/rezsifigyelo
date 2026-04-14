const TYPE_LABELS: Record<string, string> = {
  lakas: "Lakás",
  uzlet: "Üzlet",
  telek: "Telek",
  egyeb: "Egyéb",
};

export function propertyTypeLabel(propertyType?: string): string {
  return TYPE_LABELS[propertyType ?? ""] ?? propertyType ?? "Egyéb";
}

export function propertyPlaceholder(propertyType?: string): string {
  switch (propertyType) {
    case "lakas":
      return "linear-gradient(135deg, rgba(70,72,212,0.92), rgba(96,99,238,0.75)), radial-gradient(circle at top right, rgba(255,255,255,0.28), transparent 42%)";
    case "uzlet":
      return "linear-gradient(135deg, rgba(0,108,73,0.92), rgba(108,248,187,0.68)), radial-gradient(circle at top right, rgba(255,255,255,0.22), transparent 40%)";
    case "telek":
      return "linear-gradient(135deg, rgba(131,81,0,0.9), rgba(255,185,95,0.72)), radial-gradient(circle at top right, rgba(255,255,255,0.24), transparent 40%)";
    default:
      return "linear-gradient(135deg, rgba(25,28,30,0.9), rgba(118,117,134,0.72)), radial-gradient(circle at top right, rgba(255,255,255,0.24), transparent 42%)";
  }
}
