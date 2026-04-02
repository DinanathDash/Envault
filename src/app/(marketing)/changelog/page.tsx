import type { Metadata } from "next";
import { serialize } from "next-mdx-remote/serialize";
import {
  parseChangelog,
  splitChangelogBody,
} from "@/lib/system/changelog-parser";
import {
  ChangelogTimeline,
  type TimelineEntry,
} from "@/components/changelog/ChangelogTimeline";

export const metadata: Metadata = {
  title: "Changelog",
  description:
    "Every notable release to Envault - new features, security patches, and CLI updates, documented in order.",
  alternates: {
    canonical: "/changelog",
  },
  openGraph: {
    url: "https://www.envault.tech/changelog",
    siteName: "Envault",
    images: ["/api/og?title=Changelog&description=Envault+Release+History"],
  },
};

export default async function ChangelogPage() {
  const raw = parseChangelog();

  const entries: TimelineEntry[] = await Promise.all(
    raw.map(async (entry) => {
      const { title, remainingBody } = splitChangelogBody(entry.body);
      const bodyMdx = await serialize(remainingBody);

      return {
        version: entry.version,
        date: entry.date,
        category: entry.category,
        bodyMdx,
        title: title || undefined,
        slug: entry.slug,
        authors: entry.authors,
      };
    }),
  );

  return <ChangelogTimeline entries={entries} />;
}
