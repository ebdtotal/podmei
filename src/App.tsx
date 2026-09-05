import { Navigate, Route, Routes } from "react-router-dom";
import { RequireAuth, RequireMaster } from "./components/auth/RequireAuth";
import { AppShell } from "./components/layout/AppShell";
import { ContadorShell } from "./components/layout/ContadorShell";
import { MasterShell } from "./components/layout/MasterShell";
import { CadastrosPage } from "./pages/app/CadastrosPage";
import { ContasPage } from "./pages/app/ContasPage";
import { DashboardPage } from "./pages/app/DashboardPage";
import { DasnPage } from "./pages/app/DasnPage";
import { DasPage } from "./pages/app/DasPage";
import { DrePage } from "./pages/app/DrePage";
import { EmpresaPage } from "./pages/app/EmpresaPage";
import { FolhaPage } from "./pages/app/FolhaPage";
import { ExtratoPage } from "./pages/app/ExtratoPage";
import { NfsePage } from "./pages/app/GovPages";
import { LancamentosPage } from "./pages/app/LancamentosPage";
import { LimitesPage } from "./pages/app/LimitesPage";
import { LivroCaixaPage } from "./pages/app/LivroCaixaPage";
import { LivroRazaoPage } from "./pages/app/LivroRazaoPage";
import { PlanosPage } from "./pages/app/PlanosPage";
import { ProdutosPage } from "./pages/app/ProdutosPage";
import { RecibosPage } from "./pages/app/RecibosPage";
import { RelatorioOficialPage } from "./pages/app/RelatorioOficialPage";
import { RelatoriosPage } from "./pages/app/RelatoriosPage";
import { AssinarRetornoPage } from "./pages/AssinarRetornoPage";
import { CheckoutPage } from "./pages/CheckoutPage";
import { CarteiraPage } from "./pages/contador/CarteiraPage";
import { EscritorioPage } from "./pages/contador/EscritorioPage";
import { LandingPage } from "./pages/LandingPage";
import { PrivacidadePage, TermosPage } from "./pages/LegalPage";
import { LoginPage } from "./pages/LoginPage";
import { MasterAssinaturasPage } from "./pages/master/AssinaturasPage";
import { MasterClientesPage } from "./pages/master/ClientesPage";
import { MasterFinanceiroPage } from "./pages/master/FinanceiroPage";
import { MasterConfiguracoesPage } from "./pages/master/ConfiguracoesPage";
import { MasterLeadsPage } from "./pages/master/LeadsPage";
import { PayPage } from "./pages/PayPage";
import { TestCheckoutPage } from "./pages/TestCheckoutPage";

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<LandingPage />} />
      <Route path="/privacidade" element={<PrivacidadePage />} />
      <Route path="/termos" element={<TermosPage />} />
      <Route path="/entrar" element={<LoginPage />} />
      <Route path="/login" element={<Navigate to="/entrar" replace />} />
      <Route path="/assinar/sucesso" element={<AssinarRetornoPage tipo="sucesso" />} />
      <Route path="/assinar/falha" element={<AssinarRetornoPage tipo="falha" />} />
      <Route path="/assinar/pendente" element={<AssinarRetornoPage tipo="pendente" />} />
      <Route path="/assinar/teste" element={<TestCheckoutPage />} />
      <Route path="/assinar/:plan" element={<CheckoutPage />} />
      <Route path="/teste-pagamento" element={<TestCheckoutPage />} />
      <Route path="/pagar/:id" element={<PayPage />} />
      <Route
        path="/master"
        element={
          <RequireMaster>
            <MasterShell />
          </RequireMaster>
        }
      >
        <Route index element={<Navigate to="clientes" replace />} />
        <Route path="clientes" element={<MasterClientesPage />} />
        <Route path="clientes/:id" element={<MasterClientesPage />} />
        <Route path="leads" element={<MasterLeadsPage />} />
        <Route path="assinaturas" element={<MasterAssinaturasPage />} />
        <Route path="financeiro" element={<MasterFinanceiroPage />} />
        <Route path="meis" element={<CarteiraPage />} />
        <Route path="escritorio" element={<EscritorioPage />} />
        <Route path="configuracoes" element={<MasterConfiguracoesPage />} />
        <Route path="cadastros" element={<Navigate to="/master/clientes" replace />} />
      </Route>
      <Route
        path="/contador"
        element={
          <RequireAuth>
            <ContadorShell />
          </RequireAuth>
        }
      >
        <Route index element={<CarteiraPage />} />
        <Route path="escritorio" element={<EscritorioPage />} />
      </Route>
      <Route path="/app" element={<AppShell />}>
        <Route index element={<DashboardPage />} />
        <Route path="empresa" element={<EmpresaPage />} />
        <Route path="cadastros" element={<CadastrosPage />} />
        <Route path="produtos" element={<ProdutosPage />} />
        <Route path="lancamentos" element={<LancamentosPage />} />
        <Route path="extrato" element={<ExtratoPage />} />
        <Route path="recibos" element={<RecibosPage />} />
        <Route path="contas" element={<ContasPage />} />
        <Route path="folha" element={<FolhaPage />} />
        <Route path="relatorios" element={<RelatoriosPage />} />
        <Route path="relatorio-oficial" element={<RelatorioOficialPage />} />
        <Route path="dre" element={<DrePage />} />
        <Route path="livro-caixa" element={<LivroCaixaPage />} />
        <Route path="livro-razao" element={<LivroRazaoPage />} />
        <Route path="limites" element={<LimitesPage />} />
        <Route path="whatsapp" element={<Navigate to="/app" replace />} />
        <Route path="das" element={<DasPage />} />
        <Route path="dasn" element={<DasnPage />} />
        <Route path="nfse" element={<NfsePage />} />
        <Route path="planos" element={<PlanosPage />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
