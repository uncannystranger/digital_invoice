import React, {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import { Link, useNavigate } from "react-router-dom";
import { AnimatePresence, motion } from "motion/react";
import {
  Check,
  X,
  LogOut,
  Settings,
  ChevronDown,
  Plus,
  Search,
  Users,
} from "lucide-react";
import { Avatar, Modal } from "./ui";
import { snappy } from "./interaction";
import { useAuth } from "./Auth.jsx";
const ToastContext = createContext(() => {});
export const useToast = () => useContext(ToastContext);
export function ToastProvider({ children }) {
  const [toast, setToast] = useState(null),
    timer = useRef();
  const notify = (text) => {
    clearTimeout(timer.current);
    setToast({ id: crypto.randomUUID(), text });
    timer.current = setTimeout(() => setToast(null), 3000);
  };
  useEffect(() => () => clearTimeout(timer.current), []);
  return (
    <ToastContext value={notify}>
      {children}
      <div className="toast-region" role="status" aria-live="polite">
        <AnimatePresence>
          {toast && (
            <motion.div
              key={toast.id}
              className="toast"
              initial={{ opacity: 0, y: 8 }}
              transition={snappy}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
            >
              <Check size={20} />
              <span>{toast.text}</span>
              <button aria-label="Xir farriinta" onClick={() => setToast(null)}>
                <X size={18} />
              </button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </ToastContext>
  );
}
export function Profile({ settings }) {
  const { user, logout } = useAuth(),
    [open, setOpen] = useState(false),
    ref = useRef(),
    trigger = useRef();
  useEffect(() => {
    if (!open) return;
    ref.current.querySelector(".profile-menu a")?.focus();
    const outside = (e) => {
      if (!ref.current.contains(e.target)) setOpen(false);
    };
    const key = (e) => {
      if (e.key === "Escape") {
        setOpen(false);
        trigger.current.focus();
      }
    };
    document.addEventListener("pointerdown", outside);
    document.addEventListener("keydown", key);
    return () => {
      document.removeEventListener("pointerdown", outside);
      document.removeEventListener("keydown", key);
    };
  }, [open]);
  return (
    <div
      className="profile"
      ref={ref}
      onBlur={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget)) setOpen(false);
      }}
    >
      <button
        ref={trigger}
        className="user-link"
        aria-label="Akoonka ganacsiga"
        aria-expanded={open}
        onClick={() => setOpen(!open)}
      >
        <Avatar name={settings.name} logo={settings.logo} />
        <span>{settings.name}</span>
        <ChevronDown size={18} />
      </button>
      <AnimatePresence>
        {open && (
          <motion.div
            className="profile-menu"
            initial={{ opacity: 0, y: -4, scale: 0.98 }}
            transition={snappy}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0 }}
          >
            <strong>{settings.name}</strong>
            <small>{user.email}</small>
            <hr />
            <Link to="/dejinta" onClick={() => setOpen(false)}>
              <Settings size={19} />
              Dejinta
            </Link>
            <button onClick={logout}>
              <LogOut size={19} />
              Ka bax
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
export function CommandPalette() {
  const [open, setOpen] = useState(false),
    [q, setQ] = useState(""),
    navigate = useNavigate();
  useEffect(() => {
    const key = (e) => {
      const typing = e.target.closest(
        'input,textarea,select,[contenteditable="true"]',
      );
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setQ("");
        setOpen((v) => !v);
      } else if (
        e.key.toLowerCase() === "n" &&
        !typing &&
        !e.metaKey &&
        !e.ctrlKey &&
        !e.altKey &&
        !e.shiftKey &&
        !document.querySelector('[role="dialog"]')
      )
        navigate("/qaansheegyo/cusub");
    };
    document.addEventListener("keydown", key);
    return () => document.removeEventListener("keydown", key);
  }, [navigate]);
  const options = [
    ["Samee Qaansheeg", "/qaansheegyo/cusub", Plus],
    ["Raadi Qaansheeg", "/qaansheegyo?search=1", Search],
    ["Raadi Macmiil", "/macaamiisha?search=1", Users],
    ["Dejinta", "/dejinta", Settings],
  ].filter(([label]) => label.toLowerCase().includes(q.toLowerCase()));
  return (
    <AnimatePresence>
      {open && (
        <Modal title="Tag…" onClose={() => setOpen(false)}>
          <input
            className="command-input"
            aria-label="Raadi ficil"
            placeholder="Raadi ficil…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "ArrowDown") {
                e.preventDefault();
                e.currentTarget.parentElement
                  .querySelector(".command-options button")
                  ?.focus();
              }
              if (e.key === "Enter" && options[0]) {
                navigate(options[0][1]);
                setOpen(false);
              }
            }}
          />
          <div className="command-options">
            {options.map(([label, path, Icon]) => (
              <button
                key={path}
                onClick={() => {
                  navigate(path);
                  setOpen(false);
                }}
              >
                <Icon size={20} />
                {label}
              </button>
            ))}
            {!options.length && <p>Waxba lama helin.</p>}
          </div>
        </Modal>
      )}
    </AnimatePresence>
  );
}
