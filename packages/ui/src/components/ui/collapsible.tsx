"use client"

import * as CollapsiblePrimitive from "@radix-ui/react-collapsible"

import { cn } from "../../lib/utils"
import { COLLAPSE_MOTION } from "../../lib/motion"

function Collapsible({
    ...props
}: React.ComponentProps<typeof CollapsiblePrimitive.Root>) {
    return <CollapsiblePrimitive.Root data-slot="collapsible" {...props} />
}

function CollapsibleTrigger({
    ...props
}: React.ComponentProps<typeof CollapsiblePrimitive.CollapsibleTrigger>) {
    return (
        <CollapsiblePrimitive.CollapsibleTrigger
            data-slot="collapsible-trigger"
            {...props}
        />
    )
}

/**
 * Content slides its height open and closed rather than snapping.
 *
 * `overflow-hidden` (inside COLLAPSE_MOTION) is not decoration - without it the content is
 * fully painted at frame one and only the box height animates, so text spills past the edge
 * for the whole 200ms. The keyframes read `--radix-collapsible-content-height`, which Radix
 * measures and publishes on this element.
 */
function CollapsibleContent({
    className,
    ...props
}: React.ComponentProps<typeof CollapsiblePrimitive.CollapsibleContent>) {
    return (
        <CollapsiblePrimitive.CollapsibleContent
            data-slot="collapsible-content"
            className={cn(COLLAPSE_MOTION, className)}
            {...props}
        />
    )
}

export { Collapsible, CollapsibleTrigger, CollapsibleContent }