# POD MEI

App de controle financeiro para MEI: lançamentos, limite de faturamento, DAS, DASN, recibos e planos Pro/Contador.

Site: https://podmei.com

## Como abrir (web)

```powershell
cd "C:\Users\equil\Downloads\Mei controlado"
npm install
npm run dev
```

## iOS (App Store) — mesmo roteiro do EDB Total (Codemagic)

A Apple exige um Mac só para **compilar**. Usamos Codemagic (~500 min/mês no plano grátis). Bundle ID: `br.com.podmei.app`.

### A. Site no ar

Publique no HostGator as páginas:
- https://podmei.com/privacidade
- https://podmei.com/termos

(Exclusão de conta: Empresa → Excluir minha conta.)

### B. Apple (navegador no Windows)

1. Conta do **Apple Developer Program** pago.
2. [developer.apple.com/account](https://developer.apple.com/account) → Identifiers → `+` → App IDs → App → Bundle ID **Explicit**: `br.com.podmei.app`.
3. [appstoreconnect.apple.com](https://appstoreconnect.apple.com) → Apps → Novo app: iOS, nome **PODMEI**, idioma Português (Brasil), bundle `br.com.podmei.app`, SKU `podmei`.
4. **Chave de API** (pode reutilizar a do EDB Total CI se já existir): App Store Connect → Users and Access → Integrations → App Store Connect API. Anote **Issuer ID** e **Key ID**. Guarde o `.p8`.
5. Ficha: Criptografia só HTTPS. Idade 4+. Capturas iPhone 6.7" e 6.1". URL privacidade: https://podmei.com/privacidade

### C. Codemagic

1. Repositório GitHub com este projeto (`ios/` + `codemagic.yaml`).
2. [codemagic.io](https://codemagic.io) → adicione o repositório.
3. Team settings → **Team integrations → Developer Portal** → Issuer ID, Key ID e `.p8` (mesmo do EDB se for a mesma conta).
4. Environment variables → grupo `app_store_credentials`:
   - `APP_STORE_CONNECT_KEY_IDENTIFIER`
   - `APP_STORE_CONNECT_ISSUER_ID`
   - `APP_STORE_CONNECT_PRIVATE_KEY` (texto completo do `.p8`)
   - `CERTIFICATE_PRIVATE_KEY` (chave RSA gerada uma vez — a mesma do EDB serve se o certificado for da mesma conta)
5. Check for configuration file → rode o workflow **PODMEI App Store**.
6. Quando o build estiver no TestFlight, complete a ficha e envie para a App Store.

### Texto da ficha

- **Nome:** PODMEI
- **Subtítulo:** Controle financeiro do MEI
- **Categoria:** Finanças / Negócios
- **URL de suporte:** https://podmei.com
- **URL de privacidade:** https://podmei.com/privacidade
- **Palavras-chave:** mei,das,dasn,contabilidade,faturamento,recibo,contador

### Scripts locais

```powershell
npm run ios:sync   # build web + cap sync
```
