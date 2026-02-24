// @ts-nocheck
import { browser } from 'fumadocs-mdx/runtime/browser';
import type * as Config from '../source.config';

const create = browser<typeof Config, import("fumadocs-mdx/runtime/types").InternalTypeConfig & {
  DocData: {
  }
}>();
const browserCollections = {
  docs: create.doc("docs", {"index.mdx": () => import("../content/docs/index.mdx?collection=docs"), "api/overview.mdx": () => import("../content/docs/api/overview.mdx?collection=docs"), "cli/commands.mdx": () => import("../content/docs/cli/commands.mdx?collection=docs"), "cli/reference.mdx": () => import("../content/docs/cli/reference.mdx?collection=docs"), "configuration/environment-variables.mdx": () => import("../content/docs/configuration/environment-variables.mdx?collection=docs"), "guides/ci-cd-integration.mdx": () => import("../content/docs/guides/ci-cd-integration.mdx?collection=docs"), "guides/initial-setup.mdx": () => import("../content/docs/guides/initial-setup.mdx?collection=docs"), "guides/installation.mdx": () => import("../content/docs/guides/installation.mdx?collection=docs"), "guides/production-deployment.mdx": () => import("../content/docs/guides/production-deployment.mdx?collection=docs"), "core/access-control.mdx": () => import("../content/docs/core/access-control.mdx?collection=docs"), "core/architecture.mdx": () => import("../content/docs/core/architecture.mdx?collection=docs"), "core/notifications.mdx": () => import("../content/docs/core/notifications.mdx?collection=docs"), "core/projects-environments.mdx": () => import("../content/docs/core/projects-environments.mdx?collection=docs"), "core/projects.mdx": () => import("../content/docs/core/projects.mdx?collection=docs"), "core/security.mdx": () => import("../content/docs/core/security.mdx?collection=docs"), "core/system-status.mdx": () => import("../content/docs/core/system-status.mdx?collection=docs"), }),
};
export default browserCollections;