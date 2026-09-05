import type { BillingCycle, PlanKey, Workspace } from "./types";

export type AccountRole = "master" | "pro" | "contador";
export type LeadStatus = "aguardando_pagamento" | "aguardando_confirmacao" | "ativo" | "cancelado";
export type SubscriptionStatus = "pendente" | "ativa" | "atrasada" | "cancelada";

export interface SessionUser {
  id: string;
  username: string;
  email: string;
  nome: string;
  role: AccountRole;
  plan: PlanKey | "master";
  mustChangePassword: boolean;
  telefone?: string;
  cnpj?: string;
  empresa?: string;
}

export interface Lead {
  id: string;
  createdAt: string;
  nome: string;
  email: string;
  telefone: string;
  cnpj: string;
  empresa: string;
  plan: PlanKey;
  cycle: BillingCycle;
  amount: number;
  title?: string;
  status: LeadStatus;
  paymentUrl: string;
  pixKey?: string;
  pixPayload?: string;
  pageUrl?: string;
  mpPreferenceId?: string;
  mpInitPoint?: string;
  mpPaymentId?: string;
  paidAt?: string;
  userId?: string;
  notes?: string;
}

export interface AccountRecord {
  id: string;
  username: string;
  email: string;
  nome: string;
  role: AccountRole;
  plan: PlanKey | "master";
  status: "ativo" | "bloqueado" | "pendente";
  mustChangePassword: boolean;
  createdAt: string;
  telefone?: string;
  cnpj?: string;
  empresa?: string;
}

export interface Subscription {
  id: string;
  userId: string;
  leadId: string;
  nome: string;
  email: string;
  plan: PlanKey;
  cycle: BillingCycle;
  amount: number;
  status: SubscriptionStatus;
  startedAt: string;
  nextDue: string;
  lastPaidAt?: string;
  mpPreapprovalId?: string;
  recurring?: boolean;
}

export interface PaymentRecord {
  id: string;
  leadId: string;
  userId?: string;
  nome: string;
  email: string;
  amount: number;
  status: "pendente" | "confirmado" | "falhou";
  method: "pix" | "link" | "mercadopago";
  createdAt: string;
  confirmedAt?: string;
}

export interface EmailLog {
  id: string;
  to: string;
  subject: string;
  at: string;
  ok: boolean;
}

export interface WorkspaceSnapshot {
  userId: string;
  nome: string;
  email: string;
  plan: PlanKey | "master";
  updatedAt: string;
  workspace: Workspace;
}

export interface CheckoutInput {
  nome: string;
  email: string;
  telefone: string;
  cnpj: string;
  empresa: string;
  plan: PlanKey;
  cycle: BillingCycle;
  test?: boolean;
}

export interface ConfirmPaymentResult {
  lead: Lead;
  tempPassword?: string;
  emailSent?: boolean;
  username?: string;
  pending?: boolean;
}

export const MASTER_USERNAME = "itanosampaio";
export const MASTER_BOOTSTRAP_PASSWORD = "Itano#Podmei26";
