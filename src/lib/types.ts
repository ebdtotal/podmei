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

export type PixTipo = "cnpj" | "cpf" | "telefone" | "email" | "copia_e_cola";

export type PlanKey = "pro" | "premium" | "contador";

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
  pixTipo?: PixTipo;
  logoDataUrl?: string;
  /** Nome de quem assina o recibo. */
  responsavel?: string;
  /** Opcional. Só entra na faixa do recibo se estiver preenchido. */
  instagram?: string;
  /** Chave Pix do MEI — usada na cobrança de contas a receber. */
  pixChave?: string;
  /** Meta de faturamento do mês (R$). */
  metaFaturamentoMes?: number;
  /** Meta de faturamento do ano (R$). */
  metaFaturamentoAno?: number;
  /** Dias de antecedência para lembrete de a receber/pagar. */
  lembreteContasDias?: number;
}

export interface Contact {
  id: string;
  kind: ContactKind;
  nome: string;
  documento: string;
  telefone: string;
  email: string;
  endereco: string;
  numero?: string;
  complemento?: string;
  bairro?: string;
  cep?: string;
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
  /** Agrupa parcelas de uma série (recorrente / parcelado). */
  seriesId?: string;
  /** Tipo da série, para ações como parar recorrência. */
  seriesKind?: "recorrente" | "parcelado";
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
  codigo?: string;
  cbo?: string;
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

export interface CalendarEvent {
  id: string;
  /** Data do evento (ISO yyyy-mm-dd). */
  date: string;
  title: string;
  note?: string;
  valor?: number;
  createdAt: string;
}

export type InvestmentYieldKind = "pre" | "pos_cdi";
export type InvestmentMoveKind = "aporte" | "resgate" | "rendimento";

/** Posição / produto de investimento (CDB, RDB, etc.). */
export interface Investment {
  id: string;
  nome: string;
  instituicao: string;
  yieldKind: InvestmentYieldKind;
  /** Pré: % a.a. | Pós: % do CDI (ex.: 100 = 100% do CDI). */
  taxa: number;
  prazoDias?: number;
  vencimento?: string;
  createdAt: string;
}

export interface InvestmentMovement {
  id: string;
  investmentId: string;
  kind: InvestmentMoveKind;
  data: string;
  valor: number;
  observacao?: string;
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
  /** Agendamentos manuais do calendário. */
  events?: CalendarEvent[];
  investments?: Investment[];
  investmentMovements?: InvestmentMovement[];
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
