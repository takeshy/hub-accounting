/**
 * DiagnosticsBadge - Badge showing error/warning counts.
 */

import * as React from "react";
import { tFormat } from "../i18n";
import { LedgerData } from "../types";
import { getDiagnosticCounts, getDiagnostics, formatDiagnostic } from "../core/diagnostics";

interface DiagnosticsBadgeProps {
  ledger: LedgerData;
  onClick?: () => void;
}

export function DiagnosticsBadge(props: DiagnosticsBadgeProps) {
  const { ledger, onClick } = props;
  const counts = getDiagnosticCounts(ledger);
  const [showDetails, setShowDetails] = React.useState(false);

  if (counts.errors === 0 && counts.warnings === 0) {
    return (
      <span className="accounting-diagnostics accounting-diagnostics-clean">
        ✓
      </span>
    );
  }

  const diagnostics = getDiagnostics(ledger);

  return (
    <span className="accounting-diagnostics">
      {counts.errors > 0 && (
        <span
          className="accounting-diagnostics-badge accounting-diagnostics-error"
          onClick={onClick || (() => setShowDetails(!showDetails))}
          title={tFormat("diagnostics.errors", counts.errors)}
        >
          {counts.errors}
        </span>
      )}
      {counts.warnings > 0 && (
        <span
          className="accounting-diagnostics-badge accounting-diagnostics-warning"
          onClick={onClick || (() => setShowDetails(!showDetails))}
          title={tFormat("diagnostics.warnings", counts.warnings)}
        >
          {counts.warnings}
        </span>
      )}
      {showDetails && (
        <div className="accounting-diagnostics-popup">
          {diagnostics.slice(0, 10).map((d, i) => (
            <div key={i} className={`accounting-diagnostics-item accounting-diagnostics-${d.severity}`}>
              {formatDiagnostic(d)}
            </div>
          ))}
          {diagnostics.length > 10 && (
            <div className="accounting-diagnostics-more">
              ...and {diagnostics.length - 10} more
            </div>
          )}
        </div>
      )}
    </span>
  );
}
