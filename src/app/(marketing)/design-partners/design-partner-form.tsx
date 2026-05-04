"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import {
  companyTypeLabels,
  companyTypeValues,
  designPartnerSchema,
  type DesignPartnerValues,
} from "@/lib/validators/design-partner";
import { submitDesignPartnerApplication } from "@/app/actions/design-partner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export function DesignPartnerForm() {
  const form = useForm<DesignPartnerValues>({
    resolver: zodResolver(designPartnerSchema),
    defaultValues: {
      name: "",
      workEmail: "",
      companyName: "",
      companyType: "startup",
      painPoint: "",
    },
  });

  const isSubmitting = form.formState.isSubmitting;

  async function onSubmit(values: DesignPartnerValues) {
    const result = await submitDesignPartnerApplication(values);

    if (!result.success) {
      toast.error(result.error || "Submission failed. Please try again.");
      return;
    }

    toast.success("Application received. We will reach out shortly.");
    form.reset();
  }

  return (
    <div className="border border-border bg-background/80 backdrop-blur-sm p-5 sm:p-8 md:p-10">
      <Form {...form}>
        <form
          onSubmit={form.handleSubmit(onSubmit)}
          className="grid grid-cols-1 md:grid-cols-2 gap-5"
        >
          <FormField
            control={form.control}
            name="name"
            render={({ field }) => (
              <FormItem>
                <FormLabel className="font-mono text-xs uppercase tracking-[0.12em]">
                  Name
                </FormLabel>
                <FormControl>
                  <Input
                    {...field}
                    autoComplete="name"
                    placeholder="Alex Rivera"
                    className="rounded-none"
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="workEmail"
            render={({ field }) => (
              <FormItem>
                <FormLabel className="font-mono text-xs uppercase tracking-[0.12em]">
                  Work Email
                </FormLabel>
                <FormControl>
                  <Input
                    {...field}
                    type="email"
                    autoComplete="email"
                    placeholder="alex@company.com"
                    className="rounded-none"
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="companyName"
            render={({ field }) => (
              <FormItem>
                <FormLabel className="font-mono text-xs uppercase tracking-[0.12em]">
                  Company Name
                </FormLabel>
                <FormControl>
                  <Input
                    {...field}
                    autoComplete="organization"
                    placeholder="Northstar Labs"
                    className="rounded-none"
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="companyType"
            render={({ field }) => (
              <FormItem>
                <FormLabel className="font-mono text-xs uppercase tracking-[0.12em]">
                  Company Type
                </FormLabel>
                <Select
                  value={field.value ?? "startup"}
                  onValueChange={field.onChange}
                  disabled={isSubmitting}
                >
                  <FormControl>
                    <SelectTrigger className="rounded-none">
                      <SelectValue placeholder="Select one" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {companyTypeValues.map((type) => (
                      <SelectItem key={type} value={type}>
                        {companyTypeLabels[type]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="painPoint"
            render={({ field }) => (
              <FormItem className="md:col-span-2">
                <FormLabel className="font-mono text-xs uppercase tracking-[0.12em]">
                  What is your biggest pain point with secrets right now?
                </FormLabel>
                <FormControl>
                  <Textarea
                    {...field}
                    rows={6}
                    placeholder="We still pass .env files in Slack and onboarding takes hours..."
                    className="rounded-none"
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <div className="md:col-span-2 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-t border-border pt-5">
            <p className="text-xs font-mono uppercase tracking-[0.12em] text-muted-foreground">
              No pitch deck required. Just real workflow pain.
            </p>
            <Button
              type="submit"
              disabled={isSubmitting}
              className="rounded-none h-11 px-7 font-mono uppercase tracking-[0.12em]"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Submitting
                </>
              ) : (
                "Apply Now"
              )}
            </Button>
          </div>
        </form>
      </Form>
    </div>
  );
}
