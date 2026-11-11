import { useEffect, useState } from "react";
import { expenseCurrencies, type Expense, type ExpenseCurrency, type ExpensesResponse } from "@travel-book/contracts";
import { Icon, type IconName } from "../../components/Icon";
import { ApiClientError } from "../../shared/api/apiClient";
import { ExpenseDialog, readExpenseDraft } from "./ExpenseDialog";
import type { ExpensesRepository } from "./expensesRepository";

const currencyNames = { TWD: "台幣", EUR: "歐元", HUF: "匈牙利幣" };
const categoryStyle = {
  食物: ["food", "food"],
  交通: ["train", "transit"],
  景點: ["sight", "sight"],
  逛街: ["shop", "shopping"],
  超市: ["market", "market"],
  機票: ["plane", "flight"],
} as const satisfies Record<Expense["category"], readonly [IconName, string]>;

const wholeNumber = new Intl.NumberFormat("zh-TW");
const dateLabel = new Intl.DateTimeFormat("zh-TW", { month: "long", day: "numeric", weekday: "short", timeZone: "UTC" });

function money(currency: ExpenseCurrency, minor: bigint) {
  const digits = String(minor % 100n).padStart(2, "0");
  const fraction = currency === "EUR" ? digits : digits.replace(/0+$/, "");
  return `${currency} ${wholeNumber.format(minor / 100n)}${fraction ? `.${fraction}` : ""}`;
}

function groupExpenses(expenses: Expense[]) {
  const groups = new Map<string, Expense[]>();
  for (const expense of expenses) {
    const group = groups.get(expense.date);
    if (group) group.push(expense);
    else groups.set(expense.date, [expense]);
  }
  return [...groups].sort(([a], [b]) => b.localeCompare(a));
}

function ExpenseGroup({ date, expenses, onEdit }: { date: string; expenses: Expense[]; onEdit(expense: Expense): void }) {
  const [expanded, setExpanded] = useState(true);
  const hasReference = expenses.some((expense) => expense.referenceTwdMinor !== null);
  const subtotal = expenses.reduce((sum, expense) => sum + BigInt(expense.referenceTwdMinor ?? 0), 0n);
  const groupId = `expenses-${date}`;
  return <section className="expense-group">
    <button className="expense-group-head" type="button" aria-expanded={expanded} aria-controls={groupId}
      onClick={() => setExpanded(!expanded)}>
      <span><strong>{dateLabel.format(new Date(date))}</strong>
        <small>{expenses.length} 筆・{hasReference ? `約 ${money("TWD", subtotal)}` : "TWD －"}</small></span>
      <span className={`group-chevron${expanded ? "" : " is-collapsed"}`}><Icon name="chevron" size={18} /></span>
    </button>
    <div id={groupId} hidden={!expanded}>
      <div className="expense-group-items">
        {expenses.map((expense) => {
          const [icon, color] = categoryStyle[expense.category];
          return <button className="expense-row" type="button" key={expense.id} aria-label={`編輯${expense.title}`} onClick={() => onEdit(expense)}>
            <span className={`expense-icon category-${color}`}><Icon name={icon} size={18} /></span>
            <span className="expense-copy"><span>{expense.category}</span><strong>{expense.title}</strong></span>
            <span className="expense-amount">
              <strong>{money(expense.currency, BigInt(expense.amountMinor))}</strong>
              <span>{expense.referenceTwdMinor === null ? "約 TWD －" : `約 ${money("TWD", BigInt(expense.referenceTwdMinor))}`}</span>
            </span>
            <span className="expense-edit-cue" aria-hidden="true"><Icon name="chevron" size={17} /></span>
          </button>;
        })}
      </div>
    </div>
  </section>;
}

type ExpenseState =
  | { kind: "loading" }
  | { kind: "error"; message: string }
  | { kind: "ready"; data: ExpensesResponse };

export function ExpensesPage({ repository, online, startDate, endDate }: { repository: ExpensesRepository; online: boolean; startDate: string; endDate: string }) {
  const [state, setState] = useState<ExpenseState>({ kind: "loading" });
  const [attempt, setAttempt] = useState(0);
  const [editing, setEditing] = useState<{ expense: Expense | null } | null>(() => {
    const draft = readExpenseDraft(repository);
    return draft ? { expense: draft.expense } : null;
  });
  const [notice, setNotice] = useState("");
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    if (!notice) return;
    const timeout = setTimeout(() => setNotice(""), 3000);
    return () => clearTimeout(timeout);
  }, [notice]);

  useEffect(() => {
    if (!online) return;
    let active = true;
    setRefreshing(true);
    repository.getExpenses().then((data) => {
      if (active) setState({ kind: "ready", data });
    }).catch((error: unknown) => {
      if (!active) return;
      setState({ kind: "error", message: error instanceof ApiClientError && error.code === "ACCESS_DENIED"
        ? "私人連結已失效。請向家人取得新的私人連結。" : "目前無法讀取支出資料。" });
    }).finally(() => { if (active) setRefreshing(false); });
    return () => { active = false; };
  }, [attempt, online, repository]);

  return <main id="main" className="screen">
    <header className="page-heading"><div><p className="eyebrow">Expenses</p><h1>記帳</h1></div>
      {online && state.kind === "ready" && <button className="primary-button" type="button" aria-label="新增支出"
        onClick={() => setEditing({ expense: null })}><Icon name="plus" size={18} /><span>新增支出</span></button>}</header>
    {notice && <div className="toast-region" role="status"><div className="toast">{notice}</div></div>}
    {!online ? <section className="card section-card" role="status">離線時無法載入支出，請連線後再試。</section>
      : state.kind === "loading" ? <p className="loading-state" role="status">正在讀取支出…</p>
      : state.kind === "error" ? <section className="card section-card">
        <p role="alert">{state.message}</p>
        <button className="secondary-button" type="button" onClick={() => {
          setState({ kind: "loading" });
          setAttempt((value) => value + 1);
        }}>重新載入</button>
      </section>
      : <ExpenseOverview data={state.data} onEdit={(expense) => setEditing({ expense })} />}
    {editing && <ExpenseDialog expense={editing.expense} repository={repository} online={online && !refreshing}
      startDate={startDate} endDate={endDate}
      onClose={() => { setEditing(null); if (online) setAttempt((value) => value + 1); }}
      onData={(data) => setState({ kind: "ready", data })}
      onSaved={(data, message) => { setState({ kind: "ready", data }); setEditing(null); setNotice(message); }} />}
  </main>;
}

function ExpenseOverview({ data, onEdit }: { data: ExpensesResponse; onEdit(expense: Expense): void }) {
  const rates = new Map(data.rates.map((rate) => [rate.baseCurrency, rate]));
  return <>
    <section className="card section-card" aria-labelledby="currency-title">
      <div className="section-head"><div><h2 id="currency-title">各幣別總覽</h2>
        <p>{rates.size ? "已保存的參考匯率" : "目前無外幣匯率快照"}</p></div><Icon name="exchange" size={22} /></div>
      <div className="currency-grid">
        {expenseCurrencies.map((currency) => {
          const rate = currency === "TWD" ? undefined : rates.get(currency);
          return <article key={currency} className={currency === "TWD" ? "currency-card active" : "currency-card"}>
            <span className="currency-code">{currency}<span>{currencyNames[currency]}</span></span>
            <strong>{money(currency, BigInt(data.totalsMinor[currency]))}</strong>
            <small>{currency === "TWD" ? "基準幣別" : rate ? `1 ${currency} ≈ ${rate.rate} TWD` : "匯率 －"}</small>
            {rate && <small><time dateTime={rate.sourceDate}>{rate.sourceDate}</time></small>}
          </article>;
        })}
      </div>
      <p className="rate-note"><Icon name="info" size={15} />台幣參考金額以各筆保存的匯率換算。無匯率時顯示「－」。</p>
    </section>
    <section className="card section-card" aria-labelledby="expense-title">
      <div className="section-head"><div><h2 id="expense-title">支出明細</h2><p>{data.expenses.length} 筆紀錄・依日期整理</p></div></div>
      <div className="expense-list">
        {data.expenses.length ? groupExpenses(data.expenses).map(([date, expenses]) =>
          <ExpenseGroup key={date} date={date} expenses={expenses} onEdit={onEdit} />) : <p className="empty-state">還沒有支出。</p>}
      </div>
    </section>
  </>;
}
