/**
 * HoverTooltip - Tooltip for account and currency info.
 */

import * as React from "react";
import { LedgerData } from "../types";
import { getAccountHoverInfo, getCurrencyHoverInfo, formatAccountHover, formatCurrencyHover } from "../core/hover";

interface HoverTooltipProps {
  ledger: LedgerData;
  type: "account" | "currency";
  name: string;
  children: React.ReactElement;
}

export function HoverTooltip(props: HoverTooltipProps) {
  const { ledger, type, name, children } = props;
  const [show, setShow] = React.useState(false);
  const [content, setContent] = React.useState<string>("");
  const timeoutRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  function handleMouseEnter() {
    if (type === "account") {
      const info = getAccountHoverInfo(ledger, name);
      if (info) {
        setContent(formatAccountHover(info));
        setShow(true);
      }
    } else {
      const info = getCurrencyHoverInfo(ledger, name);
      if (info) {
        const today = new Date().toISOString().slice(0, 10);
        setContent(formatCurrencyHover(info, today));
        setShow(true);
      }
    }
  }

  function handleMouseLeave() {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
    timeoutRef.current = setTimeout(() => setShow(false), 200);
  }

  return (
    <span
      className="accounting-hover-target"
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      {children}
      {show && (
        <div className="accounting-tooltip">
          <pre className="accounting-tooltip-content">{content}</pre>
        </div>
      )}
    </span>
  );
}
