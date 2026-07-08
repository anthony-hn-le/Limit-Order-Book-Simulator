import { SIDE_BUY } from "../lib/types";
import type { LedgerOrder, OrderStatus } from "../lib/useAccountLedger";

interface Props {
  orders: LedgerOrder[];
  onCancel: (id: number) => void;
}

const STATUS_COLOR: Record<OrderStatus, string> = {
  pending: "var(--accent-cyan)",
  filled: "var(--accent-green)",
  cancelled: "var(--text-muted)",
};

const STATUS_LABEL: Record<OrderStatus, string> = {
  pending: "Pending",
  filled: "Filled",
  cancelled: "Cancelled",
};

const GRID_COLUMNS = "4.5rem 3.5rem 5rem 5.5rem 4.5rem";

export function OrderHistoryTable({ orders, onCancel }: Props) {
  return (
    <div className="mono" style={{ fontSize: "0.78rem" }}>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: GRID_COLUMNS,
          color: "var(--text-muted)",
          fontSize: "0.68rem",
          letterSpacing: "0.04em",
          paddingBottom: "0.4rem",
          borderBottom: "1px solid var(--border)",
        }}
      >
        <span>SIZE</span>
        <span>SIDE</span>
        <span>PRICE</span>
        <span>STATUS</span>
        <span></span>
      </div>

      {orders.length === 0 && (
        <div style={{ color: "var(--text-muted)", padding: "0.75rem 0" }}>No orders yet.</div>
      )}

      <div style={{ maxHeight: "280px", overflowY: "auto" }}>
        {orders.map((order) => (
          <OrderRow key={order.id} order={order} onCancel={onCancel} />
        ))}
      </div>
    </div>
  );
}

function OrderRow({ order, onCancel }: { order: LedgerOrder; onCancel: (id: number) => void }) {
  const sizeLabel = order.filledQty === order.originalQty ? String(order.originalQty) : `${order.filledQty}/${order.originalQty}`;
  const sideColor = order.side === SIDE_BUY ? "var(--accent-green)" : "var(--accent-red)";
  const priceLabel = order.price === null ? "MKT" : String(order.price);

  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: GRID_COLUMNS,
        alignItems: "center",
        padding: "0.4rem 0",
        borderBottom: "1px solid var(--border)",
        color: "var(--text-secondary)",
      }}
    >
      <span>{sizeLabel}</span>
      <span style={{ color: sideColor, fontWeight: 600 }}>{order.side === SIDE_BUY ? "Buy" : "Sell"}</span>
      <span style={{ color: "var(--text-primary)" }}>{priceLabel}</span>
      <span>
        <span
          style={{
            display: "inline-block",
            padding: "0.12rem 0.5rem",
            borderRadius: "999px",
            fontSize: "0.68rem",
            fontWeight: 600,
            color: STATUS_COLOR[order.status],
            background: `color-mix(in srgb, ${STATUS_COLOR[order.status]} 15%, transparent)`,
          }}
        >
          {STATUS_LABEL[order.status]}
        </span>
      </span>
      <span>
        {order.status === "pending" ? (
          <button
            type="button"
            onClick={() => onCancel(order.id)}
            style={{
              padding: "0.15rem 0.5rem",
              borderRadius: "6px",
              border: "1px solid var(--border)",
              background: "transparent",
              color: "var(--text-secondary)",
              fontSize: "0.68rem",
              cursor: "pointer",
            }}
            onMouseEnter={(e) => (e.currentTarget.style.color = "var(--accent-red)")}
            onMouseLeave={(e) => (e.currentTarget.style.color = "var(--text-secondary)")}
          >
            Cancel
          </button>
        ) : (
          <span style={{ color: "var(--text-muted)" }}>—</span>
        )}
      </span>
    </div>
  );
}
