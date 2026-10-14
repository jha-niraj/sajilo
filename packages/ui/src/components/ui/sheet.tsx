"use client"

import * as React from "react"
import * as SheetPrimitive from "@radix-ui/react-dialog"
import { cva, type VariantProps } from "class-variance-authority"
import { X } from "lucide-react"

import { cn } from "../../lib/utils"

const Sheet = SheetPrimitive.Root

const SheetTrigger = SheetPrimitive.Trigger

const SheetClose = SheetPrimitive.Close

const SheetPortal = SheetPrimitive.Portal

const SheetOverlay = React.forwardRef<
	React.ElementRef<typeof SheetPrimitive.Overlay>,
	React.ComponentPropsWithoutRef<typeof SheetPrimitive.Overlay>
>(({ className, ...props }, ref) => (
	<SheetPrimitive.Overlay
		className={cn(
			"fixed inset-0 z-[70] bg-black/80 overflow-hidden data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0",
			className
		)}
		{...props}
		ref={ref}
	/>
))
SheetOverlay.displayName = SheetPrimitive.Overlay.displayName

/**
 * How long the sheet's own exit takes, in ms.
 *
 * Exported because a caller that unmounts the sheet - a route-backed one popping its history entry -
 * has to WAIT for this before navigating, or the exit never plays. Declared here beside the
 * `data-[state=closed]:duration-300` it mirrors, so the two cannot drift: change one and this
 * comment is standing right next to the other.
 */
export const SHEET_EXIT_MS = 300;

const sheetVariants = cva(
	"fixed z-[70] overflow-y-auto gap-4 bg-background p-6 shadow-lg transition ease-in-out data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:duration-300 data-[state=open]:duration-500",
	{
		variants: {
			side: {
				top: "inset-x-0 top-0 border-b data-[state=closed]:slide-out-to-top data-[state=open]:slide-in-from-top",
				bottom:
					"inset-x-0 bottom-0 border-t data-[state=closed]:slide-out-to-bottom data-[state=open]:slide-in-from-bottom",
				// `max-w-[90%]` is the mobile leave-a-strip rule, and it is here rather than
				// in the 100+ consumers for a reason beyond convenience: almost all of them
				// pass `w-full sm:max-w-[...]`, and `w-full` beats the `w-3/4` below in the
				// class merge. A max-width is a DIFFERENT property, so it survives that
				// override and still caps the result - one line does what 100 edits would.
				//
				// Why leave the strip at all: edge to edge, a sheet reads as a navigation to a
				// new page rather than a layer over the current one, and there is no visible
				// hint that anything is behind it. The sliver of dimmed page is the entire
				// affordance. It drops away from `sm`, where the sheet is plainly a panel.
				left: "inset-y-0 left-0 h-full w-3/4 max-w-[90%] border-r data-[state=closed]:slide-out-to-left data-[state=open]:slide-in-from-left sm:max-w-sm",
				right:
					"inset-y-0 right-0 h-full w-3/4 max-w-[90%] border-l data-[state=closed]:slide-out-to-right data-[state=open]:slide-in-from-right sm:max-w-sm",
			},
		},
		defaultVariants: {
			side: "right",
		},
	}
)

interface SheetContentProps
	extends React.ComponentPropsWithoutRef<typeof SheetPrimitive.Content>,
	VariantProps<typeof sheetVariants> { }

const SheetContent = React.forwardRef<
	React.ElementRef<typeof SheetPrimitive.Content>,
	SheetContentProps
>(({ side = "right", className, children, ...props }, ref) => (
	<SheetPortal>
		<SheetOverlay />
		<SheetPrimitive.Content
			ref={ref}
			className={cn(sheetVariants({ side }),
				className)}
			{...props}
		>
			{children}
			<SheetPrimitive.Close className="absolute right-4 top-4 rounded-sm opacity-70 ring-offset-background transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:pointer-events-none data-[state=open]:bg-secondary">
				<X className="h-4 w-4" />
				<span className="sr-only">Close</span>
			</SheetPrimitive.Close>
		</SheetPrimitive.Content>
	</SheetPortal>
))
SheetContent.displayName = SheetPrimitive.Content.displayName

const SheetHeader = ({
	className,
	...props
}: React.HTMLAttributes<HTMLDivElement>) => (
	<div
		className={cn(
			"flex flex-col space-y-4 text-center sm:text-left",
			className
		)}
		{...props}
	/>
)
SheetHeader.displayName = "SheetHeader"

const SheetFooter = ({
	className,
	...props
}: React.HTMLAttributes<HTMLDivElement>) => (
	<div
		className={cn(
			// `gap-2`, not `sm:space-x-2`: the footer stacks with `flex-col-reverse` below `sm`,
			// and `space-x` only ever spaced the ROW direction - so on every phone two footer
			// buttons rendered edge to edge with a 0px gap between them. Measured at 360x640:
			// "Show results" ended at y=576 and "Clear all" began at y=576. Two adjacent 40px
			// targets touching is a mis-tap, and in a sheet footer one of the pair is usually the
			// destructive or cancelling one. `gap` spaces both directions, so it fixes the stacked
			// case and reproduces the same 8px in the row case.
			"flex flex-col-reverse gap-2 sm:flex-row sm:justify-end",
			className
		)}
		{...props}
	/>
)
SheetFooter.displayName = "SheetFooter"

const SheetTitle = React.forwardRef<
	React.ElementRef<typeof SheetPrimitive.Title>,
	React.ComponentPropsWithoutRef<typeof SheetPrimitive.Title>
>(({ className, ...props }, ref) => (
	<SheetPrimitive.Title
		ref={ref}
		className={cn(
			// `text-base`, not the `text-3xl` this used to be. A sheet is a panel OVER a page, so
			// its title must not out-rank the page title behind it - and in `apps/main` that is
			// `text-xl`. This is the CardTitle step from the scale in `apps/main/CLAUDE.md`.
			//
			// It matters here rather than at the call sites because 101 files render a SheetTitle
			// and only 34 pass a size, so 67 sheets were never a decision - they inherited a
			// default nobody chose.
			"text-base font-semibold text-foreground",
			className,
		)}
		{...props}
	/>
))
SheetTitle.displayName = SheetPrimitive.Title.displayName

const SheetDescription = React.forwardRef<
	React.ElementRef<typeof SheetPrimitive.Description>,
	React.ComponentPropsWithoutRef<typeof SheetPrimitive.Description>
>(({ className, ...props }, ref) => (
	<SheetPrimitive.Description
		ref={ref}
		className={cn(
			// Two bugs lived in the one line this replaces. `text-md` is NOT a Tailwind class -
			// the steps are `sm` / `base` / `lg` - so it compiled to nothing and every sheet
			// description rendered at whatever size it inherited. And `text-black` is off-palette
			// (the rule is neutral/zinc) and painted the subtitle at full strength, so it read as
			// loudly as the title it sits under.
			"text-xs text-neutral-500 dark:text-neutral-400",
			className,
		)}
		{...props}
	/>
))
SheetDescription.displayName = SheetPrimitive.Description.displayName

export {
	Sheet,
	SheetPortal,
	SheetOverlay,
	SheetTrigger,
	SheetClose,
	SheetContent,
	SheetHeader,
	SheetFooter,
	SheetTitle,
	SheetDescription,
}
