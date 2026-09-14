import React from "react";
import { motion, AnimatePresence } from "motion/react";
import { Brand, NumberValue } from "./ui";
import { calculate, formatMoney, dateLabel } from "../shared/finance";
function BusinessMark({ business }) {
  const [failed, setFailed] = React.useState(false);
  const initials = (business.name || "Q")
    .split(" ")
    .slice(0, 2)
    .map((x) => x[0])
    .join("");
  if (!business.logo || failed)
    return <span className="business-monogram">{initials}</span>;
  return (
    <img
      src={business.logo}
      className="business-logo"
      alt={business.name}
      onError={() => setFailed(true)}
    />
  );
}
export default function Document({ invoice, compact = false, transitionName }) {
  const b = invoice.businessSnapshot || {},
    c = invoice.customerSnapshot || {};
  let totals;
  try {
    totals = calculate(invoice);
  } catch {
    totals = { lines: [], subtotal: 0, discount: 0, tax: 0, total: 0 };
  }
  const currency = invoice.currency || "USD",
    paid = invoice.paid || 0;
  return (
    <article
      className={`invoice-paper ${compact ? "mini-paper" : ""} ${b.style === "minimal" ? "minimal-paper" : ""}`}
      style={{
        "--document-accent": b.accent || "#086b8a",
        viewTransitionName: transitionName,
      }}
      aria-label="Hordhaca qaansheegga"
    >
      <div className="paper-top">
        <div className="paper-business">
          <BusinessMark business={b} />
          <div>
            <strong>{b.name || "Magaca ganacsiga"}</strong>
            <small>{[b.city, b.country].filter(Boolean).join(" · ")}</small>
          </div>
        </div>
        <div className="paper-type">
          QAANSHEEG
          <span>{invoice.number || "Qabyo"}</span>
        </div>
      </div>
      <div className="paper-address">
        {[b.address, b.phone, b.email, b.website].filter(Boolean).join(" · ")}
      </div>
      <div className="paper-billing">
        <div>
          <small>Ku socota</small>
          <motion.h3
            key={c.name}
            initial={{ opacity: 0.5, y: 2 }}
            animate={{ opacity: 1, y: 0 }}
          >
            {c.name || "Dooro macmiil"}
          </motion.h3>
          <p>
            {[c.contact, c.address, c.city, c.phone, c.email]
              .filter(Boolean)
              .map((v, n) => (
                <React.Fragment key={n}>
                  {v}
                  <br />
                </React.Fragment>
              ))}
          </p>
        </div>
        <dl>
          <div>
            <dt>Taariikh</dt>
            <dd>{dateLabel(invoice.issue)}</dd>
          </div>
          <div>
            <dt>Taariikhda bixinta</dt>
            <dd>{dateLabel(invoice.due)}</dd>
          </div>
          <div>
            <dt>Lacagta</dt>
            <dd>{currency}</dd>
          </div>
        </dl>
      </div>
      <table className="paper-table">
        <thead>
          <tr>
            <th>Sharaxaad</th>
            <th>Tirada</th>
            <th>Qiimaha</th>
            <th>Wadarta</th>
          </tr>
        </thead>
        <tbody>
          <AnimatePresence initial={false}>
            {invoice.items.map((item, n) => (
              <motion.tr
                layout
                key={item.id}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
              >
                <td>{item.description || "Sharaxaadda shayga"}</td>
                <td>{item.quantity}</td>
                <td>
                  {formatMoney(
                    Math.round(Number(item.price || 0) * 100),
                    currency,
                  )}
                </td>
                <td>{formatMoney(totals.lines[n] || 0, currency)}</td>
              </motion.tr>
            ))}
          </AnimatePresence>
        </tbody>
      </table>
      <div className="paper-totals">
        {[
          ["Wadarta Hoose", totals.subtotal],
          ["Dhimis", -totals.discount],
          ["Canshuur", totals.tax],
          ["Wadarta Guud", totals.total],
          ["La bixiyey", paid],
          ["Hadhaaga", totals.total - paid],
        ].map(([label, n], i) => (
          <div
            className={i === 5 ? "paper-balance" : i === 3 ? "paper-grand" : ""}
            key={label}
          >
            <span>{label}</span>
            <motion.strong
              initial={{ opacity: 0.45, y: 2 }}
              animate={{ opacity: 1, y: 0 }}
            >
              <NumberValue value={n} currency={currency} />
            </motion.strong>
          </div>
        ))}
      </div>
      <div className="paper-bottom">
        {b.methods?.some(
          (m) => m.enabled && invoice.paymentMethods?.includes(m.name),
        ) && (
          <div className="paper-block">
            <small>Habka lacag-bixinta</small>
            {b.methods
              .filter(
                (m) => m.enabled && invoice.paymentMethods?.includes(m.name),
              )
              .map((m) => (
                <p key={m.name}>
                  <strong>
                    {m.name === "Cash"
                      ? "Lacag caddaan ah"
                      : m.name === "Bank Transfer"
                        ? "Xawaalad bangi"
                        : m.name}
                  </strong>{" "}
                  · {m.details}
                </p>
              ))}
          </div>
        )}
        {invoice.notes && (
          <div className="paper-block">
            <small>Qoraal</small>
            <p>{invoice.notes}</p>
          </div>
        )}
        {invoice.terms && (
          <div className="paper-block">
            <small>Shuruudaha</small>
            <p>{invoice.terms}</p>
          </div>
        )}
        {invoice.signature && (
          <div className="paper-signature">
            {invoice.signature}
            <small>Saxiixa</small>
          </div>
        )}
        {(b.registration || b.taxNumber) && (
          <p className="paper-registration">
            {b.registration && `Diiwaangelinta: ${b.registration}`}{" "}
            {b.taxNumber && `Canshuurta: ${b.taxNumber}`}
          </p>
        )}
      </div>
      <div className="paper-footer">
        <span>{b.footer || ""}</span>
        <Brand />
      </div>
      {invoice.sample && (
        <div className="paper-sample">
          TUSAALE KELIYA · Xiriir ganacsi lama sheeganayo
        </div>
      )}
    </article>
  );
}
