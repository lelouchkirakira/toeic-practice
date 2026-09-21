import { AlertCircle, Info, Loader2 } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

export function ErrorNotice({
  title = "載入失敗",
  message,
}: {
  title?: string;
  message: string;
}) {
  return (
    <Alert variant="destructive" className="border-destructive/40">
      <AlertCircle />
      <AlertTitle>{title}</AlertTitle>
      <AlertDescription>{message}</AlertDescription>
    </Alert>
  );
}

export function InfoNotice({ message }: { message: string }) {
  return (
    <Alert>
      <Info />
      <AlertDescription>{message}</AlertDescription>
    </Alert>
  );
}

export function LoadingBlock({ label = "載入中" }: { label?: string }) {
  return (
    <div className="flex flex-col items-center gap-3 py-16 text-muted-foreground">
      <Loader2 className="size-7 animate-spin" aria-hidden="true" />
      <p className="text-sm">{label}</p>
    </div>
  );
}
