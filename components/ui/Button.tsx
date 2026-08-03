import Link from "next/link";
import type { ButtonHTMLAttributes, ReactNode } from "react";

export type ButtonVariant = "primary" | "secondary" | "ghost";

const VARIANT_STYLES: Record<ButtonVariant, string> = {
  primary: "bg-mint text-brand-foreground",
  secondary: "bg-surface-card text-ink-900 border-ink-300 border",
  ghost: "text-ink-900",
};

const BASE_STYLES =
  "inline-flex items-center justify-center gap-2 text-sm font-semibold disabled:opacity-60";

interface ButtonOwnProps {
  variant?: ButtonVariant;
  children: ReactNode;
  className?: string;
}

interface ButtonAsButtonProps
  extends ButtonOwnProps, Omit<ButtonHTMLAttributes<HTMLButtonElement>, "className" | "children"> {
  href?: undefined;
}

interface ButtonAsLinkProps extends ButtonOwnProps {
  href: string;
}

type ButtonProps = ButtonAsButtonProps | ButtonAsLinkProps;

/**
 * Bouton d'action générique — brique de premier niveau du design system,
 * au même titre que `Badge`. `variant` pilote la couleur (primary = action
 * principale de l'écran, secondary = action secondaire, ghost = tertiaire) ;
 * la forme (arrondi, padding, largeur) reste au choix de l'appelant via
 * `className`, car elle varie légitimement selon le contexte (CTA pleine
 * largeur en bas de formulaire vs lien compact).
 *
 * `href` fait rendre un `next/link` plutôt qu'un `<button>` — même style,
 * pour les actions qui naviguent plutôt qu'elles ne soumettent.
 */
export function Button({ variant = "primary", className = "", children, ...props }: ButtonProps) {
  const classes = `${BASE_STYLES} ${VARIANT_STYLES[variant]} ${className}`;

  if (props.href) {
    const { href, ...rest } = props as ButtonAsLinkProps;
    return (
      <Link href={href} className={classes} {...rest}>
        {children}
      </Link>
    );
  }

  return (
    <button type="button" className={classes} {...props}>
      {children}
    </button>
  );
}
