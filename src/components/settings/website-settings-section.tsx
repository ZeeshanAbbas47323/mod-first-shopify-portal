"use client";

import * as React from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { ImagePlus, Loader2, X } from "lucide-react";
import { imgUrl } from "@/lib/utils";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import { apiErrorMessage } from "@/lib/auth-api";
import { uploadImage } from "@/lib/upload-api";
import {
  fetchWebsiteSettings,
  createWebsiteSettings,
  updateWebsiteSettings,
  type WebsiteSettingRow,
} from "@/lib/admin-api";

// ─── Schema ──────────────────────────────────────────────────────────────────

const schema = z.object({
  // Required per API contract
  site_name: z.string().min(1, "Site name is required"),
  primary_color: z.string().min(1, "Primary color is required"),
  secondary_color: z.string().min(1, "Secondary color is required"),
  font_primary: z.string().min(1, "Primary font is required"),
  font_heading: z.string().min(1, "Heading font is required"),
  // Optional
  site_tagline: z.string().optional(),
  site_description: z.string().optional(),
  accent_color: z.string().optional(),
  contact_email: z.string().optional(),
  support_email: z.string().optional(),
  contact_phone: z.string().optional(),
  whatsapp_number: z.string().optional(),
  address: z.string().optional(),
  city: z.string().optional(),
  country_code: z.string().optional(),
  postal_code: z.string().optional(),
  province_code: z.string().optional(),
  business_hours: z.string().optional(),
  facebook_url: z.string().optional(),
  instagram_url: z.string().optional(),
  twitter_url: z.string().optional(),
  linkedin_url: z.string().optional(),
  youtube_url: z.string().optional(),
  tiktok_url: z.string().optional(),
  pinterest_url: z.string().optional(),
  playstore_url: z.string().optional(),
  appstore_url: z.string().optional(),
  currency: z.string().optional(),
  currency_symbol: z.string().optional(),
  tax_percentage: z.string().optional(),
  default_shipping_fee: z.string().optional(),
  free_shipping_threshold: z.string().optional(),
  min_order_amount: z.string().optional(),
  first_order_discount_enabled: z.boolean(),
  first_order_discount_type: z.string().optional(),
  first_order_discount_value: z.string().optional(),
  first_order_max_discount: z.string().optional(),
  meta_title: z.string().optional(),
  meta_description: z.string().optional(),
  meta_keywords: z.string().optional(),
  order_prefix: z
    .string()
    .optional()
    .refine((v) => !v || (v.length >= 1 && v.length <= 10), "1 to 10 characters"),
});

type FormValues = z.infer<typeof schema>;

const parseNum = (v?: string) => {
  if (!v || v.trim() === "") return null;
  const n = parseFloat(v);
  return isNaN(n) ? null : n;
};

// ─── Image Upload ─────────────────────────────────────────────────────────────

function ImageField({
  label,
  hint,
  value,
  onChange,
}: {
  label: string;
  hint?: string;
  value: string | null | undefined;
  onChange: (url: string | null) => void;
}) {
  const [uploading, setUploading] = React.useState(false);
  const ref = React.useRef<HTMLInputElement>(null);

  const handleFile = async (file: File) => {
    if (!file.type.startsWith("image/")) { toast.error("Please select an image file."); return; }
    setUploading(true);
    try {
      const url = await uploadImage(file, "settings");
      onChange(url);
    } catch (e) {
      toast.error(apiErrorMessage(e, "Upload failed."));
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
      {value ? (
        <div className="relative inline-flex">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={imgUrl(value)} alt={label} className="h-16 w-auto max-w-[160px] rounded-lg border border-border object-contain bg-muted/30 p-1" />
          <button
            type="button"
            onClick={() => onChange(null)}
            className="absolute -right-2 -top-2 flex size-5 items-center justify-center rounded-full bg-destructive text-white shadow"
          >
            <X className="size-3" />
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => ref.current?.click()}
          disabled={uploading}
          className="flex h-16 w-40 cursor-pointer flex-col items-center justify-center gap-1 rounded-lg border-2 border-dashed border-border bg-muted/30 text-xs text-muted-foreground hover:border-primary/50 hover:bg-muted/60 disabled:opacity-50"
        >
          {uploading ? <Loader2 className="size-4 animate-spin" /> : <ImagePlus className="size-4" />}
          <span>{uploading ? "Uploading…" : "Upload"}</span>
        </button>
      )}
      <input ref={ref} type="file" accept="image/*" className="hidden"
        onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); e.target.value = ""; }}
      />
    </div>
  );
}

// ─── Section Card ─────────────────────────────────────────────────────────────

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <Card className="shadow-none">
      <CardHeader className="pb-3">
        <CardTitle className="text-sm">{title}</CardTitle>
      </CardHeader>
      <Separator />
      <CardContent className="pt-4">{children}</CardContent>
    </Card>
  );
}

// ─── Skeleton ─────────────────────────────────────────────────────────────────

function Skeleton() {
  return (
    <div className="flex flex-col gap-4 animate-pulse">
      {[1, 2, 3, 4].map((i) => (
        <div key={i} className="rounded-xl bg-muted h-48" />
      ))}
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export function WebsiteSettingsSection() {
  const [setting, setSetting] = React.useState<WebsiteSettingRow | null>(null);
  const [loading, setLoading] = React.useState(true);

  // Image fields managed outside form (file upload)
  const [logo, setLogo] = React.useState<string | null>(null);
  const [logoWhite, setLogoWhite] = React.useState<string | null>(null);
  const [logoBlack, setLogoBlack] = React.useState<string | null>(null);
  const [favicon, setFavicon] = React.useState<string | null>(null);
  const [footerLogo, setFooterLogo] = React.useState<string | null>(null);
  const [ogImage, setOgImage] = React.useState<string | null>(null);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { first_order_discount_enabled: false },
  });

  React.useEffect(() => {
    fetchWebsiteSettings()
      .then((s) => {
        setSetting(s);
        if (s) {
          setLogo(s.logo_url ?? null);
          setLogoWhite(s.logo_white_url ?? null);
          setLogoBlack(s.logo_black_url ?? null);
          setFavicon(s.favicon_url ?? null);
          setFooterLogo(s.footer_logo_url ?? null);
          setOgImage(s.og_image_url ?? null);
          reset({
            site_name: s.site_name ?? "",
            site_tagline: s.site_tagline ?? "",
            site_description: s.site_description ?? "",
            primary_color: s.primary_color ?? "#030303",
            secondary_color: s.secondary_color ?? "#C2E105",
            accent_color: s.accent_color ?? "#FFFFFF",
            font_primary: s.font_primary ?? "Barlow",
            font_heading: s.font_heading ?? "Barlow",
            contact_email: s.contact_email ?? "",
            support_email: s.support_email ?? "",
            contact_phone: s.contact_phone ?? "",
            whatsapp_number: s.whatsapp_number ?? "",
            address: s.address ?? "",
            city: s.city ?? "",
            country_code: s.country_code ?? "",
            postal_code: s.postal_code ?? "",
            province_code: s.province_code ?? "",
            business_hours: s.business_hours ?? "",
            facebook_url: s.facebook_url ?? "",
            instagram_url: s.instagram_url ?? "",
            twitter_url: s.twitter_url ?? "",
            linkedin_url: s.linkedin_url ?? "",
            youtube_url: s.youtube_url ?? "",
            tiktok_url: s.tiktok_url ?? "",
            pinterest_url: s.pinterest_url ?? "",
            playstore_url: s.playstore_url ?? "",
            appstore_url: s.appstore_url ?? "",
            currency: s.currency ?? "USD",
            currency_symbol: s.currency_symbol ?? "$",
            tax_percentage: s.tax_percentage != null ? String(s.tax_percentage) : "",
            default_shipping_fee: s.default_shipping_fee != null ? String(s.default_shipping_fee) : "",
            free_shipping_threshold: s.free_shipping_threshold != null ? String(s.free_shipping_threshold) : "",
            min_order_amount: s.min_order_amount != null ? String(s.min_order_amount) : "",
            first_order_discount_enabled: s.first_order_discount_enabled ?? false,
            first_order_discount_type: s.first_order_discount_type ?? "percentage",
            first_order_discount_value: s.first_order_discount_value != null ? String(s.first_order_discount_value) : "",
            first_order_max_discount: s.first_order_max_discount != null ? String(s.first_order_max_discount) : "",
            meta_title: s.meta_title ?? "",
            meta_description: s.meta_description ?? "",
            meta_keywords: s.meta_keywords ?? "",
            order_prefix: s.order_prefix ?? "",
          });
        } else {
          // No settings row yet — leave sensible defaults for the create flow.
          reset({
            primary_color: "#030303",
            secondary_color: "#C2E105",
            accent_color: "#FFFFFF",
            font_primary: "Barlow",
            font_heading: "Barlow",
            currency: "USD",
            currency_symbol: "$",
            first_order_discount_enabled: false,
          } as FormValues);
        }
      })
      .catch(() => toast.error("Couldn't load website settings."))
      .finally(() => setLoading(false));
  }, [reset]);

  const onSubmit = async (values: FormValues) => {
    const body: Partial<WebsiteSettingRow> = {
      site_name: values.site_name,
      site_tagline: values.site_tagline || undefined,
      site_description: values.site_description || undefined,
      logo_url: logo,
      logo_white_url: logoWhite,
      logo_black_url: logoBlack,
      favicon_url: favicon,
      footer_logo_url: footerLogo,
      og_image_url: ogImage,
      primary_color: values.primary_color,
      secondary_color: values.secondary_color,
      accent_color: values.accent_color || undefined,
      font_primary: values.font_primary,
      font_heading: values.font_heading,
      contact_email: values.contact_email || undefined,
      support_email: values.support_email || undefined,
      contact_phone: values.contact_phone || undefined,
      whatsapp_number: values.whatsapp_number || undefined,
      address: values.address || undefined,
      city: values.city || undefined,
      country_code: values.country_code || undefined,
      postal_code: values.postal_code || undefined,
      province_code: values.province_code || undefined,
      business_hours: values.business_hours || undefined,
      facebook_url: values.facebook_url || undefined,
      instagram_url: values.instagram_url || undefined,
      twitter_url: values.twitter_url || undefined,
      linkedin_url: values.linkedin_url || undefined,
      youtube_url: values.youtube_url || undefined,
      tiktok_url: values.tiktok_url || undefined,
      pinterest_url: values.pinterest_url || undefined,
      playstore_url: values.playstore_url || undefined,
      appstore_url: values.appstore_url || undefined,
      currency: values.currency || undefined,
      currency_symbol: values.currency_symbol || undefined,
      tax_percentage: parseNum(values.tax_percentage),
      default_shipping_fee: parseNum(values.default_shipping_fee),
      free_shipping_threshold: parseNum(values.free_shipping_threshold),
      min_order_amount: parseNum(values.min_order_amount),
      first_order_discount_enabled: values.first_order_discount_enabled,
      first_order_discount_type: values.first_order_discount_type || undefined,
      first_order_discount_value: parseNum(values.first_order_discount_value),
      first_order_max_discount: parseNum(values.first_order_max_discount),
      meta_title: values.meta_title || undefined,
      meta_description: values.meta_description || undefined,
      meta_keywords: values.meta_keywords || undefined,
      order_prefix: values.order_prefix || undefined,
    };

    try {
      let msg: string;
      if (setting?.id != null) {
        msg = await updateWebsiteSettings(setting.id, body);
      } else {
        // No existing row → create one, then remember its id so subsequent saves update.
        msg = await createWebsiteSettings(body);
        // Refetch to pick up the newly-assigned id
        const fresh = await fetchWebsiteSettings();
        if (fresh) setSetting(fresh);
      }
      toast.success(msg);
    } catch (e) {
      toast.error(apiErrorMessage(e, "Couldn't save settings."));
    }
  };

  if (loading) return <Skeleton />;

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate className="flex flex-col gap-4">
      {/* ── Store basics ── */}
      <Section title="Store details">
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="ws-name">Site name <span className="text-destructive">*</span></Label>
            <Input id="ws-name" placeholder="ModFirst Apparel" aria-invalid={!!errors.site_name} {...register("site_name")} />
            {errors.site_name && <p className="text-sm text-destructive">{errors.site_name.message}</p>}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="ws-tagline">Tagline</Label>
            <Input id="ws-tagline" placeholder="Premium Custom Apparel & Printing Services" {...register("site_tagline")} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="ws-desc">Description</Label>
            <Textarea id="ws-desc" rows={3} placeholder="Short description of your store…" {...register("site_description")} />
          </div>
          <div className="grid gap-4 sm:grid-cols-3">
            <ImageField label="Logo" hint="Generic fallback logo" value={logo} onChange={setLogo} />
            <ImageField label="Favicon" hint="Browser tab icon (32×32)" value={favicon} onChange={setFavicon} />
            <ImageField label="Footer logo" hint="Shown in site footer" value={footerLogo} onChange={setFooterLogo} />
            <ImageField label="Logo (white)" hint="Used in emails (dark header)" value={logoWhite} onChange={setLogoWhite} />
            <ImageField label="Logo (black)" hint="Used on receipts & prints" value={logoBlack} onChange={setLogoBlack} />
          </div>
        </div>
      </Section>

      {/* ── Branding ── */}
      <Section title="Branding">
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="ws-primary">Primary color <span className="text-destructive">*</span></Label>
            <div className="flex items-center gap-2">
              <input type="color" id="ws-primary" className="h-9 w-12 cursor-pointer rounded-lg border border-input bg-card p-1" {...register("primary_color")} />
              <Input placeholder="#030303" {...register("primary_color")} className="flex-1 font-mono" aria-invalid={!!errors.primary_color} />
            </div>
            {errors.primary_color && <p className="text-sm text-destructive">{errors.primary_color.message}</p>}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="ws-secondary">Secondary color <span className="text-destructive">*</span></Label>
            <div className="flex items-center gap-2">
              <input type="color" id="ws-secondary" className="h-9 w-12 cursor-pointer rounded-lg border border-input bg-card p-1" {...register("secondary_color")} />
              <Input placeholder="#C2E105" {...register("secondary_color")} className="flex-1 font-mono" aria-invalid={!!errors.secondary_color} />
            </div>
            {errors.secondary_color && <p className="text-sm text-destructive">{errors.secondary_color.message}</p>}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="ws-accent">Accent color</Label>
            <div className="flex items-center gap-2">
              <input type="color" id="ws-accent" className="h-9 w-12 cursor-pointer rounded-lg border border-input bg-card p-1" {...register("accent_color")} />
              <Input placeholder="#FFFFFF" {...register("accent_color")} className="flex-1 font-mono" />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="ws-font-primary">Primary font <span className="text-destructive">*</span></Label>
            <Input id="ws-font-primary" placeholder="Barlow" aria-invalid={!!errors.font_primary} {...register("font_primary")} />
            {errors.font_primary && <p className="text-sm text-destructive">{errors.font_primary.message}</p>}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="ws-font-heading">Heading font <span className="text-destructive">*</span></Label>
            <Input id="ws-font-heading" placeholder="Barlow" aria-invalid={!!errors.font_heading} {...register("font_heading")} />
            {errors.font_heading && <p className="text-sm text-destructive">{errors.font_heading.message}</p>}
          </div>
        </div>
      </Section>

      {/* ── Contact ── */}
      <Section title="Contact information">
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="ws-cemail">Contact email</Label>
            <Input id="ws-cemail" type="email" placeholder="info@yourstore.com" {...register("contact_email")} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="ws-semail">Support email</Label>
            <Input id="ws-semail" type="email" placeholder="support@yourstore.com" {...register("support_email")} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="ws-phone">Phone</Label>
            <Input id="ws-phone" type="tel" placeholder="+1 (240) 555-0123" {...register("contact_phone")} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="ws-wa">WhatsApp</Label>
            <Input id="ws-wa" type="tel" placeholder="+1 (240) 555-0123" {...register("whatsapp_number")} />
          </div>
          <div className="space-y-1.5 sm:col-span-2">
            <Label htmlFor="ws-addr">Address</Label>
            <Input id="ws-addr" placeholder="Street address" {...register("address")} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="ws-city">City</Label>
            <Input id="ws-city" placeholder="Hyattsville" {...register("city")} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="ws-province">State / Province</Label>
            <Input id="ws-province" placeholder="MD" {...register("province_code")} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="ws-postal">Postal code</Label>
            <Input id="ws-postal" placeholder="20782" {...register("postal_code")} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="ws-country">Country code</Label>
            <Input id="ws-country" placeholder="US" {...register("country_code")} />
          </div>
          <div className="space-y-1.5 sm:col-span-2">
            <Label htmlFor="ws-hours">Business hours</Label>
            <Input id="ws-hours" placeholder="Mon–Sat: 9 AM – 6 PM EST" {...register("business_hours")} />
          </div>
        </div>
      </Section>

      {/* ── Social ── */}
      <Section title="Social media & apps">
        <div className="grid gap-4 sm:grid-cols-2">
          {(
            [
              ["ws-fb", "Facebook URL", "facebook_url"],
              ["ws-ig", "Instagram URL", "instagram_url"],
              ["ws-tw", "Twitter / X URL", "twitter_url"],
              ["ws-li", "LinkedIn URL", "linkedin_url"],
              ["ws-yt", "YouTube URL", "youtube_url"],
              ["ws-tt", "TikTok URL", "tiktok_url"],
              ["ws-pi", "Pinterest URL", "pinterest_url"],
              ["ws-ps", "Play Store URL", "playstore_url"],
              ["ws-as", "App Store URL", "appstore_url"],
            ] as [string, string, keyof FormValues][]
          ).map(([id, label, field]) => (
            <div key={id} className="space-y-1.5">
              <Label htmlFor={id}>{label}</Label>
              <Input id={id} type="url" placeholder="https://" {...register(field)} />
            </div>
          ))}
        </div>
      </Section>

      {/* ── Commerce ── */}
      <Section title="Commerce settings">
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="ws-currency">Currency code</Label>
            <Input id="ws-currency" placeholder="USD" {...register("currency")} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="ws-symbol">Currency symbol</Label>
            <Input id="ws-symbol" placeholder="$" {...register("currency_symbol")} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="ws-tax">Tax percentage (%)</Label>
            <Input id="ws-tax" type="number" step="0.01" min="0" placeholder="6.0" {...register("tax_percentage")} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="ws-shipping">Default shipping fee</Label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">$</span>
              <Input id="ws-shipping" type="number" step="0.01" min="0" placeholder="8.99" className="pl-7" {...register("default_shipping_fee")} />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="ws-free-ship">Free shipping threshold</Label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">$</span>
              <Input id="ws-free-ship" type="number" step="0.01" min="0" placeholder="75.00" className="pl-7" {...register("free_shipping_threshold")} />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="ws-min-order">Minimum order amount</Label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">$</span>
              <Input id="ws-min-order" type="number" step="0.01" min="0" placeholder="15.00" className="pl-7" {...register("min_order_amount")} />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="ws-order-prefix">Order prefix</Label>
            <Input id="ws-order-prefix" placeholder="MF" maxLength={10} aria-invalid={!!errors.order_prefix} {...register("order_prefix")} />
            {errors.order_prefix ? (
              <p className="text-sm text-destructive">{errors.order_prefix.message}</p>
            ) : (
              <p className="text-xs text-muted-foreground">Prepended to order numbers (1–10 characters).</p>
            )}
          </div>
        </div>

        <Separator className="my-4" />

        <div className="space-y-4">
          <label className="flex cursor-pointer items-center gap-3">
            <div className="relative">
              <input type="checkbox" className="sr-only peer" {...register("first_order_discount_enabled")} />
              <div className="h-5 w-9 rounded-full bg-muted transition-colors peer-checked:bg-[#29845a]" />
              <div className="absolute left-0.5 top-0.5 size-4 rounded-full bg-white shadow transition-transform peer-checked:translate-x-4" />
            </div>
            <span className="text-sm font-medium">First order discount</span>
          </label>

          <div className="grid gap-4 sm:grid-cols-3">
            <div className="space-y-1.5">
              <Label htmlFor="ws-disc-type">Discount type</Label>
              <Input id="ws-disc-type" placeholder="percentage / fixed_amount" {...register("first_order_discount_type")} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="ws-disc-val">Discount value</Label>
              <Input id="ws-disc-val" type="number" step="0.01" min="0" placeholder="15" {...register("first_order_discount_value")} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="ws-disc-max">Max discount</Label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">$</span>
                <Input id="ws-disc-max" type="number" step="0.01" min="0" placeholder="50" className="pl-7" {...register("first_order_max_discount")} />
              </div>
            </div>
          </div>
        </div>
      </Section>

      {/* ── SEO ── */}
      <Section title="SEO">
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="ws-meta-title">Meta title</Label>
            <Input id="ws-meta-title" placeholder="ModFirst Apparel - Custom Printing & Embroidery" {...register("meta_title")} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="ws-meta-desc">Meta description</Label>
            <Textarea id="ws-meta-desc" rows={3} placeholder="Premium quality custom apparel printing…" {...register("meta_description")} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="ws-keywords">Meta keywords</Label>
            <Input id="ws-keywords" placeholder="custom t-shirts, dtf, embroidery, …" {...register("meta_keywords")} />
          </div>
          <ImageField
            label="Open Graph image"
            hint="Shown when the storefront is shared on social media"
            value={ogImage}
            onChange={setOgImage}
          />
        </div>
      </Section>

      {/* ── Save ── */}
      <div className="flex justify-end">
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting && <Loader2 className="size-4 animate-spin" />}
          {isSubmitting ? "Saving…" : "Save settings"}
        </Button>
      </div>
    </form>
  );
}
