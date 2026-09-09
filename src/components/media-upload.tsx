"use client";

import * as React from "react";
import { ImageIcon, Loader2, Upload, Video, X } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { apiErrorMessage } from "@/lib/auth-api";
import { uploadImage, uploadVideo } from "@/lib/upload-api";
import { cn, imgUrl } from "@/lib/utils";

export function MediaUpload({
  value,
  onChange,
  folder = "general",
  kind = "image",
  className,
}: {
  value?: string | null;
  onChange: (url: string | null) => void;
  folder?: string;
  kind?: "image" | "video";
  className?: string;
}) {
  const inputRef = React.useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = React.useState(false);

  const handleFile = async (file: File) => {
    setUploading(true);
    try {
      const url =
        kind === "video"
          ? await uploadVideo(file, folder)
          : await uploadImage(file, folder);
      onChange(url);
      toast.success(`${kind === "video" ? "Video" : "Image"} uploaded`);
    } catch (error) {
      toast.error(apiErrorMessage(error, "Upload failed."));
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  };

  return (
    <div className={cn("flex items-center gap-3", className)}>
      <input
        ref={inputRef}
        type="file"
        accept={kind === "video" ? "video/*" : "image/*"}
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) handleFile(file);
        }}
      />

      {value ? (
        <div className="relative">
          {kind === "image" ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={imgUrl(value)}
              alt="Uploaded preview"
              className="size-16 rounded-lg border border-border object-cover"
            />
          ) : (
            <span className="flex size-16 items-center justify-center rounded-lg border border-border bg-muted">
              <Video className="size-6 text-muted-foreground" />
            </span>
          )}
          <button
            type="button"
            aria-label="Remove file"
            onClick={() => onChange(null)}
            className="absolute -top-1.5 -right-1.5 flex size-5 cursor-pointer items-center justify-center rounded-full bg-[#1a1a1a] text-white transition-colors duration-150 hover:bg-[#303030]"
          >
            <X className="size-3" />
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={uploading}
          className="flex size-16 cursor-pointer flex-col items-center justify-center gap-1 rounded-lg border border-dashed border-input bg-muted/40 text-muted-foreground transition-colors duration-150 hover:border-ring hover:text-foreground disabled:pointer-events-none"
        >
          {uploading ? (
            <Loader2 className="size-5 animate-spin" />
          ) : kind === "video" ? (
            <Video className="size-5" />
          ) : (
            <ImageIcon className="size-5" />
          )}
        </button>
      )}

      <div className="flex flex-col gap-1">
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={uploading}
          onClick={() => inputRef.current?.click()}
        >
          {uploading ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <Upload className="size-4" />
          )}
          {value ? "Replace" : "Upload"} {kind}
        </Button>
        <p className="text-xs text-muted-foreground">
          {kind === "video" ? "MP4, MOV…" : "PNG, JPG, WebP…"}
        </p>
      </div>
    </div>
  );
}
