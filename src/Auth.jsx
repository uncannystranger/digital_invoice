import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useRef,
} from "react";
import { Navigate, useLocation, useNavigate } from "react-router-dom";
import { Eye, EyeOff, Check } from "lucide-react";
import { Brand, Button } from "./ui";
import { authAdapter, safeReturnTo, SESSION_KEY } from "./auth";
const AuthContext = createContext(null);
export const useAuth = () => useContext(AuthContext);
export function AuthProvider({ children }) {
  const [user, setUser] = useState(null),
    [ready, setReady] = useState(false),
    [error, setError] = useState("");
  async function restoreSession() {
    try {
      setUser(await authAdapter.restoreSession());
      setError("");
    } catch {
      setUser(null);
      setError(
        "Kaydka browser-ka lama furi karin. Fadlan oggolow kaydinta oo mar kale isku day.",
      );
    } finally {
      setReady(true);
    }
  }
  useEffect(() => {
    restoreSession();
    const sync = (e) => {
      if (!e.key || e.key === SESSION_KEY) restoreSession();
    };
    window.addEventListener("storage", sync);
    window.addEventListener("focus", restoreSession);
    return () => {
      window.removeEventListener("storage", sync);
      window.removeEventListener("focus", restoreSession);
    };
  }, []);
  useEffect(() => {
    if (!user) return;
    const timer = setTimeout(
      restoreSession,
      Math.max(0, user.expiresAt - Date.now()),
    );
    return () => clearTimeout(timer);
  }, [user]);
  const login = async (email, password) => authAdapter.login(email, password);
  const completeLogin = (session) => setUser(session);
  const logout = async () => {
    await authAdapter.logout();
    setUser(null);
  };
  return (
    <AuthContext
      value={{ user, ready, login, completeLogin, logout, restoreSession }}
    >
      {error ? (
        <div className="boot" role="alert">
          <Brand />
          <p>{error}</p>
          <Button onClick={restoreSession}>Mar kale isku day</Button>
        </div>
      ) : (
        children
      )}
    </AuthContext>
  );
}
export function AuthGate({ children }) {
  const { user, ready } = useAuth(),
    loc = useLocation();
  if (!ready)
    return (
      <div className="boot" role="status">
        <Brand />
        <p>Waa la soo rarayaa…</p>
      </div>
    );
  if (loc.pathname === "/login") return <Login />;
  if (!user)
    return (
      <Navigate
        replace
        to={"/login?returnTo=" + encodeURIComponent(loc.pathname + loc.search)}
      />
    );
  return children;
}
function Login() {
  const { user, login, completeLogin } = useAuth(),
    location = useLocation(),
    navigate = useNavigate();
  const [email, setEmail] = useState(""),
    [password, setPassword] = useState(""),
    [show, setShow] = useState(false),
    [phase, setPhase] = useState("idle"),
    [error, setError] = useState("");
  const emailRef = useRef(),
    passwordRef = useRef();
  const returnTo = safeReturnTo(
    new URLSearchParams(location.search).get("returnTo"),
  );
  useEffect(() => {
    document.title = "Soo gal | Digital Invoice";
    if (matchMedia("(hover: hover) and (min-width: 801px)").matches)
      emailRef.current?.focus();
  }, []);
  if (user) return <Navigate to={returnTo} replace />;
  async function submit(e) {
    e.preventDefault();
    if (phase !== "idle") return;
    setError("");
    setPhase("loading");
    try {
      const session = await login(email, password);
      if (!session) {
        setError("Email-ka ama furaha sirta ah sax ma aha.");
        setPhase("idle");
        passwordRef.current?.focus();
        return;
      }
      setPhase("success");
      await new Promise((resolve) => setTimeout(resolve, 180));
      setPhase("leaving");
      await new Promise((resolve) => setTimeout(resolve, 150));
      completeLogin(session);
      navigate(returnTo, { replace: true });
    } catch {
      setError("Gelitaanka wuu fashilmay. Fadlan mar kale isku day.");
      setPhase("idle");
    }
  }
  return (
    <div className="login-page">
      <section
        className={"login-card " + (phase === "leaving" ? "leaving" : "")}
        aria-labelledby="login-title"
      >
        <div className="login-brand">
          <Brand />
        </div>
        <div className="login-heading">
          <h1 id="login-title">Soo gal Digital Invoice</h1>
          <p>Geli xogta akoonkaaga si aad u sii wadato.</p>
        </div>
        <form onSubmit={submit} className="login-form">
          <label className="field">
            <span>Email</span>
            <input
              ref={emailRef}
              name="email"
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(e) => {
                setEmail(e.target.value);
                setError("");
              }}
            />
          </label>
          <label className="field">
            <span>Furaha sirta</span>
            <div className="password-input">
              <input
                ref={passwordRef}
                name="password"
                type={show ? "text" : "password"}
                autoComplete="current-password"
                required
                value={password}
                aria-invalid={!!error}
                aria-describedby={error ? "login-error" : undefined}
                onChange={(e) => {
                  setPassword(e.target.value);
                  setError("");
                }}
              />
              <button
                type="button"
                className="password-toggle icon-button"
                aria-label={show ? "Qari furaha sirta" : "Muuji furaha sirta"}
                aria-pressed={show}
                onClick={() => setShow(!show)}
              >
                {show ? (
                  <EyeOff key="hidden" size={20} />
                ) : (
                  <Eye key="visible" size={20} />
                )}
              </button>
            </div>
          </label>
          {error && (
            <p id="login-error" className="login-error" role="alert">
              {error}
            </p>
          )}
          <Button
            type="submit"
            size="lg"
            busy={phase === "loading"}
            disabled={phase !== "idle"}
            className="login-submit"
          >
            {phase === "success" || phase === "leaving" ? (
              <>
                <Check size={21} /> Waa lagu soo galay
              </>
            ) : (
              "Soo gal"
            )}
          </Button>
          <span className="sr-only" role="status">
            {phase === "loading" ? "Waa lagu gelinayaa…" : ""}
          </span>
        </form>
      </section>
    </div>
  );
}
