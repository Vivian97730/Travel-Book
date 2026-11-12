import { useEffect, useRef, useState, type FormEvent } from "react";
import {
  convertExpenseToTwdMinor, expenseCategories, expenseCurrencies, parseExpenseAmountMinor, parseExpenseInput,
  type Expense, type ExpenseMutation, type ExpensesResponse,
} from "@travel-book/contracts";
import { Icon } from "../../components/Icon";
import { ApiClientError } from "../../shared/api/apiClient";
import type { ExpensesRepository } from "./expensesRepository";

type Pending = { mutation: ExpenseMutation; key: string };
type Failure = "retry" | "conflict" | "invalid" | "gone" | "denied" | "reload";

interface ExpenseDraft {
  expense: Expense | null;
  current: Expense | null;
  date: string;
  title: string;
  category: string;
  currency: string;
  amount: string;
  pending: Pending | null;
  failure: Failure | null;
  reviewLatest: boolean;
}

// Access is reverified after reconnect, which may temporarily unmount the page.
const drafts = new WeakMap<ExpensesRepository, ExpenseDraft>();
export function readExpenseDraft(repository: ExpensesRepository) { return drafts.get(repository); }

const currencyNames = { TWD: "台幣", EUR: "歐元", HUF: "匈牙利幣" };

function decimalAmount(minor: number) {
  const digits = BigInt(minor);
  return `${digits / 100n}.${String(digits % 100n).padStart(2, "0")}`;
}

const localDate = new Intl.DateTimeFormat("sv-SE", { year: "numeric", month: "2-digit", day: "2-digit" });

export function ExpenseDialog({ expense, repository, online, onClose, onData, onSaved }: {
  expense: Expense | null;
  repository: ExpensesRepository;
  online: boolean;
  onClose(): void;
  onData(data: ExpensesResponse): void;
  onSaved(data: ExpensesResponse, message: string): void;
}) {
  const [restored] = useState(() => readExpenseDraft(repository));
  const [current, setCurrent] = useState(restored ? restored.current : expense);
  const [date, setDate] = useState(() => restored?.date ?? expense?.date ?? localDate.format(new Date()));
  const [title, setTitle] = useState(restored?.title ?? (expense?.title ?? ""));
  const [category, setCategory] = useState<string>(restored?.category ?? (expense?.category ?? expenseCategories[0]));
  const [currency, setCurrency] = useState<string>(restored?.currency ?? (expense?.currency ?? "TWD"));
  const [amount, setAmount] = useState(restored?.amount ?? (expense ? decimalAmount(expense.amountMinor) : ""));
  const [reviewLatest, setReviewLatest] = useState(restored?.reviewLatest ?? false);
  const [rate, setRate] = useState<{ key: string; value: string | null }>();
  const [pending, setPending] = useState<Pending | null>(restored?.pending ?? null);
  const [failure, setFailure] = useState<Failure | null>(restored?.failure ?? (restored?.pending ? "retry" : null));
  const [busy, setBusy] = useState(false);
  const inFlight = useRef(false);
  const dialog = useRef<HTMLDialogElement>(null);
  const initialFocus = useRef<HTMLInputElement>(null);
  const rateKey = `${currency}:${date}`;
  const usesOriginalRate = current !== null && current.date === date && current.currency === currency;

  useEffect(() => {
    drafts.set(repository, { expense, current, date, title, category, currency, amount, pending, failure, reviewLatest });
  }, [amount, category, currency, current, date, expense, failure, pending, repository, reviewLatest, title]);

  function close() {
    drafts.delete(repository);
    onClose();
  }

  useEffect(() => {
    const element = dialog.current;
    const trigger = document.activeElement;
    element?.showModal();
    initialFocus.current?.focus({ preventScroll: true });
    return () => {
      element?.close();
      if (trigger instanceof HTMLElement && trigger.isConnected) trigger.focus();
    };
  }, []);

  useEffect(() => {
    if (!online || usesOriginalRate || (currency !== "EUR" && currency !== "HUF")
      || !date) return;
    let active = true;
    const settle = (value: string | null) => { if (active) setRate({ key: rateKey, value }); };
    repository.getRate(currency, date).then(settle, () => settle(null));
    return () => { active = false; };
  }, [currency, date, online, rateKey, repository, usesOriginalRate]);

  const amountMinor = parseExpenseAmountMinor(amount);
  const previewRate = currency === "TWD" ? "1" : usesOriginalRate ? current.snapshotRate
    : rate?.key === rateKey ? rate.value : null;
  const reference = usesOriginalRate && amountMinor === current.amountMinor ? current.referenceTwdMinor
    : amountMinor !== null && previewRate ? convertExpenseToTwdMinor(amountMinor, previewRate) : null;
  const canSubmit = online && !busy && failure !== "conflict" && failure !== "reload" && failure !== "gone" && failure !== "denied";

  async function save(operation: Pending) {
    if (!canSubmit || inFlight.current) return;
    inFlight.current = true;
    setPending(operation);
    setBusy(true);
    setFailure(null);
    try {
      const data = await repository.mutateExpense(operation.mutation, operation.key);
      const cached = drafts.get(repository);
      if (cached?.pending?.key === operation.key || dialog.current) drafts.delete(repository);
      onSaved(data, operation.mutation.action === "delete" ? "已刪除支出" : "已儲存支出");
    } catch (error) {
      const code = error instanceof ApiClientError ? error.code : null;
      if (code === "VERSION_CONFLICT" || code === "VALIDATION_FAILED" || code === "RESOURCE_NOT_FOUND" || code === "ACCESS_DENIED") {
        setPending(null);
        setFailure(code === "VERSION_CONFLICT" ? "conflict" : code === "RESOURCE_NOT_FOUND" ? "gone"
          : code === "ACCESS_DENIED" ? "denied" : "invalid");
      } else setFailure("retry");
    } finally {
      inFlight.current = false;
      setBusy(false);
    }
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) { void save(pending); return; }
    const parsed = parseExpenseInput({ date, title, category, currency, amountMinor });
    if (!parsed.ok) { setFailure("invalid"); return; }
    const mutation: ExpenseMutation = current
      ? { action: "update", id: current.id, input: parsed.value, expectedVersion: current.version }
      : { action: "create", id: null, input: parsed.value, expectedVersion: 0 };
    void save({ mutation, key: crypto.randomUUID() });
  }

  async function reload() {
    if (!online || !current || inFlight.current) return;
    inFlight.current = true;
    setBusy(true);
    try {
      const data = await repository.getExpenses();
      const latest = data.expenses.find((item) => item.id === current.id);
      onData(data);
      if (latest) { setCurrent(latest); setFailure(null); setReviewLatest(true); }
      else setFailure("gone");
    } catch (error) {
      setFailure(error instanceof ApiClientError && error.code === "ACCESS_DENIED" ? "denied" : "reload");
    } finally {
      inFlight.current = false;
      setBusy(false);
    }
  }

  const messages: Record<Failure, string> = {
    retry: "尚未確認儲存結果。表單已保留，請重試同一筆操作。",
    conflict: "這筆支出已由其他裝置修改。請載入最新版本，再確認是否送出草稿。",
    invalid: "請確認日期、名稱與金額是否有效。",
    gone: "這筆支出已不存在。請關閉表單後重新載入。",
    denied: "私人連結已失效。請向家人取得新的私人連結。",
    reload: "無法載入最新版本。表單已保留，請再試一次。",
  };

  return <dialog ref={dialog} className="dialog" aria-labelledby="expense-dialog-title"
    onCancel={(event) => { event.preventDefault(); if (!busy) close(); }}>
    <form className="dialog-form" onSubmit={submit}>
      <header className="dialog-head"><h2 id="expense-dialog-title">{expense ? "修改支出" : "新增支出"}</h2>
        <button className="icon-button" type="button" aria-label="關閉" disabled={busy} onClick={close}><Icon name="close" size={20} /></button></header>
      <div className="field-group"><label htmlFor="expense-date">日期</label>
        <input ref={expense ? undefined : initialFocus} className="field" id="expense-date" type="date"
          value={date} onChange={(event) => setDate(event.target.value)} disabled={!!pending} required /></div>
      <div className="field-group"><label htmlFor="expense-name">名稱</label>
        <input ref={expense ? initialFocus : undefined} className="field" id="expense-name" placeholder="例如：午餐" maxLength={50}
          value={title} onChange={(event) => setTitle(event.target.value)} disabled={!!pending} required /></div>
      <div className="field-group"><label htmlFor="expense-category">類別</label>
        <select className="field" id="expense-category" value={category} disabled={!!pending}
          onChange={(event) => setCategory(event.target.value)}>{expenseCategories.map((item) => <option key={item}>{item}</option>)}</select></div>
      <div className="field-group"><label htmlFor="expense-currency">幣別</label>
        <select className="field" id="expense-currency" value={currency} disabled={!!pending}
          onChange={(event) => setCurrency(event.target.value)}>{expenseCurrencies.map((item) => <option key={item} value={item}>{currencyNames[item]} {item}</option>)}</select></div>
      <div className="field-group"><label htmlFor="expense-amount">金額</label>
        <input className="field" id="expense-amount" type="number" inputMode="decimal" min="0.01" step="0.01"
          value={amount} onChange={(event) => setAmount(event.target.value)} disabled={!!pending} required />
        <small role="status">台幣試算：{reference === null ? "－" : `TWD ${decimalAmount(reference)}`}</small></div>
      {!online && <p role="status">目前離線，表單已保留；請連線後再試。</p>}
      {reviewLatest && current && <p role="status">最新版本：{current.date}・{current.title}・{current.category}・{current.currency} {decimalAmount(current.amountMinor)}。表單仍保留你的草稿。</p>}
      {failure && <p role="alert">{messages[failure]}</p>}
      <div className="dialog-actions">
        {current && !pending && <button className="danger-button delete-expense-button" type="button" disabled={!canSubmit}
          onClick={() => void save({ key: crypto.randomUUID(), mutation: { action: "delete", id: current.id, input: null, expectedVersion: current.version } })}><Icon name="trash" size={17} />刪除支出</button>}
        <button className="secondary-button" type="button" disabled={busy} onClick={close}>取消</button>
        {failure === "conflict" || failure === "reload"
          ? <button className="primary-button" type="button" disabled={!online || busy} onClick={() => void reload()}>載入最新版本</button>
          : <button className="primary-button" type="submit" disabled={!canSubmit}>{busy ? "處理中…" : pending ? "重試" : expense ? "儲存修改" : "新增"}</button>}
      </div>
    </form>
  </dialog>;
}
