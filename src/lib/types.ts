export type CompanyType =
  | "servicos"
  | "comercio"
  | "comercio_servicos"
  | "industria"
  | "transporte_carga"
  | "transporte_passageiros";

export type RevenueKind = "comercio" | "industria" | "servico" | "transporte_carga" | "transporte_passageiros";

export type EntryKind = "venda" | "compra" | "despesa";

export type PaymentStatus = "liquidado" | "a_receber" | "a_pagar";

export type PaymentMethod = "pix" | "dinheiro" | "debito" | "credito" | "boleto" | "transferencia";

export type EntrySource = "texto" | "foto" | "audio" | "nota" | "whatsapp" | "manual" | "extrato";

export type ContactKind = "cliente" | "fornecedor";

export type ProductKind = "produto" | "servico";

export type DiscountKind = "reais" | "percent";

export type DasPerfil = "comercio" | "servicos" | "misto" | "caminhoneiro" | "caminhoneiro_servicos";

export type PlanKey = "pro" | "contador";

export type BillingCycle = "month" | "year";

export interface Company {
  cnpj: string;
  nome: string;
  telefone: string;
  email: string;
  endereco: string;
  bairro: string;
  cidade: string;
  uf: string;
  tipo: CompanyType;
  dataAbertura: string;
  capitalSocial: number;
  limiteFaturamento: number;
  dasPerfil?: DasPerfil;
  logoDataUrl?: string;
  /** Chave Pix do MEI — usada na cobrança de contas a receber. */
  pixChave?: string;
}

export interface Contact {
  id: string;
  kind: ContactKind;
  nome: string;
  documento: string;
  telefone: string;
  email: string;
  endereco: string;
  cidade: string;
  uf: string;
  observacao: string;
  createdAt: string;
}

export interface Product {
  id: string;
  kind: ProductKind;
  nome: string;
  preco: number;
  unidade: string;
  observacao: string;
  createdAt: string;
}

export interface Entry {
  id: string;
  data: string;
  contraparte: string;
  documento: string;
  kind: EntryKind;
  revenueKind?: RevenueKind;
  /** Valor líquido final (após qtd × unitário − desconto). Usado nos totais. */
  valor: number;
  descricao: string;
  status: PaymentStatus;
  documentoFiscal: boolean;
  formaPagamento: PaymentMethod;
  source: EntrySource;
  vencimento?: string;
  observacao?: string;
  contactId?: string;
  productId?: string;
  quantidade?: number;
  precoUnitario?: number;
  descontoTipo?: DiscountKind;
  descontoValor?: number;
}

export interface WhatsAppMessage {
  id: string;
  from: "mei" | "bot";
  text: string;
  at: string;
}

export type MeiStatus = "ativo" | "arquivado";

export interface Accountant {
  nome: string;
  crc: string;
  email: string;
  telefone: string;
  escritorio: string;
}

export type EmployeeStatus = "ativo" | "desligado";

export type PayrollKind = "mensal" | "decimo" | "ferias";

export interface Employee {
  id: string;
  nome: string;
  cpf: string;
  cargo: string;
  dataAdmissao: string;
  dataDesligamento?: string;
  salario: number;
  pisoCategoria: number;
  valeTransporte: number;
  jornada: "44h" | "parcial";
  status: EmployeeStatus;
  observacao: string;
}

export interface PayrollRun {
  id: string;
  employeeId: string;
  employeeNome: string;
  year: number;
  month: number;
  kind: PayrollKind;
  bruto: number;
  extras: number;
  valeTransporte: number;
  inssEmpregado: number;
  descontoVt: number;
  liquido: number;
  inssPatronal: number;
  fgts: number;
  dae: number;
  provision13: number;
  provisionFerias: number;
  custoMei: number;
  salaryPaid: boolean;
  daePaid: boolean;
  salaryEntryId?: string;
  daeEntryId?: string;
  createdAt: string;
}

export interface MeiClient {
  id: string;
  status: MeiStatus;
  createdAt: string;
  notes: string;
  honorario: number;
  company: Company;
  entries: Entry[];
  plan: PlanKey;
  whatsapp: WhatsAppMessage[];
  whatsappPhone: string;
  employee?: Employee | null;
  payrolls?: PayrollRun[];
  contacts?: Contact[];
  products?: Product[];
  /** Convite aceito: cópia do MEI na carteira do contador. */
  sharedInviteId?: string;
}

export interface Workspace {
  accountant: Accountant;
  clients: MeiClient[];
  activeClientId: string;
  /** ISO — última gravação local/nuvem (last-write-wins no sync). */
  updatedAt?: string;
}

export interface AppState {
  company: Company;
  entries: Entry[];
  plan: PlanKey;
  whatsapp: WhatsAppMessage[];
  whatsappPhone: string;
  contacts?: Contact[];
}

export const MONTHS = [
  "Janeiro",
  "Fevereiro",
  "Março",
  "Abril",
  "Maio",
  "Junho",
  "Julho",
  "Agosto",
  "Setembro",
  "Outubro",
  "Novembro",
  "Dezembro",
] as const;

export const MONTHS_SHORT = [
  "JAN",
  "FEV",
  "MAR",
  "ABR",
  "MAI",
  "JUN",
  "JUL",
  "AGO",
  "SET",
  "OUT",
  "NOV",
  "DEZ",
] as const;
