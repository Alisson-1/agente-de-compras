/**
 * Localiza — componentes React (port em ES module do bundle do design system).
 * Estilos em ./components.css; tokens em ./tokens.css. Importe os dois uma vez no app:
 *   import "./design-system/localiza/tokens.css";
 *   import "./design-system/localiza/components.css";
 * Guia de uso de cada componente: ./components/<Nome>.md
 */
import * as React from "react";

function cx(...parts: Array<string | false | null | undefined>) {
  return parts.filter(Boolean).join(" ");
}

/* ---------- Button ---------- */
export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  /** primary = verde de ação; secondary = lima (CTA de ênfase); outline = contorno verde profundo; ghost = só texto; inverse = sobre o verde profundo */
  variant?: "primary" | "secondary" | "outline" | "ghost" | "inverse";
  /** sm 40px · md 48px · lg 56px */
  size?: "sm" | "md" | "lg";
  block?: boolean;
  /** URL de um ícone à esquerda do rótulo */
  icon?: string;
  /** Renderiza como <a> */
  href?: string;
}
export function Button({ variant = "primary", size = "md", block, icon, href, className, children, ...rest }: ButtonProps) {
  const cls = cx("lz-btn", `lz-btn--${variant}`, size !== "md" && `lz-btn--${size}`, block && "lz-btn--block", className);
  const kids = (
    <>
      {icon ? <img src={icon} alt="" /> : null}
      <span>{children}</span>
    </>
  );
  if (href) {
    return (
      <a href={href} className={cls} {...(rest as React.AnchorHTMLAttributes<HTMLAnchorElement>)}>
        {kids}
      </a>
    );
  }
  return (
    <button type="button" className={cls} {...rest}>
      {kids}
    </button>
  );
}

/* ---------- IconButton ---------- */
export interface IconButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  /** Nome acessível (obrigatório) */
  label: string;
  variant?: "outlined" | "filled";
  size?: "sm" | "md" | "lg";
  shape?: "circle" | "square";
  children: React.ReactNode;
}
export function IconButton({ label, variant, size, shape, className, children, ...rest }: IconButtonProps) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      className={cx(
        "lz-iconbtn",
        variant === "filled" && "lz-iconbtn--filled",
        size && size !== "md" && `lz-iconbtn--${size}`,
        shape === "square" && "lz-iconbtn--square",
        className,
      )}
      {...rest}
    >
      {children}
    </button>
  );
}

/* ---------- TextField ---------- */
export interface TextFieldProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, "size"> {
  label?: string;
  helper?: string;
  /** Mensagem de erro; substitui o helper e pinta o campo de crítico */
  error?: string;
  /** URL de um ícone à esquerda */
  icon?: string;
  optional?: boolean;
  /** sm 32px · md 40px · lg 52px (padrão) */
  size?: "sm" | "md" | "lg";
}
export function TextField({ label, helper, error, icon, size, optional, className, id, disabled, ...rest }: TextFieldProps) {
  const autoId = React.useId();
  const fieldId = id ?? `lz-field-${autoId}`;
  const help = error || helper;
  return (
    <div className={cx("lz-field", size && size !== "lg" && `lz-field--${size}`, error && "lz-field--error", disabled && "lz-field--disabled", className)}>
      {label ? (
        <label className="lz-field__label" htmlFor={fieldId}>
          {label}
          {optional ? <span className="lz-field__opt"> (opcional)</span> : null}
        </label>
      ) : null}
      <div className="lz-field__box">
        {icon ? <img src={icon} alt="" /> : null}
        <input
          id={fieldId}
          className="lz-field__input"
          disabled={disabled}
          aria-invalid={error ? "true" : undefined}
          aria-describedby={help ? `${fieldId}-help` : undefined}
          {...rest}
        />
      </div>
      {help ? (
        <span id={`${fieldId}-help`} className="lz-field__helper">
          {help}
        </span>
      ) : null}
    </div>
  );
}

/* ---------- Checkbox ---------- */
export interface CheckboxProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: React.ReactNode;
}
export function Checkbox({ label, className, children, ...rest }: CheckboxProps) {
  return (
    <label className={cx("lz-check", rest.disabled && "lz-check--disabled", className)}>
      <input type="checkbox" {...rest} />
      {label ? <span>{label}</span> : children}
    </label>
  );
}

/* ---------- Chip ---------- */
export interface ChipProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  selected?: boolean;
  size?: "sm" | "md";
  icon?: string;
}
export function Chip({ selected, size, icon, className, children, ...rest }: ChipProps) {
  return (
    <button type="button" aria-pressed={selected ? "true" : "false"} className={cx("lz-chip", size === "sm" && "lz-chip--sm", className)} {...rest}>
      {icon ? <img src={icon} alt="" /> : null}
      {children}
    </button>
  );
}

/* ---------- Alert ---------- */
const GLYPH = { info: "i", success: "✓", warning: "!", critical: "!" } as const;
export interface AlertProps {
  tone?: "info" | "success" | "warning" | "critical";
  title?: string;
  children?: React.ReactNode;
  className?: string;
}
export function Alert({ tone = "info", title, children, className }: AlertProps) {
  return (
    <div role={tone === "critical" || tone === "warning" ? "alert" : "status"} className={cx("lz-alert", `lz-alert--${tone}`, className)}>
      <span className="lz-alert__icon" aria-hidden="true">
        {GLYPH[tone]}
      </span>
      <div>
        {title ? <p className="lz-alert__title">{title}</p> : null}
        <p className="lz-alert__body">{children}</p>
      </div>
    </div>
  );
}

/* ---------- Tabs ---------- */
export interface TabsProps {
  items: { value: string; label: string }[];
  value?: string;
  defaultValue?: string;
  onChange?: (value: string) => void;
  /** Nome acessível do tablist */
  label?: string;
  className?: string;
}
export function Tabs({ items, value, defaultValue, onChange, label, className }: TabsProps) {
  const [inner, setInner] = React.useState(defaultValue ?? items[0]?.value);
  const current = value ?? inner;
  return (
    <div role="tablist" aria-label={label} className={cx("lz-tabs", className)}>
      {items.map((it) => (
        <button
          key={it.value}
          role="tab"
          type="button"
          className="lz-tab"
          aria-selected={it.value === current ? "true" : "false"}
          onClick={() => {
            setInner(it.value);
            onChange?.(it.value);
          }}
        >
          {it.label}
        </button>
      ))}
    </div>
  );
}

/* ---------- Card ---------- */
export interface CardProps extends Omit<React.HTMLAttributes<HTMLElement>, "title"> {
  /** outlined (padrão, "paper" do LDS) · elevated · brand (verde profundo) */
  variant?: "outlined" | "elevated" | "brand";
  media?: string;
  mediaAlt?: string;
  eyebrow?: string;
  title?: string;
}
export function Card({ variant, media, mediaAlt, eyebrow, title, className, children, ...rest }: CardProps) {
  return (
    <article className={cx("lz-card", variant && variant !== "outlined" && `lz-card--${variant}`, className)} {...rest}>
      {media ? <img className="lz-card__media" src={media} alt={mediaAlt ?? ""} /> : null}
      <div className="lz-card__body">
        {eyebrow ? <p className="lz-card__eyebrow">{eyebrow}</p> : null}
        {title ? <h3 className="lz-card__title">{title}</h3> : null}
        {children}
      </div>
    </article>
  );
}

/* ---------- Tooltip ---------- */
export interface TooltipProps {
  content: string;
  open?: boolean;
  children: React.ReactNode;
  className?: string;
}
export function Tooltip({ content, open, children, className }: TooltipProps) {
  return (
    <span className={cx("lz-tip", open && "lz-tip--open", className)}>
      {children}
      <span role="tooltip" className="lz-tip__bubble">
        {content}
      </span>
    </span>
  );
}

/* ---------- Accordion ---------- */
export interface AccordionProps {
  items: { title: string; content: React.ReactNode }[];
  defaultOpen?: number[];
  className?: string;
}
export function Accordion({ items, defaultOpen = [], className }: AccordionProps) {
  const [open, setOpen] = React.useState<number[]>(defaultOpen);
  const toggle = (i: number) => setOpen((o) => (o.includes(i) ? o.filter((x) => x !== i) : [...o, i]));
  return (
    <div className={cx("lz-acc", className)}>
      {items.map((it, i) => {
        const isOpen = open.includes(i);
        return (
          <div key={i} className="lz-acc__item" data-open={isOpen ? "true" : "false"}>
            <button type="button" className="lz-acc__head" aria-expanded={isOpen ? "true" : "false"} onClick={() => toggle(i)}>
              <span>{it.title}</span>
              <span className="lz-acc__chev" aria-hidden="true" />
            </button>
            {isOpen ? <div className="lz-acc__panel">{it.content}</div> : null}
          </div>
        );
      })}
    </div>
  );
}
