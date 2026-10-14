'use client';

import * as React from 'react';
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from './alert-dialog';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from './dialog';
import { Button } from './button';
import { Input } from './input';
import { Label } from './label';
import { cn } from '../../lib/utils';

/**
 * Themed replacements for the native `window.confirm()` / `window.prompt()`.
 *
 * NEVER call the native ones. They render an unstyled OS chrome box with the origin
 * ("localhost:3007 says..."), ignore light/dark mode entirely, cannot be themed, and - the reason
 * this matters beyond looks - they BLOCK the main thread and every browser-automation session,
 * so a stray confirm() freezes the whole tab.
 *
 * Both hooks are promise-based, so a call site reads like the native one it replaces:
 *
 *   const { confirm, confirmDialog } = useConfirm();
 *   if (!(await confirm({ title: 'Void bill?', destructive: true }))) return;
 *   return (<>{confirmDialog}{...}</>);
 */

export interface ConfirmOptions {
    title: string;
    description?: string;
    confirmText?: string;
    cancelText?: string;
    destructive?: boolean;
}

export function useConfirm() {
    const [state, setState] = React.useState<{ open: boolean; opts: ConfirmOptions } | null>(null);
    const resolver = React.useRef<((v: boolean) => void) | null>(null);

    const settle = React.useCallback((v: boolean) => {
        resolver.current?.(v);
        resolver.current = null;
        setState((s) => (s ? { ...s, open: false } : s));
    }, []);

    const confirm = React.useCallback(
        (opts: ConfirmOptions) =>
            new Promise<boolean>((resolve) => {
                resolver.current = resolve;
                setState({ open: true, opts });
            }),
        [],
    );

    const confirmDialog = state ? (
        <AlertDialog open={state.open} onOpenChange={(o) => { if (!o) settle(false); }}>
            <AlertDialogContent>
                <AlertDialogHeader>
                    <AlertDialogTitle>{state.opts.title}</AlertDialogTitle>
                    {state.opts.description && (
                        <AlertDialogDescription>{state.opts.description}</AlertDialogDescription>
                    )}
                </AlertDialogHeader>
                <AlertDialogFooter>
                    <AlertDialogCancel onClick={() => settle(false)}>
                        {state.opts.cancelText ?? 'Cancel'}
                    </AlertDialogCancel>
                    <AlertDialogAction
                        onClick={() => settle(true)}
                        className={cn(state.opts.destructive && 'bg-rose-600 text-white hover:bg-rose-700')}
                    >
                        {state.opts.confirmText ?? 'Confirm'}
                    </AlertDialogAction>
                </AlertDialogFooter>
            </AlertDialogContent>
        </AlertDialog>
    ) : null;

    return { confirm, confirmDialog };
}

export interface PromptOptions {
    title: string;
    description?: string;
    label?: string;
    placeholder?: string;
    /** Pre-filled value, the same role the second argument of window.prompt() played. */
    defaultValue?: string;
    confirmText?: string;
    cancelText?: string;
    inputType?: React.HTMLInputTypeAttribute;
    /** Return an error string to block submission, or null/undefined to accept. */
    validate?: (value: string) => string | null | undefined;
}

/**
 * Promise-based text input. Resolves with the trimmed string, or `null` if dismissed - matching
 * `window.prompt()`'s contract so call sites keep their `if (x === null) return;` guard.
 */
export function usePrompt() {
    const [state, setState] = React.useState<{ open: boolean; opts: PromptOptions } | null>(null);
    const [value, setValue] = React.useState('');
    const [error, setError] = React.useState<string | null>(null);
    const resolver = React.useRef<((v: string | null) => void) | null>(null);

    const settle = React.useCallback((v: string | null) => {
        resolver.current?.(v);
        resolver.current = null;
        setError(null);
        setState((s) => (s ? { ...s, open: false } : s));
    }, []);

    const prompt = React.useCallback(
        (opts: PromptOptions) =>
            new Promise<string | null>((resolve) => {
                resolver.current = resolve;
                setValue(opts.defaultValue ?? '');
                setError(null);
                setState({ open: true, opts });
            }),
        [],
    );

    const submit = React.useCallback(() => {
        if (!state) return;
        const trimmed = value.trim();
        const problem = state.opts.validate?.(trimmed);
        if (problem) { setError(problem); return; }
        settle(trimmed);
    }, [state, value, settle]);

    const promptDialog = state ? (
        <Dialog open={state.open} onOpenChange={(o) => { if (!o) settle(null); }}>
            <DialogContent className="sm:max-w-md">
                <DialogHeader>
                    <DialogTitle>{state.opts.title}</DialogTitle>
                    {state.opts.description && (
                        <DialogDescription>{state.opts.description}</DialogDescription>
                    )}
                </DialogHeader>
                <div className="space-y-2">
                    {state.opts.label && <Label htmlFor="prompt-input">{state.opts.label}</Label>}
                    <Input
                        id="prompt-input"
                        autoFocus
                        type={state.opts.inputType ?? 'text'}
                        placeholder={state.opts.placeholder}
                        value={value}
                        onChange={(e) => { setValue(e.target.value); if (error) setError(null); }}
                        // Enter submits, so the dialog behaves like the native prompt it replaces.
                        onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); submit(); } }}
                        aria-invalid={!!error}
                    />
                    {error && <p className="text-sm text-rose-600 dark:text-rose-400">{error}</p>}
                </div>
                <DialogFooter>
                    <Button variant="outline" onClick={() => settle(null)}>
                        {state.opts.cancelText ?? 'Cancel'}
                    </Button>
                    <Button onClick={submit}>{state.opts.confirmText ?? 'Save'}</Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    ) : null;

    return { prompt, promptDialog };
}
