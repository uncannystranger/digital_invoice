import "@fontsource/dm-sans/latin-400.css";
import "@fontsource/dm-sans/latin-500.css";
import "@fontsource/dm-sans/latin-600.css";
import React, { useState, useEffect, useContext, createContext } from "react";
import { createRoot } from "react-dom/client";
import { flushSync } from "react-dom";
import {
  BrowserRouter,
  Routes,
  Route,
  NavLink,
  Link,
  useNavigate,
  useParams,
  Navigate,
  useLocation,
} from "react-router-dom";
import { MotionConfig, motion, AnimatePresence } from "motion/react";
import {
  FileText,
  Users,
  Settings,
  Plus,
  Search,
  ArrowUpRight,
  ArrowLeft,
  MoreHorizontal,
  Download,
  Printer,
  Send,
  Trash2,
  Check,
  ChevronDown,
  Copy,
  Pencil,
  X,
} from "lucide-react";
import { repository } from "./repository";
import { calculate, formatMoney, today } from "../shared/finance";
import {
  Button,
  Field,
  Modal,
  ErrorBox,
  Avatar,
  Status,
  NumberValue,
  IconButton,
  Brand,
  QuietCount,
} from "./ui";
import Document from "./Document";
import { downloadInvoice, printInvoice, invoicePdf } from "./pdf";
import "./style.css";
import "./premium.css";
import FloatingCreate from "./FloatingCreate";
import { buttonMotion, pointerLight, snappy } from "./interaction";
const MotionLink = motion.create(Link);
import { AuthProvider, AuthGate } from "./Auth.jsx";
import { ToastProvider, useToast, Profile, CommandPalette } from "./Feedback";
const Context = createContext();
const useData = () => useContext(Context);
const dates = (d) => {
  const [y, m, day] = d.split("-");
  return `${Number(day)} ${["Jannaayo", "Febraayo", "Maarso", "Abriil", "Maajo", "Juun", "Luulyo", "Agoosto", "Sebtembar", "Oktoobar", "Nofembar", "Diseembar"][Number(m) - 1]} ${y}`;
};
const newItem = () => ({
  id: crypto.randomUUID(),
  description: "",
  quantity: 1,
  price: 0,
});
function TransitionLink({ to, transitionName, children, ...props }) {
  const navigate = useNavigate();
  const Component = props.className?.includes("button") ? MotionLink : Link;
  return (
    <Component
      to={to}
      {...(Component === MotionLink
        ? { ...buttonMotion, onPointerMove: pointerLight }
        : {})}
      {...props}
      onClick={(event) => {
        if (
          !document.startViewTransition ||
          window.matchMedia("(prefers-reduced-motion: reduce)").matches ||
          event.metaKey ||
          event.ctrlKey ||
          event.shiftKey ||
          event.altKey ||
          event.button !== 0
        )
          return;
        event.preventDefault();
        const source = event.currentTarget;
        source.style.viewTransitionName = transitionName;
        const transition = document.startViewTransition(() =>
          flushSync(() => navigate(to)),
        );
        const cleanup = () =>
          source.style.removeProperty("view-transition-name");
        transition.finished.then(cleanup, cleanup);
      }}
    >
      {children}
    </Component>
  );
}
function CreateLink() {
  return (
    <TransitionLink
      transitionName="composer-focus"
      className="button primary create-link"
      to="/qaansheegyo/cusub"
    >
      <Plus size={20} />
      Samee Qaansheeg
    </TransitionLink>
  );
}
function Heading({ title, description, children }) {
  return (
    <header className="page-heading">
      <div>
        <h1>{title}</h1>
        {description && <p>{description}</p>}
      </div>
      {children}
    </header>
  );
}
function SearchField({ value, onChange, placeholder }) {
  const loc = useLocation();
  const ref = React.useRef();
  useEffect(() => {
    if (new URLSearchParams(loc.search).has("search")) ref.current?.focus();
  }, [loc.search]);
  return (
    <div className="search-field">
      <Search size={22} />
      <input
        ref={ref}
        aria-label={placeholder}
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
      {value && (
        <button
          type="button"
          className="search-clear"
          aria-label="Nadiifi raadinta"
          onClick={() => {
            onChange("");
            ref.current?.focus();
          }}
        >
          <X size={18} />
        </button>
      )}
    </div>
  );
}
function optimizeLogo(file) {
  return new Promise((resolve, reject) => {
    if (!file || !["image/png", "image/jpeg", "image/webp"].includes(file.type))
      return reject(new Error("Dooro PNG, JPG ama WebP."));
    if (file.size > 8 * 1024 * 1024)
      return reject(new Error("Logo-gu ha ka weynaan 8 MB."));
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("Logo-ga lama akhriyi karin."));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error("Logo-ga sawir sax ah ma aha."));
      img.onload = () => {
        const scale = Math.min(1, 1024 / img.width, 1024 / img.height);
        const canvas = document.createElement("canvas");
        canvas.width = Math.max(1, Math.round(img.width * scale));
        canvas.height = Math.max(1, Math.round(img.height * scale));
        canvas
          .getContext("2d")
          .drawImage(img, 0, 0, canvas.width, canvas.height);
        resolve(
          canvas.toDataURL(
            file.type === "image/png"
              ? "image/png"
              : file.type === "image/webp"
                ? "image/webp"
                : "image/jpeg",
            file.type === "image/png" ? undefined : 0.9,
          ),
        );
      };
      img.src = reader.result;
    };
    reader.readAsDataURL(file);
  });
}
function InvoiceRows({ invoices }) {
  return (
    <div className="invoice-list">
      {invoices.map((i) => (
        <motion.div layout key={i.id}>
          <TransitionLink
            transitionName="invoice-focus"
            className="invoice-row"
            to={"/qaansheegyo/" + i.id}
          >
            <Avatar name={i.customerSnapshot.name} />
            <div className="row-customer">
              <strong>{i.customerSnapshot.name}</strong>
              <span>{i.number}</span>
            </div>
            <time>{dates(i.issue)}</time>
            <strong className="row-amount">
              {formatMoney(i.total, i.currency)}
            </strong>
            <Status status={i.status} />
            <ArrowUpRight className="row-arrow" size={22} />
          </TransitionLink>
        </motion.div>
      ))}
    </div>
  );
}
function Invoices() {
  const { data } = useData();
  const [q, setQ] = useState(""),
    [filter, setFilter] = useState("all");
  if (!data.invoices.length)
    return (
      <>
        <Heading
          title="Qaansheegyada"
          description="Samee, dir oo la soco qaansheegyadaada."
        />
        <div className="empty">
          <FileText size={42} />
          <h2>Weli qaansheeg ma lihid.</h2>
          <p>Samee qaansheeggaaga ugu horreeya.</p>
          <CreateLink />
        </div>
      </>
    );
  const matches = (i, f) =>
    f === "all" ||
    (f === "waiting" ? ["sent", "partial"].includes(i.status) : i.status === f);
  const rows = data.invoices.filter(
    (i) =>
      matches(i, filter) &&
      `${i.number} ${i.customerSnapshot.name}`
        .toLowerCase()
        .includes(q.toLowerCase()),
  );
  return (
    <>
      <Heading
        title="Qaansheegyada"
        description="Samee, dir oo la soco qaansheegyadaada."
      >
        <CreateLink />
      </Heading>
      <p className="sample-label">
        {data.invoices.some((i) => i.sample)
          ? "Waxaa ku jira tusaalooyin · "
          : ""}
        Ku kaydsan browser-kan
      </p>
      <div className="summary-strip">
        {[
          ["all", "Dhammaan"],
          ["waiting", "La sugayo"],
          ["paid", "La bixiyey"],
          ["overdue", "Daahay"],
        ].map(([key, label]) => (
          <button
            key={key}
            className={filter === key ? "selected" : ""}
            onClick={() => setFilter(key)}
            aria-pressed={filter === key}
          >
            <span>{label}</span>
            <strong>
              <QuietCount
                value={data.invoices.filter((i) => matches(i, key)).length}
              />
            </strong>
            {filter === key && <motion.i layoutId="summary-active" />}
          </button>
        ))}
      </div>
      <div className="list-tools">
        <SearchField
          value={q}
          onChange={setQ}
          placeholder="Raadi qaansheeg ama macmiil..."
        />
        <span className="record-count">
          <QuietCount value={rows.length} /> qaansheeg
        </span>
      </div>
      <div className="filters" aria-label="Shaandhee qaansheegyada">
        {[
          ["all", "Dhammaan"],
          ["draft", "Qabyo"],
          ["sent", "La diray"],
          ["paid", "La bixiyey"],
          ["partial", "Qayb laga bixiyey"],
          ["overdue", "Daahay"],
        ].map(([key, label]) => (
          <button
            key={key}
            aria-pressed={filter === key}
            className={filter === key ? "selected" : ""}
            onClick={() => setFilter(key)}
          >
            {filter === key && (
              <motion.span
                className="filter-active"
                layoutId="filter-active"
                transition={snappy}
              />
            )}
            <span>{label}</span>
          </button>
        ))}
      </div>
      {rows.length ? (
        <InvoiceRows invoices={rows} />
      ) : (
        <div className="empty">
          <FileText size={42} />
          <h2>
            {data.invoices.length
              ? "Waxba lama helin."
              : "Weli qaansheeg ma lihid."}
          </h2>
          <p>
            {data.invoices.length
              ? "Isku day raadin kale."
              : "Samee qaansheeggaaga ugu horreeya."}
          </p>
          {!data.invoices.length && <CreateLink />}
        </div>
      )}
      <p className="local-note">
        <span />
        Xogtu waxay ku kaydsan tahay browser-kan. Diiwaannada bilowga ahi waa
        tusaale.
      </p>
    </>
  );
}
function CustomerForm({ onClose, onSave, initial }) {
  const notify = useToast();
  const { reload } = useData();
  const [f, setF] = useState(
      initial || { name: "", contact: "", phone: "", email: "", address: "" },
    ),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  return (
    <Modal
      title={initial ? "Wax ka beddel macmiilka" : "Macmiil cusub"}
      onClose={onClose}
    >
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          setBusy(true);
          try {
            const c = {
              ...f,
              name: f.name.trim(),
              id: f.id || crypto.randomUUID(),
            };
            if (!c.name) throw new Error("Geli magaca macmiilka.");
            await repository.put("customers", c);
            await reload();
            notify(
              initial
                ? "Macmiilka waa la kaydiyey."
                : "Macmiilka waa la daray.",
            );
            onSave?.(c);
            onClose();
          } catch (e) {
            setError(e.message);
          } finally {
            setBusy(false);
          }
        }}
      >
        <ErrorBox error={error} />
        {[
          ["name", "Magaca macmiilka"],
          ["contact", "Qofka lala xiriirayo"],
          ["phone", "Telefoon"],
          ["email", "Email"],
          ["address", "Cinwaan"],
        ].map(([key, label]) => (
          <Field
            key={key}
            label={label}
            required={key === "name"}
            type={key === "email" ? "email" : "text"}
            value={f[key]}
            onChange={(e) => setF({ ...f, [key]: e.target.value })}
          />
        ))}
        <div className="form-actions">
          <Button variant="secondary" onClick={onClose}>
            Ka noqo
          </Button>
          <Button type="submit" busy={busy}>
            Kaydi
          </Button>
        </div>
      </form>
    </Modal>
  );
}
function Customers() {
  const { data } = useData();
  const [q, setQ] = useState(""),
    [newCustomer, setNew] = useState(false);
  return (
    <>
      <Heading
        title="Macaamiisha"
        description="Macmiil kasta, qaansheegyadiisa."
      >
        <Button onClick={() => setNew(true)}>
          <Plus size={20} />
          Macmiil cusub
        </Button>
      </Heading>
      <SearchField value={q} onChange={setQ} placeholder="Raadi macmiil..." />
      <div className="customer-grid">
        {data.customers
          .filter((c) =>
            `${c.name} ${c.contact} ${c.phone} ${c.email}`
              .toLowerCase()
              .includes(q.toLowerCase()),
          )
          .map((c) => {
            const invoices = data.invoices.filter((i) => i.customerId === c.id);
            return (
              <Link
                className="customer-card"
                to={"/macaamiisha/" + c.id}
                key={c.id}
              >
                <div className="customer-card-top">
                  <Avatar name={c.name} />
                  <ArrowUpRight size={22} />
                </div>
                <h2>{c.name}</h2>
                <p>{c.contact}</p>
                <p>{c.phone}</p>
                <p>{c.email}</p>
                <footer>
                  <span>{invoices.length} qaansheeg</span>
                  <strong>
                    {["USD", "SOS"]
                      .filter((currency) =>
                        invoices.some((i) => i.currency === currency),
                      )
                      .map((currency) =>
                        formatMoney(
                          invoices
                            .filter((i) => i.currency === currency)
                            .reduce((a, i) => a + i.total, 0),
                          currency,
                        ),
                      )
                      .join(" · ") || "$0.00"}
                  </strong>
                </footer>
              </Link>
            );
          })}
      </div>
      {newCustomer && <CustomerForm onClose={() => setNew(false)} />}
    </>
  );
}
function CustomerDetail() {
  const { id } = useParams(),
    { data } = useData();
  const [edit, setEdit] = useState(false);
  const c = data.customers.find((c) => c.id === id);
  if (!c) return <p>Macmiilka lama helin.</p>;
  return (
    <>
      <Link className="back" to="/macaamiisha">
        <ArrowLeft size={20} />
        Macaamiisha
      </Link>
      <Heading title={c.name}>
        <Button variant="secondary" onClick={() => setEdit(true)}>
          <Pencil size={20} />
          Wax ka beddel
        </Button>
      </Heading>
      <div className="contact-details">
        <Avatar name={c.name} />
        <div>
          <strong>{c.contact}</strong>
          <p>
            {c.phone} · {c.email}
          </p>
          <p>{c.address}</p>
        </div>
      </div>
      <div className="section-heading">
        <h2>Qaansheegyada</h2>
        <Link
          className="button primary"
          to={"/qaansheegyo/cusub?customer=" + c.id}
        >
          <Plus size={20} />
          Samee Qaansheeg
        </Link>
      </div>
      <InvoiceRows
        invoices={data.invoices.filter((i) => i.customerId === id)}
      />
      {edit && <CustomerForm initial={c} onClose={() => setEdit(false)} />}
    </>
  );
}
function Picker({ selected, onSelect }) {
  const { data } = useData();
  const [open, setOpen] = useState(false),
    [q, setQ] = useState(""),
    [create, setCreate] = useState(false);
  return (
    <>
      <button
        className="customer-picker"
        type="button"
        onClick={() => setOpen(true)}
      >
        <Avatar name={selected?.name || "M"} />
        <span>{selected?.name || "Dooro macmiil"}</span>
        <ChevronDown size={22} />
      </button>
      <button
        type="button"
        className="text-button"
        onClick={() => setCreate(true)}
      >
        <Plus size={20} />
        Macmiil cusub
      </button>
      {open && (
        <Modal title="Dooro macmiil" onClose={() => setOpen(false)}>
          <SearchField
            value={q}
            onChange={setQ}
            placeholder="Raadi macmiil..."
          />
          <div className="picker-options">
            {data.customers
              .filter((c) => c.name.toLowerCase().includes(q.toLowerCase()))
              .map((c) => (
                <button
                  type="button"
                  key={c.id}
                  onClick={() => {
                    onSelect(c);
                    setOpen(false);
                  }}
                >
                  <Avatar name={c.name} />
                  {c.name}
                  {selected?.id === c.id && <Check size={20} />}
                </button>
              ))}
          </div>
        </Modal>
      )}
      {create && (
        <CustomerForm onClose={() => setCreate(false)} onSave={onSelect} />
      )}
    </>
  );
}
function Editor() {
  const notify = useToast();
  const { id } = useParams(),
    { data, reload } = useData(),
    nav = useNavigate();
  const old = data.invoices.find((i) => i.id === id),
    b = data.settings;
  const [f, setF] = useState(() =>
    old
      ? structuredClone(old)
      : {
          customerId:
            new URLSearchParams(location.search).get("customer") || "",
          issue: today(),
          due: new Date(Date.now() + b.dueDays * 86400000)
            .toISOString()
            .slice(0, 10),
          items: [newItem()],
          discount: 0,
          discountType: "percent",
          tax: b.tax,
          taxType: "percent",
          currency: b.currency,
          notes: b.notes,
          terms: b.terms,
          signature: b.signature,
          state: "draft",
          businessSnapshot: structuredClone(b),
          paymentMethods: b.methods.filter((m) => m.enabled).map((m) => m.name),
        },
  );
  const [tab, setTab] = useState("edit"),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [saved, setSaved] = useState(false);
  const customer =
    data.customers.find((c) => c.id === f.customerId) || f.customerSnapshot;
  const set = (key, v) => {
    setF((f) => ({ ...f, [key]: v }));
    setSaved(false);
  };
  let totals;
  try {
    totals = calculate(f);
  } catch (e) {
    totals = { total: 0 };
  }
  const preview = { ...f, customerSnapshot: customer };
  async function save(e) {
    e.preventDefault();
    setError("");
    setBusy(true);
    try {
      if (!customer) throw new Error("Dooro macmiil.");
      if (
        f.items.some(
          (x) => !x.description.trim() || +x.quantity <= 0 || +x.price < 0,
        )
      )
        throw new Error("Hubi sharaxaadda, tirada iyo qiimaha.");
      if (f.due < f.issue)
        throw new Error(
          "Taariikhda bixintu kama horrayn karto taariikhda qaansheegga.",
        );
      const invoice = await repository.saveInvoice({
        ...preview,
        state: old?.state || "draft",
      });
      await reload();
      setSaved(true);
      await new Promise((resolve) => setTimeout(resolve, 650));
      notify("Qaansheegga waa la kaydiyey.");
      nav("/qaansheegyo/" + invoice.id);
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <Link className="back" to={old ? "/qaansheegyo/" + id : "/qaansheegyo"}>
        <ArrowLeft size={20} />
        Qaansheegyada
      </Link>
      <Heading title={old ? "Wax ka beddel" : "Qaansheeg Cusub"}>
        <span className="composer-caption">{old?.number || "Qabyo cusub"}</span>
      </Heading>
      <div className="mobile-tabs">
        <button
          className={tab === "edit" ? "selected" : ""}
          onClick={() => setTab("edit")}
        >
          Wax ka beddel
        </button>
        <button
          className={tab === "preview" ? "selected" : ""}
          onClick={() => setTab("preview")}
        >
          Horudhac
        </button>
      </div>
      <form onSubmit={save} className={"composer show-" + tab}>
        <section className="editor">
          <ErrorBox error={error} />
          <div className="editor-section">
            <h2>Macmiilka</h2>
            <Picker
              selected={customer}
              onSelect={(c) => set("customerId", c.id)}
            />
          </div>
          <div className="editor-section">
            <h2>Taariikhda</h2>
            <div className="two-fields">
              <Field
                label="Taariikh"
                type="date"
                required
                value={f.issue}
                onChange={(e) => set("issue", e.target.value)}
              />
              <Field
                label="Taariikhda bixinta"
                type="date"
                required
                value={f.due}
                min={f.issue}
                onChange={(e) => set("due", e.target.value)}
              />
            </div>
          </div>
          <div className="editor-section">
            <h2>Waxa lagu dalacayo</h2>
            <AnimatePresence initial={false}>
              {f.items.map((item, n) => (
                <motion.div
                  className="item-editor"
                  layout
                  key={item.id}
                  initial={{ opacity: 0, height: 0, y: 8 }}
                  animate={{ opacity: 1, height: "auto", y: 0 }}
                  exit={{
                    opacity: 0,
                    height: 0,
                    marginBottom: 0,
                    overflow: "hidden",
                  }}
                >
                  <Field
                    label="Sharaxaadda"
                    required
                    value={item.description}
                    placeholder="Naqshadeynta Website-ka"
                    onChange={(e) =>
                      set(
                        "items",
                        f.items.map((x) =>
                          x.id === item.id
                            ? { ...x, description: e.target.value }
                            : x,
                        ),
                      )
                    }
                  />
                  <div className="item-values">
                    {[
                      ["quantity", "Tirada"],
                      ["price", "Qiimaha"],
                    ].map(([key, label]) => (
                      <Field
                        key={key}
                        label={label}
                        type="number"
                        min={key === "quantity" ? "0.01" : "0"}
                        step="0.01"
                        required
                        value={item[key]}
                        onChange={(e) =>
                          set(
                            "items",
                            f.items.map((x) =>
                              x.id === item.id
                                ? { ...x, [key]: e.target.value }
                                : x,
                            ),
                          )
                        }
                      />
                    ))}
                    <div className="line-total">
                      <span>Wadarta</span>
                      <strong>
                        {formatMoney(
                          Math.round(item.quantity * item.price * 100),
                          f.currency,
                        )}
                      </strong>
                    </div>
                    <IconButton
                      label={"Tirtir shayga " + (n + 1)}
                      disabled={f.items.length === 1}
                      onClick={() =>
                        set(
                          "items",
                          f.items.filter((x) => x.id !== item.id),
                        )
                      }
                    >
                      <Trash2 size={20} />
                    </IconButton>
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>
            <Button
              variant="secondary"
              onClick={() => set("items", [...f.items, newItem()])}
            >
              <Plus size={20} />
              Ku dar
            </Button>
          </div>
          <div className="editor-section">
            <div className="two-fields">
              <Field
                label="Dhimis (%)"
                type="number"
                min="0"
                max="100"
                step="0.01"
                value={f.discount}
                onChange={(e) => set("discount", e.target.value)}
              />
              <Field
                label="Canshuur (%)"
                type="number"
                min="0"
                max="100"
                step="0.01"
                value={f.tax}
                onChange={(e) => set("tax", e.target.value)}
              />
            </div>
            <div className="editor-total">
              <span>Wadarta</span>
              <strong>
                <NumberValue value={totals.total} currency={f.currency} />
              </strong>
            </div>
          </div>
          <details className="extra-details">
            <summary>
              Faahfaahin dheeraad ah
              <ChevronDown size={20} />
            </summary>
            <Field label="Qoraal">
              <textarea
                value={f.notes}
                onChange={(e) => set("notes", e.target.value)}
              />
            </Field>
            <Field label="Shuruudaha">
              <textarea
                value={f.terms}
                onChange={(e) => set("terms", e.target.value)}
              />
            </Field>
            <Field label="Habka lacag-bixinta">
              <div className="method-options">
                {f.businessSnapshot.methods
                  .filter((m) => m.enabled)
                  .map((m) => (
                    <label key={m.name}>
                      <input
                        type="checkbox"
                        checked={f.paymentMethods.includes(m.name)}
                        onChange={(e) =>
                          set(
                            "paymentMethods",
                            e.target.checked
                              ? [...f.paymentMethods, m.name]
                              : f.paymentMethods.filter((n) => n !== m.name),
                          )
                        }
                      />
                      {m.name}
                    </label>
                  ))}
              </div>
            </Field>
          </details>
          <div className="save-bar">
            <span>Ku kaydi browser-kan</span>
            <Button type="submit" busy={busy}>
              {saved ? (
                <>
                  <Check size={20} />
                  Waa la kaydiyey
                </>
              ) : (
                "Kaydi"
              )}
            </Button>
          </div>
        </section>
        <section className="preview-panel">
          <div className="preview-label">
            <span>Horudhac</span>
            <span>A4 · {f.currency}</span>
          </div>
          <Document invoice={preview} />
        </section>
      </form>
    </>
  );
}
function Detail() {
  const notify = useToast();
  const { id } = useParams(),
    { data, reload } = useData(),
    nav = useNavigate();
  const i = data.invoices.find((i) => i.id === id);
  const displayInvoice = i ? { ...i, businessSnapshot: data.settings } : null;
  const [menu, setMenu] = useState(false),
    [modal, setModal] = useState(""),
    [error, setError] = useState(""),
    [amount, setAmount] = useState(""),
    [method, setMethod] = useState("EVC Plus"),
    [reference, setReference] = useState(""),
    [busy, setBusy] = useState(false);
  if (!i) return <p>Qaansheegga lama helin.</p>;
  const act = async (fn) => {
    setBusy(true);
    setError("");
    try {
      await fn();
      await reload();
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };
  const payment = () => {
    setAmount(((i.total - i.paid) / 100).toFixed(2));
    setModal("pay");
    setMenu(false);
  };
  return (
    <>
      <Link className="back" to="/qaansheegyo">
        <ArrowLeft size={20} />
        Qaansheegyada
      </Link>
      <Heading title={i.number}>
        <div className="detail-actions">
          <Link
            className="button secondary"
            to={"/qaansheegyo/" + id + "/wax-ka-beddel"}
          >
            <Pencil size={20} />
            Wax ka beddel
          </Link>
          <Button
            variant="secondary"
            onClick={() => act(() => downloadInvoice(displayInvoice))}
          >
            <Download size={20} />
            Soo dejiso
          </Button>
          <IconButton
            label="Daabac"
            onClick={() => act(() => printInvoice(displayInvoice))}
          >
            <Printer size={22} />
          </IconButton>
          <Button onClick={() => setModal("send")}>
            <Send size={20} />
            Dir
          </Button>
          <div className="menu-anchor">
            <IconButton
              label="Ficillo kale"
              aria-expanded={menu}
              onClick={() => setMenu(!menu)}
            >
              <MoreHorizontal size={24} />
            </IconButton>
            {menu && (
              <>
                <button
                  className="menu-dismiss"
                  aria-label="Xir menu-ga"
                  onClick={() => setMenu(false)}
                />
                <motion.div
                  className="overflow-menu"
                  initial={{ opacity: 0, y: -4, scale: 0.98 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  transition={snappy}
                >
                  <button
                    onClick={() =>
                      act(async () => {
                        const copy = await repository.saveInvoice({
                          ...i,
                          id: undefined,
                          state: "draft",
                          sample: false,
                        });
                        setMenu(false);
                        nav("/qaansheegyo/" + copy.id + "/wax-ka-beddel");
                      })
                    }
                  >
                    <Copy size={20} />
                    Nuqul samee
                  </button>
                  {i.paid < i.total && (
                    <button onClick={payment}>
                      <Check size={20} />U calaamadee “La bixiyey”
                    </button>
                  )}
                  <button
                    className="danger-text"
                    onClick={() => {
                      setMenu(false);
                      setModal("delete");
                    }}
                  >
                    <Trash2 size={20} />
                    Tirtir
                  </button>
                </motion.div>
              </>
            )}
          </div>
        </div>
      </Heading>
      <div className="detail-status">
        <Status status={i.status} />
        {i.sample && <span>Tusaale keliya</span>}
      </div>
      <ErrorBox error={error} />
      <div className="detail-layout">
        <Document invoice={displayInvoice} transitionName="invoice-focus" />
        <aside className="payment-panel">
          <h2>Lacag-bixinta</h2>
          <dl>
            <div>
              <dt>Wadarta</dt>
              <dd>{formatMoney(i.total, i.currency)}</dd>
            </div>
            <div>
              <dt>La bixiyey</dt>
              <dd>{formatMoney(i.paid, i.currency)}</dd>
            </div>
          </dl>
          <div className="balance">
            <span>Hadhaaga</span>
            <strong>
              <NumberValue value={i.total - i.paid} currency={i.currency} />
            </strong>
          </div>
          {i.paid < i.total && (
            <Button onClick={payment}>
              <Plus size={20} />
              Diiwaangeli lacag-bixin
            </Button>
          )}
          <div className="payment-history">
            {data.payments
              .filter((p) => p.invoiceId === id)
              .map((p) => (
                <div key={p.id}>
                  <span>
                    <strong>{p.method}</strong>
                    <small>
                      {dates(p.date)}
                      {p.reference ? " · " + p.reference : ""}
                    </small>
                  </span>
                  <strong>{formatMoney(p.amount, i.currency)}</strong>
                </div>
              ))}
          </div>
        </aside>
      </div>
      {modal === "pay" && (
        <Modal title="Diiwaangeli lacag-bixin" onClose={() => setModal("")}>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              act(async () => {
                await repository.pay(
                  id,
                  Math.round(Number(amount) * 100),
                  method,
                  reference,
                );
                setModal("");
                notify("Lacag-bixinta waa la diiwaangeliyey.");
              });
            }}
          >
            <ErrorBox error={error} />
            <Field
              label={"Lacagta (" + i.currency + ")"}
              type="number"
              min="0.01"
              max={(i.total - i.paid) / 100}
              step="0.01"
              required
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
            />
            <Field label="Habka lacag-bixinta">
              <select
                value={method}
                onChange={(e) => setMethod(e.target.value)}
              >
                {["EVC Plus", "ZAAD", "eDahab", "Sahal", "Bangiga", "Cash"].map(
                  (m) => (
                    <option key={m}>{m}</option>
                  ),
                )}
              </select>
            </Field>
            <Field
              label="Tixraac (ikhtiyaari)"
              value={reference}
              onChange={(e) => setReference(e.target.value)}
            />
            <Button type="submit" busy={busy}>
              Kaydi lacag-bixinta
            </Button>
          </form>
        </Modal>
      )}
      {modal === "delete" && (
        <Modal title="Tirtir qaansheegga?" onClose={() => setModal("")}>
          <p>
            {i.number} iyo lacag-bixintiisa waa la tirtirayaa. Falkan dib looma
            celin karo.
          </p>
          <ErrorBox error={error} />
          <div className="form-actions">
            <Button variant="secondary" onClick={() => setModal("")}>
              Ka noqo
            </Button>
            <Button
              variant="danger"
              busy={busy}
              onClick={() =>
                act(async () => {
                  await repository.removeInvoice(id);
                  nav("/qaansheegyo");
                })
              }
            >
              Tirtir
            </Button>
          </div>
        </Modal>
      )}
      {modal === "send" && (
        <Modal title="Dir qaansheegga" onClose={() => setModal("")}>
          <p>
            Soo dejiso PDF-ka oo u dir macmiilka. Kadib calaamadee markaad
            dirtay.
          </p>
          <ErrorBox error={error} />
          <div className="send-options">
            <Button
              variant="secondary"
              onClick={() => act(() => downloadInvoice(displayInvoice))}
            >
              <Download size={20} />
              Soo dejiso PDF
            </Button>
            {typeof navigator.share === "function" && (
              <Button
                variant="secondary"
                onClick={() =>
                  act(async () => {
                    const pdf = await invoicePdf(displayInvoice);
                    const file = new File(
                      [pdf.output("blob")],
                      i.number + ".pdf",
                      { type: "application/pdf" },
                    );
                    await navigator.share({ files: [file], title: i.number });
                  })
                }
              >
                <Send size={20} />
                La wadaag PDF
              </Button>
            )}
            <Button
              busy={busy}
              onClick={() =>
                act(async () => {
                  await repository.saveInvoice({ ...i, state: "sent" });
                  setModal("");
                  notify("La diray ayaa loo calaamadeeyey.");
                })
              }
            >
              <Check size={20} />U calaamadee “La diray”
            </Button>
          </div>
        </Modal>
      )}
    </>
  );
}
function SettingsPage() {
  const notify = useToast();
  const { data, reload } = useData();
  const [f, setF] = useState(structuredClone(data.settings)),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [saved, setSaved] = useState(false);
  const set = (key, value) => {
    setF((f) => ({ ...f, [key]: value }));
    setSaved(false);
  };
  return (
    <>
      <Heading title="Dejinta" description="Ganacsigaaga. Qaansheeggaaga." />
      <div className="mobile-profile">
        <Profile settings={data.settings} />
      </div>
      <form
        className="settings-form"
        onSubmit={async (e) => {
          e.preventDefault();
          setBusy(true);
          setError("");
          try {
            await repository.put("settings", f);
            await reload();
            notify("Dejinta waa la kaydiyey.");
            setSaved(true);
            setTimeout(() => setSaved(false), 2500);
          } catch (e) {
            setError(e.message);
          } finally {
            setBusy(false);
          }
        }}
      >
        <ErrorBox error={error} />
        <section>
          <div>
            <h2>Ganacsiga</h2>
            <p>Xogta ka muuqata qaansheegga.</p>
          </div>
          <div>
            {[
              ["name", "Magaca ganacsiga"],
              ["phone", "Telefoon"],
              ["email", "Email"],
              ["address", "Cinwaan"],
            ].map(([key, label]) => (
              <Field
                key={key}
                label={label}
                required={key === "name"}
                type={key === "email" ? "email" : "text"}
                value={f[key]}
                onChange={(e) => set(key, e.target.value)}
              />
            ))}
          </div>
        </section>
        <section>
          <div>
            <h2>Qaansheegga</h2>
            <p>Doorashooyinka qaansheeg cusub.</p>
          </div>
          <div className="two-fields">
            <Field
              label="Prefix"
              required
              maxLength={10}
              pattern="[A-Za-z0-9]+"
              value={f.prefix}
              onChange={(e) => set("prefix", e.target.value)}
            />
            <Field label="Lacagta">
              <select
                value={f.currency}
                onChange={(e) => set("currency", e.target.value)}
              >
                <option>USD</option>
                <option>SOS</option>
              </select>
            </Field>
            <Field
              label="Canshuurta caadiga ah (%)"
              type="number"
              min="0"
              max="100"
              step="0.01"
              required
              value={f.tax}
              onChange={(e) => set("tax", Number(e.target.value))}
            />
            <Field
              label="Muddada bixinta (maalmood)"
              type="number"
              min="0"
              max="365"
              required
              value={f.dueDays}
              onChange={(e) => set("dueDays", Number(e.target.value))}
            />
          </div>
        </section>
        <section>
          <div>
            <h2>Lacag-bixinta</h2>
            <p>Lambarro bandhig ah. Ha gelin furayaal sir ah.</p>
          </div>
          <div>
            {f.methods.map((m, n) => (
              <div className="method-setting" key={m.name}>
                <label className="switch-label">
                  <span>{m.name}</span>
                  <input
                    type="checkbox"
                    role="switch"
                    checked={m.enabled}
                    onChange={(e) =>
                      set(
                        "methods",
                        f.methods.map((x, k) =>
                          k === n ? { ...x, enabled: e.target.checked } : x,
                        ),
                      )
                    }
                  />
                </label>
                {m.enabled && (
                  <Field
                    label={"Lambarka / akoonka " + m.name}
                    value={m.details}
                    onChange={(e) =>
                      set(
                        "methods",
                        f.methods.map((x, k) =>
                          k === n ? { ...x, details: e.target.value } : x,
                        ),
                      )
                    }
                  />
                )}
              </div>
            ))}
          </div>
        </section>
        <section>
          <div>
            <h2>Muuqaalka qaansheegga</h2>
            <p>Faahfaahinta ganacsigaaga.</p>
          </div>
          <div>
            <Field
              label="Logo (PNG / JPG, ugu badnaan 2 MB)"
              type="file"
              accept="image/png,image/jpeg,image/webp"
              onChange={async (e) => {
                const file = e.target.files[0];
                if (!file) return;
                try {
                  set("logo", await optimizeLogo(file));
                } catch (error) {
                  setError(error.message);
                }
              }}
            />
            {f.logo && (
              <div className="logo-preview">
                <img src={f.logo} alt="Logo" />
                <Button variant="secondary" onClick={() => set("logo", "")}>
                  Ka saar logo
                </Button>
              </div>
            )}
            <Field
              label="Midabka qaansheegga"
              type="color"
              value={f.accent}
              onChange={(e) => set("accent", e.target.value)}
            />
            <Field
              label="Qoraalka hoose"
              value={f.footer}
              onChange={(e) => set("footer", e.target.value)}
            />
            <Field
              label="Saxiixa"
              value={f.signature}
              onChange={(e) => set("signature", e.target.value)}
            />
          </div>
        </section>
        <div className="settings-save">
          <Button type="submit" busy={busy}>
            {saved ? (
              <>
                <Check size={20} />
                Waa la kaydiyey
              </>
            ) : (
              "Kaydi"
            )}
          </Button>
        </div>
      </form>
    </>
  );
}
function Shell() {
  const mainRef = React.useRef();
  const loc = useLocation(),
    { data } = useData();
  useEffect(() => {
    window.scrollTo(0, 0);
    mainRef.current?.scrollTo(0, 0);
    document.title = "Qaansheegyada | Digital Invoice";
  }, [loc.pathname]);
  const showCreate =
    !loc.pathname.includes("cusub") && !loc.pathname.includes("wax-ka-beddel");
  const navs = [
    ["/qaansheegyo", "Qaansheegyada", FileText],
    ["/macaamiisha", "Macaamiisha", Users],
    ["/dejinta", "Dejinta", Settings],
  ];
  return (
    <div className={"app" + (showCreate ? " has-create-action" : "")}>
      <CommandPalette />
      <aside className="sidebar">
        <Link to="/qaansheegyo" className="brand-link">
          <Brand />
        </Link>
        <nav>
          {navs.slice(0, 2).map(([path, label, Icon]) => (
            <NavLink key={path} to={path} className="nav-item">
              {({ isActive }) => (
                <>
                  {isActive && (
                    <motion.span
                      className="active-pill"
                      layoutId="nav-active"
                      transition={snappy}
                    />
                  )}
                  <Icon size={22} />
                  <span>{label}</span>
                </>
              )}
            </NavLink>
          ))}
        </nav>
        <CreateLink />
        <div className="sidebar-bottom">
          <NavLink className="nav-item" to="/dejinta">
            {({ isActive }) => (
              <>
                {isActive && (
                  <motion.span
                    className="active-pill"
                    layoutId="nav-active"
                    transition={snappy}
                  />
                )}
                <Settings size={22} />
                <span>Dejinta</span>
              </>
            )}
          </NavLink>
          <Profile settings={data.settings} />
        </div>
      </aside>
      <div className="mobile-brand">
        <Brand />
      </div>
      <main ref={mainRef}>
        <motion.div
          key={loc.pathname}
          initial={{ opacity: 0, y: 4 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.2 }}
        >
          <Routes>
            <Route path="/qaansheegyo" element={<Invoices />} />
            <Route path="/qaansheegyo/cusub" element={<Editor />} />
            <Route path="/qaansheegyo/:id/wax-ka-beddel" element={<Editor />} />
            <Route path="/qaansheegyo/:id" element={<Detail />} />
            <Route path="/macaamiisha" element={<Customers />} />
            <Route path="/macaamiisha/:id" element={<CustomerDetail />} />
            <Route path="/dejinta" element={<SettingsPage />} />
            <Route path="*" element={<Navigate to="/qaansheegyo" replace />} />
          </Routes>
        </motion.div>
      </main>
      <nav className="bottom-nav">
        {navs.map(([path, label, Icon]) => (
          <NavLink key={path} to={path}>
            {({ isActive }) => (
              <>
                {isActive && (
                  <motion.i
                    className="bottom-active"
                    layoutId="mobile-nav-active"
                    transition={snappy}
                  />
                )}
                <Icon size={22} />
                <span>
                  {label === "Qaansheegyada"
                    ? "Qaansheegyo"
                    : label === "Macaamiisha"
                      ? "Macaamiil"
                      : label}
                </span>
              </>
            )}
          </NavLink>
        ))}
      </nav>
      {showCreate && <FloatingCreate scrollRef={mainRef} />}
    </div>
  );
}
function App() {
  const [data, setData] = useState(null),
    [error, setError] = useState("");
  const reload = async () => {
    const d = await repository.all();
    setData(d);
  };
  useEffect(() => {
    repository
      .init()
      .then(reload)
      .catch((e) =>
        setError("Kaydka browser-ka lama furi karin: " + e.message),
      );
  }, []);
  useEffect(() => {
    const update = () => reload().catch((e) => setError(e.message));
    const unsubscribe = repository.subscribe(update);
    window.addEventListener("focus", update);
    return () => {
      unsubscribe();
      window.removeEventListener("focus", update);
    };
  }, []);
  return (
    <MotionConfig reducedMotion="user">
      <BrowserRouter>
        <AuthProvider>
          <ToastProvider>
            <AuthGate>
              {error ? (
                <div className="boot">
                  <ErrorBox error={error} />
                </div>
              ) : data ? (
                <Context value={{ data, reload }}>
                  <Shell />
                </Context>
              ) : (
                <div className="boot">
                  <Brand />
                  <p>Waa la soo rarayaa…</p>
                  <div className="skeleton-list" aria-hidden="true">
                    {[1, 2, 3].map((n) => (
                      <div key={n} />
                    ))}
                  </div>
                </div>
              )}
            </AuthGate>
          </ToastProvider>
        </AuthProvider>
      </BrowserRouter>
    </MotionConfig>
  );
}
createRoot(document.getElementById("root")).render(<App />);
