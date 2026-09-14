import React, { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence, useReducedMotion } from "motion/react";
import {
  X,
  LoaderCircle,
  Check,
  ArrowUpRight,
  Plus,
  FileText,
  ChevronDown,
} from "lucide-react";
import { useText, labels } from "./i18n";
import { formatMoney } from "../shared/finance";
import { buttonMotion, pointerLight, snappy } from "./interaction";
export function Brand({ compact = false, mono = false }) {
  return (
    <span className={"brand " + (compact ? "compact" : "")}>
      <svg
        className="brand-mark"
        viewBox="0 0 48 48"
        fill="none"
        aria-hidden="true"
      >
        <rect
          width="48"
          height="48"
          rx="14"
          fill={mono ? "none" : "currentColor"}
        />
        <g
          className="mark-lines"
          stroke={mono ? "currentColor" : "#faf9f1"}
          strokeWidth="2.8"
          strokeLinejoin="round"
          strokeLinecap="round"
        >
          <path d="M29 10H18a6 6 0 0 0-6 6v14a6 6 0 0 0 6 6h11a6 6 0 0 0 6-6V17l-6-7Z" />
          <path d="M29 10v8h6M18 23h10M18 28h7m-1 3c5-5 6 9 15 5" />
        </g>
      </svg>
      {!compact && <span>Digital Invoice</span>}
    </span>
  );
}
export function Avatar({ name = "", logo = "", large = false }) {
  const hue = ([...name].reduce((a, c) => a + c.charCodeAt(0), 0) % 60) + 65;
  return (
    <span
      className={"avatar " + (large ? "large" : "")}
      style={{
        background: `hsl(${hue} 18% 88%)`,
        color: `hsl(${hue} 18% 32%)`,
      }}
    >
      {logo ? (
        <img src={logo} alt="" />
      ) : (
        name
          .split(" ")
          .slice(0, 2)
          .map((n) => n[0])
          .join("")
          .toUpperCase()
      )}
    </span>
  );
}

export function Button({
  children,
  busy = false,
  loading = false,
  size = "md",
  variant = "primary",
  className = "",
  ...props
}) {
  return (
    <motion.button
      type="button"
      aria-busy={busy || loading}
      {...buttonMotion}
      onPointerMove={pointerLight}
      className={`button ${variant} size-${size} ${className}`}
      {...props}
      disabled={props.disabled || busy || loading}
    >
      {busy || loading ? <LoaderCircle className="spin" size={19} /> : null}
      {children}
    </motion.button>
  );
}
export function IconButton({ label, children, ...props }) {
  return (
    <button
      type="button"
      className="icon-button"
      aria-label={label}
      data-tooltip={label}
      {...props}
    >
      {children}
    </button>
  );
}
export function Status({ status }) {
  const t = useText();
  return (
    <motion.span
      layout
      initial={false}
      animate={{ opacity: 1, scale: 1 }}
      className={"status " + status}
    >
      <i />
      <AnimatePresence initial={false} mode="popLayout">
        <motion.span
          key={status}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.24 }}
        >
          {t(...(labels[status] || labels.draft))}
        </motion.span>
      </AnimatePresence>
    </motion.span>
  );
}
export function NumberValue({ value, currency }) {
  const [v, setV] = useState(value),
    reduce = useReducedMotion();
  useEffect(() => {
    if (reduce) {
      setV(value);
      return;
    }
    let start, frame;
    const from = v;
    const tick = (time) => {
      start ??= time;
      const p = Math.min((time - start) / 650, 1);
      setV(Math.round(from + (value - from) * (1 - (1 - p) ** 3)));
      if (p < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [value, reduce]);
  return currency ? formatMoney(v, currency) : v.toLocaleString();
}

export function Field({ label, error, children, className = "", ...props }) {
  const Wrapper = children?.type === "div" ? "div" : "label";
  const content =
    children && ["select", "textarea", "input"].includes(children.type)
      ? React.cloneElement(children, { "aria-label": label })
      : children;
  return (
    <Wrapper className={"field " + className}>
      <span>{label}</span>
      {content || <input {...props} />}
      {error && <small className="error-text">{error}</small>}
    </Wrapper>
  );
}
export function ErrorBox({ error, retry }) {
  const t = useText();
  return error ? (
    <div className="error-box" role="alert">
      <span>{error}</span>
      {retry && (
        <button onClick={retry}>{t("Mar kale isku day", "Try again")}</button>
      )}
    </div>
  ) : null;
}

export function Modal({ title, children, onClose, wide = false }) {
  const ref = useRef(),
    previous = useRef(document.activeElement);
  useEffect(() => {
    const old = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const node = ref.current;
    node.querySelector("input,button,select,textarea")?.focus();
    const key = (e) => {
      if (e.key === "Escape") onClose();
      if (e.key === "Tab") {
        const all = [
          ...node.querySelectorAll(
            'button:not(:disabled),input,select,textarea,a[href],[tabindex="0"]',
          ),
        ].filter((x) => x.offsetParent !== null);
        if (!all.length) return;
        if (e.shiftKey && document.activeElement === all[0]) {
          e.preventDefault();
          all.at(-1).focus();
        } else if (!e.shiftKey && document.activeElement === all.at(-1)) {
          e.preventDefault();
          all[0].focus();
        }
      }
    };
    document.addEventListener("keydown", key);
    return () => {
      document.body.style.overflow = old;
      document.removeEventListener("keydown", key);
      previous.current?.focus();
    };
  }, []);
  return (
    <motion.div
      className="modal-backdrop"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onMouseDown={(e) => e.target === e.currentTarget && onClose()}
    >
      <motion.div
        ref={ref}
        className={"modal " + (wide ? "wide" : "")}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        initial={{ opacity: 0, scale: 0.97, y: 6 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.97 }}
        transition={snappy}
      >
        <div className="modal-heading">
          <h2>{title}</h2>
          <IconButton label="Xir" onClick={onClose}>
            <X size={20} />
          </IconButton>
        </div>
        {children}
      </motion.div>
    </motion.div>
  );
}

export function QuietCount({ value }) {
  return (
    <motion.span
      className="quiet-count"
      key={value}
      initial={{ opacity: 0.4, y: 2 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.18 }}
    >
      {value}
    </motion.span>
  );
}
