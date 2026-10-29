import { h } from "../js/shared.js";
import { state } from "./state.js";
import { toast, describeError, confirmDialog, withBusy, fmtDate } from "./ui.js";

// Spreadsheet formula injection guard: neutralise cells that would be evaluated as formulas.
const csvCell = (v) => {
  let s = String(v ?? "");
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  return `"${s.replaceAll('"', '""')}"`;
};

export async function signupsView(root) {
  root.replaceChildren(h("p", { class: "hint", role: "status" }, "Loading sign-ups…"));
  let rows;
  try { rows = await state.backend.listSignups(); } catch (e) { root.replaceChildren(h("p", { class: "error" }, describeError(e))); return; }
  const unique = new Set(rows.map((r) => r.email)).size;

  const exportCsv = () => {
    const seen = new Set();
    const lines = [["email", "signed_up_at", "consent_given", "consent_text", "source"].map(csvCell).join(",")];
    for (const r of [...rows].reverse()) {           // oldest first, one line per address
      if (seen.has(r.email)) continue; seen.add(r.email);
      lines.push([r.email, r.createdAt, r.consent ? "yes" : "no", r.consentText, r.source].map(csvCell).join(","));
    }
    const url = URL.createObjectURL(new Blob(["\ufeff" + lines.join("\r\n")], { type: "text/csv;charset=utf-8" }));
    const a = h("a", { href: url, download: `signups-${new Date().toISOString().slice(0, 10)}.csv` });
    document.body.append(a); a.click(); a.remove(); URL.revokeObjectURL(url);
  };

  root.replaceChildren(
    h("div", { class: "page-head" }, h("div", {}, h("h1", {}, "Sign-ups"),
      h("p", { class: "hint" }, `${unique} unique address${unique === 1 ? "" : "es"} · ${rows.length} submission${rows.length === 1 ? "" : "s"}`)),
      h("button", { type: "button", class: "btn btn--primary", disabled: !rows.length, onclick: exportCsv }, "Export CSV")),
    h("div", { class: "notice" }, h("p", {}, "Addresses submitted through the Join form are stored in this Firebase project (Firestore collection “signups”). No email is sent from this site — to send newsletters, export the list or connect an email provider. Handle this personal data according to the privacy rules that apply to you.")),
    rows.length ? h("div", { class: "table-wrap" }, h("table", { class: "table" },
      h("thead", {}, h("tr", {}, ["Email", "Date", "Consent", ""].map((t) => h("th", { scope: "col" }, t)))),
      h("tbody", {}, rows.map((r) => h("tr", {},
        h("td", {}, r.email), h("td", {}, fmtDate(r.createdAt)), h("td", {}, r.consent ? "Given" : "—"),
        h("td", {}, h("button", { type: "button", class: "btn btn--sm btn--danger-text", "aria-label": `Delete ${r.email}`, onclick: async (e) => {
          if (!(await confirmDialog({ title: "Delete this sign-up?", message: `${r.email} will be removed permanently.`, confirmLabel: "Delete sign-up" }))) return;
          try { await withBusy(e.target, () => state.backend.deleteSignup(r.id)); toast("Sign-up deleted."); await signupsView(root); } catch (err) { toast(describeError(err), "error"); }
        } }, "Delete"))))))) : h("p", { class: "empty" }, "No sign-ups yet."));
}
