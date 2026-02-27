import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Upload, X, ImageIcon } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface ImageUploadProps {
  value?: string | null;
  onChange: (url: string | null) => void;
  label?: string;
  aspectRatio?: "square" | "wide";
  "data-testid"?: string;
}

export function ImageUpload({
  value,
  onChange,
  label = "رفع صورة",
  aspectRatio = "square",
  "data-testid": testId,
}: ImageUploadProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const { toast } = useToast();

  const handleFile = async (file: File) => {
    if (!file.type.startsWith("image/")) {
      toast({ title: "يرجى اختيار ملف صورة", variant: "destructive" });
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      toast({ title: "الصورة أكبر من 5 ميغابايت", variant: "destructive" });
      return;
    }
    setUploading(true);
    try {
      const form = new FormData();
      form.append("file", file);
      const res = await fetch("/api/upload", { method: "POST", body: form });
      if (!res.ok) throw new Error("Upload failed");
      const { url } = await res.json();
      onChange(url);
    } catch {
      toast({ title: "فشل رفع الصورة", variant: "destructive" });
    } finally {
      setUploading(false);
    }
  };

  const previewClass =
    aspectRatio === "wide"
      ? "w-full h-32 rounded-lg object-cover"
      : "w-24 h-24 rounded-full object-cover";

  const placeholderClass =
    aspectRatio === "wide"
      ? "w-full h-32 rounded-lg border-2 border-dashed border-border flex flex-col items-center justify-center gap-2 cursor-pointer hover:bg-muted/50 transition-colors"
      : "w-24 h-24 rounded-full border-2 border-dashed border-border flex flex-col items-center justify-center cursor-pointer hover:bg-muted/50 transition-colors shrink-0";

  return (
    <div className="flex flex-col gap-2">
      {value ? (
        <div className="relative inline-block">
          <img src={value} alt="preview" className={previewClass} />
          <button
            type="button"
            onClick={() => onChange(null)}
            className="absolute -top-1 -right-1 w-5 h-5 bg-destructive text-destructive-foreground rounded-full flex items-center justify-center shadow"
            data-testid={testId ? `${testId}-remove` : undefined}
          >
            <X className="w-3 h-3" />
          </button>
        </div>
      ) : (
        <div
          className={placeholderClass}
          onClick={() => inputRef.current?.click()}
          data-testid={testId}
        >
          <ImageIcon className="w-5 h-5 text-muted-foreground" />
          {aspectRatio === "wide" && (
            <span className="text-xs text-muted-foreground">{label}</span>
          )}
        </div>
      )}
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={() => inputRef.current?.click()}
        disabled={uploading}
        className="gap-2 self-start"
        data-testid={testId ? `${testId}-btn` : undefined}
      >
        <Upload className="w-3.5 h-3.5" />
        {uploading ? "جارٍ الرفع..." : label}
      </Button>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={e => {
          const file = e.target.files?.[0];
          if (file) handleFile(file);
          e.target.value = "";
        }}
      />
    </div>
  );
}
