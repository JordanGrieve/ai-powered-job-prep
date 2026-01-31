"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  experienceLevel,
  jobInfoTable,
  type ExperienceLevel,
} from "@/app/drizzle/schema/jobInfo";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { jobInfoSchema } from "../schema";
import { LoadingSwap } from "@/components/ui/loading-swap";
import { createJobInfo } from "../actions";

export type JobInfoSchema = z.infer<typeof jobInfoSchema>;

export function JobInfoForm({
  jobInfo,
}: {
  jobInfo?: Pick<
    typeof jobInfoTable.$inferSelect,
    "id" | "name" | "title" | "experienceLevel" | "description"
  >;
}) {
  const form = useForm<JobInfoSchema>({
    resolver: zodResolver(jobInfoSchema),
    defaultValues: jobInfo ?? {
      name: "",
      title: null,
      experienceLevel: "junior",
      description: "",
    },
  });

  async function onSubmit(data: JobInfoSchema) {
    const action = jobInfo ? updateJobInfo : createJobInfo;
    const res = await action(data);
    console.log(data);
  }

  return (
    <Form {...form}>
      <form
        onSubmit={form.handleSubmit(onSubmit)}
        className="space-y-6 w-full md:w-3xl"
      >
        <FormField
          control={form.control}
          name="name"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Name</FormLabel>
              <FormControl>
                <Input placeholder="Enter name" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <div className="flex flex-col lg:flex-row gap-4">
          <FormField
            control={form.control}
            name="title"
            render={({ field }) => (
              <FormItem className="flex-1">
                <FormLabel>Job Title</FormLabel>
                <FormControl>
                  <Input
                    {...field}
                    value={field.value ?? ""}
                    onChange={(e) => field.onChange(e.target.value || null)}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="experienceLevel"
            render={({ field }) => (
              <FormItem className="flex-1">
                <FormLabel>Experience Level</FormLabel>
                <Select onValueChange={field.onChange} value={field.value}>
                  <FormControl>
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Select experience level" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {experienceLevel.map((level) => (
                      <SelectItem key={level} value={level}>
                        {level.charAt(0).toUpperCase() + level.slice(1)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <FormField
          control={form.control}
          name="description"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Description</FormLabel>
              <FormControl>
                <Textarea
                  placeholder="Enter description"
                  className="min-h-[120px]"
                  {...field}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormDescription>Be as specific as possible.</FormDescription>

        <Button
          disabled={!form.formState.isValid}
          type="submit"
          className="w-full"
        >
          <LoadingSwap isLoading={form.formState.isSubmitting}>
            Save job information
          </LoadingSwap>
        </Button>
      </form>
    </Form>
  );
}
