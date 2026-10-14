"use client";

import * as React from "react";
import { CalendarIcon } from "lucide-react";

import { Button } from "./button";
import { Calendar } from "./calendar";
import { CALENDAR_SURFACE } from "./calendar";
import { Popover, PopoverContent, PopoverTrigger } from "./popover";
import { cn } from "../../lib/utils";

type DatePickerProps = {
	value?: string;
	onChange: (value: string) => void;
	placeholder?: string;
	id?: string;
	className?: string;
	disabled?: boolean;
	minDate?: string;
	maxDate?: string;
};

function parseDateValue(value?: string): Date | undefined {
	if (!value) return undefined;
	const [year, month, day] = value.split("-").map(Number);
	if (!year || !month || !day) return undefined;
	return new Date(year, month - 1, day);
}

function toDateValue(date: Date): string {
	const year = date.getFullYear();
	const month = String(date.getMonth() + 1).padStart(2, "0");
	const day = String(date.getDate()).padStart(2, "0");
	return `${year}-${month}-${day}`;
}

function formatDisplay(date?: Date): string {
	if (!date) return "";
	return date.toLocaleDateString("en-NP", {
		year: "numeric",
		month: "short",
		day: "numeric",
	});
}

function DatePicker({
	value,
	onChange,
	placeholder = "Pick a date",
	id,
	className,
	disabled,
	minDate,
	maxDate,
}: DatePickerProps) {
	const [open, setOpen] = React.useState(false);
	const selectedDate = parseDateValue(value);
	const min = parseDateValue(minDate);
	const max = parseDateValue(maxDate);

	return (
		<Popover open={open} onOpenChange={setOpen}>
			<PopoverTrigger asChild>
				<Button
					id={id}
					type="button"
					variant="outline"
					disabled={disabled}
					className={cn(
						"w-full justify-start text-left font-normal",
						!selectedDate && "text-muted-foreground",
						className
					)}
				>
					<CalendarIcon className="mr-2 h-4 w-4 shrink-0 opacity-70" />
					{selectedDate ? formatDisplay(selectedDate) : placeholder}
				</Button>
			</PopoverTrigger>
			<PopoverContent className={CALENDAR_SURFACE} align="start">
				<Calendar
					mode="single"
					selected={selectedDate}
					onSelect={(date) => {
						if (!date) return;
						onChange(toDateValue(date));
						setOpen(false);
					}}
					disabled={(date) => {
						if (min && date < min) return true;
						if (max && date > max) return true;
						return false;
					}}
				/>
			</PopoverContent>
		</Popover>
	);
}

export { DatePicker };
