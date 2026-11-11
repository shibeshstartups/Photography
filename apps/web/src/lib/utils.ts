import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatDate(date: string | Date | null | undefined): string {
  if (!date) return "—";
  return new Date(date).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

export function formatDateTime(date: string | Date | null | undefined): string {
  if (!date) return "—";
  return new Date(date).toLocaleString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function formatCurrency(amount: number | null | undefined, currency = "USD"): string {
  if (amount == null) return "—";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
  }).format(amount);
}

export function formatPercent(value: number | null | undefined): string {
  if (value == null) return "—";
  return `${value.toFixed(1)}%`;
}

export function statusColor(status: string): string {
  const colors: Record<string, string> = {
    active: "bg-green-500",
    completed: "bg-blue-500",
    cancelled: "bg-red-500",
    pending: "bg-yellow-500",
    in_progress: "bg-blue-500",
    draft: "bg-gray-500",
    paid: "bg-green-500",
    unpaid: "bg-red-500",
    overdue: "bg-red-500",
    partial: "bg-yellow-500",
    confirmed: "bg-green-500",
    on_hold: "bg-orange-500",
    archived: "bg-gray-500",
    delivered: "bg-green-500",
  };
  return colors[status] || "bg-gray-500";
}

export function statusLabel(status: string): string {
  return status.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

export function getInitials(name: string | null | undefined): string {
  if (!name) return "?";
  return name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

export function truncate(str: string | null | undefined, length = 50): string {
  if (!str) return "";
  return str.length > length ? `${str.slice(0, length)}...` : str;
}

export function generateId(prefix: string): string {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}