import { useRef, useState } from "react";
import styles from "./HoldToConfirmButton.module.css";

type HoldState = 'idle' | 'holding' | 'busy';

type HoldToConfirmButtonProps = {
    onConfirm: () => void | Promise<void>;
    idleLabel: React.ReactNode;
    holdingLabel?: React.ReactNode;
    busyLabel?: React.ReactNode;
    holdDurationMs?: number;
    disabled?: boolean;
    className?: string;
    ariaLabel?: string;
};

export function HoldToConfirmButton({
    onConfirm,
    idleLabel,
    holdingLabel,
    busyLabel,
    holdDurationMs = 700,
    disabled = false,
    className,
    ariaLabel
}: HoldToConfirmButtonProps) {
    const [state, setState] = useState<HoldState>('idle');
    const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    function clearHoldTimer() {
        if (timeoutRef.current) {
            clearTimeout(timeoutRef.current);
            timeoutRef.current = null;
        }
    }

    function startHold() {
        if (disabled || state !== 'idle') return;

        setState('holding');
        timeoutRef.current = setTimeout(async () => {
            setState('busy');
            try {
                await onConfirm();
            } finally {
                setState('idle');
            }
        }, holdDurationMs);
    }

    function cancelHold() {
        if (state !== 'holding') return;
        clearHoldTimer();
        setState('idle');
    }

    const isFilled = state === 'holding' || state === 'busy';
    const label =
        state === 'holding' ? (holdingLabel ?? idleLabel) :
        state === 'busy' ? (busyLabel ?? idleLabel) :
        idleLabel;

    return (
        <button
            type="button"
            className={`${styles.holdButton} ${className ?? ''}`}
            disabled={disabled || state === 'busy'}
            aria-label={ariaLabel}
            aria-pressed={state !== 'idle'}
            onPointerDown={startHold}
            onPointerUp={cancelHold}
            onPointerLeave={cancelHold}
            onPointerCancel={cancelHold}
            onKeyDown={(e) => {
                if ((e.key === 'Enter' || e.key === ' ') && !e.repeat) startHold();
            }}
            onKeyUp={(e) => {
                if (e.key === 'Enter' || e.key === ' ') cancelHold();
            }}
        >
            <span
                className={styles.fill}
                style={{
                    width: isFilled ? '100%' : '0%',
                    transitionDuration: state === 'holding' ? `${holdDurationMs}ms` : '150ms'
                }}
            />
            <span className={styles.label}>{label}</span>
        </button>
    );
}
