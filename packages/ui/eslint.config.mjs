import { config } from "@repo/eslint-config/react-internal";

/** @type {import("eslint").Linter.Config} */
export default [
  ...config,
  {
    // shadcn/ui generated components — skip strict rules
    ignores: [
      "src/components/ui/calendar.tsx",
      "src/components/ui/chart.tsx",
      "src/components/ui/command.tsx",
      "src/components/ui/container-scroll-animation.tsx",
      "src/components/ui/icon-cloud.tsx",
      "src/components/ui/location-selector.tsx",
      "src/components/ui/marquee.tsx",
      "src/components/ui/rainbow-button.tsx",
      "src/components/ui/table.tsx",
      "src/components/ui/text-reveal-card.tsx",
      "src/components/ui/textarea.tsx",
    ],
  },
];
