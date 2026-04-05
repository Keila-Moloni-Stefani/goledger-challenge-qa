# Bug Report — GoLedger QA Challenge
**Autor:** Keila Moloni Stefani  
**Data:** 04/04/2026  
**Repositório:** https://github.com/Keila-Moloni-Stefani/goledger-challenge-qa  
**Ambiente testado:** API local (`http://localhost:8080`) + Front-end (`http://localhost:3000`)

---

## Sumário de Bugs

| ID | Título | Componente | Severidade |
|---|---|---|---|
| BUG-001 | DELETE /books não exige autenticação | API | Critical |
| BUG-002 | GET /me expõe senha do usuário em texto puro | API | Critical |
| BUG-003 | POST /libraries não cria biblioteca — campo `name` não reconhecido pela CCAPI | API | Critical |
| BUG-004 | GET /books retorna lista vazia com filtro por genre | API | High |
| BUG-005 | Erros da CCAPI retornados como JSON escapado dentro de JSON | API | High |
| BUG-006 | POST /persons retorna `null` no response body após criação bem-sucedida | API | High |
| BUG-007 | GET /books expõe campos internos da blockchain na resposta | API | Medium |
| BUG-008 | API não valida bookType localmente antes de enviar à CCAPI | API | Medium |
| BUG-009 | GET /libraries/{name}/books retorna 400 em vez de 404 para biblioteca inexistente | API | Medium |
| BUG-010 | PUT /books/tenant retorna 404 não documentado para tenant inexistente | API | Low |
| BUG-011 | POST /books não documenta resposta 409 no Swagger | API | Low |
| BUG-012 | Exemplos de resposta de erro são idênticos em todos os endpoints | API | Low |
| BUG-013 | Front-end exibe "No books found" para autor com livros cadastrados | Web | High |
| BUG-014 | Mensagem de erro técnica da CCAPI exposta diretamente ao usuário | Web | High |
| BUG-015 | Register não exibe confirmação de sucesso após criar conta | Web | Medium |
| BUG-016 | CPF inválido não é validado no front-end antes do envio | Web | Medium |
| BUG-017 | Book Type não é obrigatório no formulário Create Book | Web | Medium |
| BUG-018 | Mensagem de erro genérica ao criar livro com dados inválidos | Web | Medium |
| BUG-019 | Botões Prev/Next de paginação aparecem sem resultados | Web | Low |
| BUG-020 | Formulários Create Book e Search Books empilhados na mesma tela | Web | Low |

---

## Detalhamento dos Bugs

---

### BUG-001 — DELETE /books não exige autenticação

- **Component:** API
- **Endpoint / Page:** `DELETE /books`
- **Severity:** Critical

**Description:**  
O endpoint de deleção de livros não exige token JWT, permitindo que qualquer pessoa não autenticada delete registros permanentes da blockchain. Todos os outros endpoints que modificam dados exigem autenticação. O próprio README indica o campo Auth Required como "—" (ausente), divergindo do comportamento esperado para uma operação destrutiva e irreversível.

**Steps to Reproduce:**
1. Não realizar login nem incluir token Authorization
2. Enviar: `DELETE http://localhost:8080/books?title=X&author=Y`
3. Observar que a requisição é processada normalmente (sem rejeição por autenticação)

**Expected Behaviour:**  
Retornar `401 Unauthorized` com mensagem `"authorization header required"`.

**Actual Behaviour:**  
A API processa a requisição sem autenticação. Retorna `404` apenas porque o livro não existe — se o livro existir, seria deletado da blockchain sem nenhuma autenticação.

**Proposed Fix:**  
Adicionar o middleware de autenticação JWT na rota DELETE /books, da mesma forma que os demais endpoints protegidos:
```go
router.DELETE("/books", middleware.AuthRequired(), handlers.DeleteBook)
```

---

### BUG-002 — GET /me expõe senha do usuário em texto puro

- **Component:** API
- **Endpoint / Page:** `GET /me`
- **Severity:** Critical

**Description:**  
O endpoint de perfil do usuário retorna a senha em texto puro no corpo da resposta. Isso expõe credenciais sensíveis a qualquer pessoa que possua um token válido, violando princípios básicos de segurança e privacidade de dados.

**Steps to Reproduce:**
1. Fazer login: `POST /auth/login` com `{"username": "admin", "password": "admin123"}`
2. Copiar o token JWT retornado
3. Executar: `GET /me` com header `Authorization: Bearer <token>`
4. Observar o campo `password` no response body

**Expected Behaviour:**  
Retornar apenas dados não sensíveis, sem o campo `password`:
```json
{ "id": 1, "username": "admin", "role": "admin" }
```

**Actual Behaviour:**  
A senha é retornada em texto puro:
```json
{ "id": 1, "username": "admin", "password": "admin123", "role": "admin" }
```

**Proposed Fix:**  
Usar uma struct de resposta separada que omita o campo `password`:
```go
type UserProfileResponse struct {
    ID       uint   `json:"id"`
    Username string `json:"username"`
    Role     string `json:"role"`
    // password omitido intencionalmente
}
```

---

### BUG-003 — POST /libraries não cria biblioteca — campo `name` não reconhecido pela CCAPI

- **Component:** API
- **Endpoint / Page:** `POST /libraries`
- **Severity:** Critical

**Description:**  
O endpoint de criação de bibliotecas falha completamente. Mesmo enviando o payload correto `{"name": "Central Library"}` com autenticação válida, a CCAPI retorna erro informando que o argumento `name` está ausente. O handler da API está mapeando ou transmitindo o campo com nome errado para a CCAPI, tornando impossível criar qualquer biblioteca pelo sistema.

**Steps to Reproduce:**
1. Autenticar e obter token JWT
2. Executar `POST /libraries` com body: `{"name": "Central Library"}`
3. Observar o erro retornado

**Expected Behaviour:**  
`201 Created` com os dados da biblioteca criada.

**Actual Behaviour:**  
`400 Bad Request` com JSON escapado:
```json
{ "error": "{\"error\":\"unable to get args: missing argument 'name'\",\"status\":400}" }
```

**Proposed Fix:**  
Verificar como o handler `POST /libraries` está construindo o payload enviado à CCAPI. Consultar o schema da CCAPI via endpoint `getSchema` com `{"assetType": "library"}` para confirmar o nome correto do campo esperado. Possível causa: o campo está sendo enviado como `libraryName` ou outro nome diferente de `name`.

---

### BUG-004 — GET /books retorna lista vazia com filtro por genre

- **Component:** API
- **Endpoint / Page:** `GET /books?author=X&genre=Y`
- **Severity:** High

**Description:**  
Ao buscar livros com os parâmetros `author` e `genre` simultaneamente, a API retorna uma lista vazia `[]` mesmo quando existem livros cadastrados que correspondem ao autor informado. Sem o parâmetro `genre`, a busca funciona corretamente, confirmando que o problema está na lógica de filtragem por gênero.

**Steps to Reproduce:**
1. Garantir que existe um livro com author `Alan Donovan` e genre `Technology`
2. Executar: `GET /books?author=Alan%20Donovan&genre=Technology&page=1&limit=10` (com token)
3. Observar o resultado

**Expected Behaviour:**  
Retornar a lista de livros do autor `Alan Donovan` que pertencem ao genre `Technology`.

**Actual Behaviour:**  
Retorna `[]` — lista vazia, mesmo o livro existindo na blockchain.

**Proposed Fix:**  
Investigar a lógica de filtragem por genre no handler de listagem de livros. O filtro provavelmente está sendo aplicado de forma incorreta à query enviada à CCAPI — possível problema com comparação case-sensitive ou nome do campo errado.

---

### BUG-005 — Erros da CCAPI retornados como JSON escapado dentro de JSON

- **Component:** API
- **Endpoint / Page:** `DELETE /books`, `POST /books`, `POST /persons`, `POST /libraries`, `PUT /books/tenant`, `GET /libraries/{name}/books`
- **Severity:** High

**Description:**  
Quando a CCAPI retorna um erro, a API local encapsula a string JSON de erro da CCAPI diretamente no campo `error` sem deserializá-la, resultando em JSON escapado dentro de JSON. Esse padrão afeta todos os endpoints que se comunicam com a CCAPI e expõe detalhes técnicos internos desnecessários ao cliente.

**Steps to Reproduce:**
1. Autenticar e tentar criar um livro já existente: `POST /books` com mesmo `title + author`
2. Observar o campo `error` no response body

**Expected Behaviour:**  
```json
{ "error": "asset already exists" }
```

**Actual Behaviour:**  
```json
{ "error": "{\"error\":\"failed to write asset to ledger: asset already exists\",\"status\":409}" }
```

**Proposed Fix:**  
Deserializar a resposta de erro da CCAPI antes de retorná-la ao cliente:
```go
type CCAPIError struct {
    Error  string `json:"error"`
    Status int    `json:"status"`
}
var ccErr CCAPIError
if err := json.Unmarshal([]byte(rawError), &ccErr); err == nil {
    c.JSON(statusCode, gin.H{"error": ccErr.Error})
    return
}
```

---

### BUG-006 — POST /persons retorna `null` no response body após criação bem-sucedida

- **Component:** API
- **Endpoint / Page:** `POST /persons`
- **Severity:** High

**Description:**  
O endpoint de criação de pessoa retorna status `201 Created` corretamente, mas o corpo da resposta é literalmente `null`. Todos os outros endpoints de criação retornam os dados do recurso criado. A inconsistência impede que o cliente confirme os dados salvos na blockchain.

**Steps to Reproduce:**
1. Autenticar e executar `POST /persons` com payload válido:
```json
{
  "id": "111.444.777-35",
  "name": "Maria Silva",
  "dateOfBirth": "1995-06-20T00:00:00Z",
  "height": 1.65
}
```
2. Observar o response body

**Expected Behaviour:**  
`201 Created` com os dados da pessoa criada:
```json
{ "@assetType": "person", "id": "111.444.777-35", "name": "Maria Silva", ... }
```

**Actual Behaviour:**  
`201 Created` com body `null`.

**Proposed Fix:**  
Verificar o handler `POST /persons` e garantir que a resposta da CCAPI seja retornada ao cliente:
```go
c.JSON(http.StatusCreated, ccapiResponse)
```

---

### BUG-007 — GET /books expõe campos internos da blockchain na resposta

- **Component:** API
- **Endpoint / Page:** `GET /books`, `PUT /books/tenant`
- **Severity:** Medium

**Description:**  
As respostas de listagem e atualização de livros incluem campos internos do Hyperledger Fabric que não deveriam ser expostos publicamente, revelando detalhes de implementação interna da blockchain ao cliente.

**Steps to Reproduce:**
1. Autenticar e executar `GET /books?author=Alan%20Donovan&page=1&limit=1`
2. Observar os campos com prefixo `@` no response body

**Expected Behaviour:**  
Retornar apenas campos relevantes ao negócio: `title`, `author`, `genres`, `bookType`, `currentTenant`, `published`.

**Actual Behaviour:**  
Inclui campos internos da blockchain:
```json
{
  "@key": "book:9071b98b-7c40-533d-8b99-135c67ea9870",
  "@lastTouchBy": "ProcessoSeletivoQAMSP",
  "@lastTx": "createAsset",
  "@lastUpdated": "2026-04-03T19:33:32Z",
  ...
}
```

**Proposed Fix:**  
Criar um struct de resposta filtrado que omita campos com prefixo `@` antes de retornar ao cliente.

---

### BUG-008 — API não valida bookType localmente antes de enviar à CCAPI

- **Component:** API
- **Endpoint / Page:** `POST /books`
- **Severity:** Medium

**Description:**  
O campo `bookType` aceita apenas os valores `0` (Hardcover), `1` (Paperback) e `2` (Ebook). Porém, a API local não valida esse campo antes de encaminhar à CCAPI. A rejeição só ocorre na CCAPI, retornando mensagem técnica complexa.

**Steps to Reproduce:**
1. Autenticar e executar `POST /books` com `{"bookType": 99, ...}`
2. Observar a mensagem de erro retornada

**Expected Behaviour:**  
`400 Bad Request` com mensagem clara: `"bookType must be 0 (Hardcover), 1 (Paperback) or 2 (Ebook)"`

**Actual Behaviour:**  
`400 Bad Request` com mensagem técnica da CCAPI escapada em JSON.

**Proposed Fix:**  
```go
if req.BookType < 0 || req.BookType > 2 {
    c.JSON(http.StatusBadRequest, gin.H{"error": "bookType must be 0, 1 or 2"})
    return
}
```

---

### BUG-009 — GET /libraries/{name}/books retorna 400 em vez de 404 para biblioteca inexistente

- **Component:** API
- **Endpoint / Page:** `GET /libraries/{name}/books`
- **Severity:** Medium

**Description:**  
Ao buscar a contagem de livros de uma biblioteca inexistente, a API retorna `400 Bad Request` com tag `Undocumented`, quando semanticamente o correto seria `404 Not Found`. Além disso, o erro vem como JSON escapado.

**Steps to Reproduce:**
1. Autenticar e executar `GET /libraries/Central%20Library/books` (biblioteca inexistente)
2. Observar o código de resposta

**Expected Behaviour:**  
`404 Not Found` com mensagem `"library not found"`.

**Actual Behaviour:**  
`400 Undocumented` com JSON escapado:
```json
{ "error": "{\"error\":\"failed to get asset from the ledger: failed to get asset bytes: asset not found\",\"status\":400}" }
```

**Proposed Fix:**  
Mapear o status `400` com mensagem "not found" para `404` e documentar este response no Swagger.

---

### BUG-010 — PUT /books/tenant retorna 404 não documentado para tenant inexistente

- **Component:** API
- **Endpoint / Page:** `PUT /books/tenant`
- **Severity:** Low

**Description:**  
Ao tentar atribuir um tenant inexistente a um livro, a API retorna `404 Undocumented` com JSON escapado. O código `404` não está documentado na especificação Swagger do endpoint.

**Steps to Reproduce:**
1. Autenticar e executar `PUT /books/tenant` com `tenantId: "000.000.000-00"` (CPF inexistente)
2. Observar o response

**Expected Behaviour:**  
`404 Not Found` documentado com mensagem clara `"person not found"`.

**Actual Behaviour:**  
`404 Undocumented` com JSON escapado dentro de JSON.

**Proposed Fix:**  
Documentar o response `404` na especificação Swagger e tratar a mensagem de erro da CCAPI antes de retorná-la.

---

### BUG-011 — POST /books não documenta resposta 409 no Swagger

- **Component:** API
- **Endpoint / Page:** `POST /books` — documentação Swagger
- **Severity:** Low

**Description:**  
O endpoint `POST /books` pode retornar `409 Conflict` quando um livro com o mesmo `title + author` já existe na blockchain, mas este código de resposta não está documentado. O Swagger exibe a tag `Undocumented`.

**Steps to Reproduce:**
1. Criar um livro via `POST /books`
2. Tentar criar o mesmo livro novamente
3. Observar `409 Undocumented`

**Expected Behaviour:**  
O código `409` deve estar documentado com descrição e exemplo de resposta.

**Actual Behaviour:**  
Aparece como `Undocumented` no Swagger.

**Proposed Fix:**  
```go
// @Failure 409 {object} ErrorResponse "Book already exists"
```

---

### BUG-012 — Exemplos de resposta de erro são idênticos em todos os endpoints

- **Component:** API
- **Endpoint / Page:** Documentação Swagger — múltiplos endpoints
- **Severity:** Low

**Description:**  
Os exemplos de resposta para os códigos `400`, `401`, `409` e `502` em todos os endpoints mostram o mesmo corpo: `{"error": "invalid credentials"}`, independentemente do tipo de erro. Isso torna a documentação enganosa e dificulta o entendimento do comportamento real da API.

**Steps to Reproduce:**
1. Acessar `GET /docs/index.html`
2. Expandir qualquer endpoint e observar os exemplos de resposta de erro

**Expected Behaviour:**  
Cada código de resposta deve ter um exemplo representativo do erro correspondente.
- `400`: `{"error": "username and password are required"}`
- `401`: `{"error": "invalid credentials"}`
- `409`: `{"error": "username already exists"}`

**Actual Behaviour:**  
Todos os códigos de erro exibem o mesmo exemplo: `{"error": "invalid credentials"}`.

**Proposed Fix:**  
Atualizar os exemplos de resposta nas anotações Swagger de cada endpoint para refletir as mensagens reais retornadas pela API.

---

### BUG-013 — Front-end exibe "No books found" para autor com livros cadastrados

- **Component:** Web
- **Endpoint / Page:** Página Books — Search Books
- **Severity:** High

**Description:**  
Ao buscar livros pelo nome do autor `Alan Donovan` no front-end, a interface exibe "No books found" mesmo com o livro confirmadamente cadastrado na blockchain (verificado diretamente via Swagger com `limit=1`). O front-end não está exibindo os resultados retornados pela API corretamente.

**Steps to Reproduce:**
1. Fazer login no front-end (http://localhost:3000) com `admin/admin123`
2. Navegar até a página Books
3. Digitar `Alan Donovan` no campo AUTHOR
4. Clicar em Search

**Expected Behaviour:**  
Exibir a lista de livros cadastrados pelo autor `Alan Donovan`.

**Actual Behaviour:**  
Exibe "No books found" mesmo com livros existentes na blockchain.

**Proposed Fix:**  
Investigar como o front-end está construindo a URL de requisição e processando a resposta da API. Verificar se o parâmetro `author` está sendo enviado corretamente e se o mapeamento dos dados da resposta está correto.

---

### BUG-014 — Mensagem de erro técnica da CCAPI exposta diretamente ao usuário

- **Component:** Web
- **Endpoint / Page:** Página Persons — Register New Person
- **Severity:** High

**Description:**  
Quando ocorre um erro de validação na CCAPI (ex: CPF inválido), o front-end exibe a mensagem técnica interna completa ao usuário, incluindo detalhes de implementação da blockchain. Isso é confuso para o usuário final e expõe detalhes internos do sistema.

**Steps to Reproduce:**
1. Navegar até a página Persons
2. Preencher CPF com `123` e Full Name com qualquer valor
3. Clicar em Register Person

**Expected Behaviour:**  
Exibir mensagem amigável: `"CPF inválido. Use o formato 000.000.000-00"`

**Actual Behaviour:**  
Exibe mensagem técnica completa:
```
{"error":"unable to get args: invalid argument 'asset': failed constructing asset: 
error generating key for asset property 'CPF (Brazilian ID)': CPF must have 11 digits","status":400}
```

**Proposed Fix:**  
Tratar os erros da API no front-end e exibir mensagens amigáveis ao usuário, mapeando os erros conhecidos para mensagens em linguagem natural.

---

### BUG-015 — Register não exibe confirmação de sucesso após criar conta

- **Component:** Web
- **Endpoint / Page:** Página Register
- **Severity:** Medium

**Description:**  
Após preencher e submeter o formulário de registro com sucesso, a tela retorna para a página de login sem nenhuma mensagem de feedback — nem confirmação de sucesso nem indicação de erro. O usuário fica sem saber se a conta foi criada.

**Steps to Reproduce:**
1. Acessar http://localhost:3000
2. Clicar em "Register" / "Don't have an account? Register"
3. Preencher username e password válidos
4. Submeter o formulário
5. Observar que a tela volta ao login silenciosamente

**Expected Behaviour:**  
Exibir mensagem de sucesso como `"Account created successfully! Please sign in."` ou toast de confirmação.

**Actual Behaviour:**  
Redirecionamento silencioso para a tela de login sem qualquer feedback ao usuário.

**Proposed Fix:**  
```typescript
await register(username, password);
navigate('/login', { state: { message: 'Account created successfully!' } });
// Na tela de login, exibir o message do state se presente
```

---

### BUG-016 — CPF inválido não é validado no front-end antes do envio

- **Component:** Web
- **Endpoint / Page:** Página Persons — Register New Person
- **Severity:** Medium

**Description:**  
O campo CPF aceita qualquer valor sem validar o formato `000.000.000-00` ou o número mínimo de dígitos antes de enviar para a API. A requisição é enviada com dados inválidos, e o erro só é detectado pela CCAPI, que retorna mensagem técnica.

**Steps to Reproduce:**
1. Navegar até a página Persons
2. Digitar `123` no campo CPF e preencher os demais campos obrigatórios
3. Clicar em Register Person

**Expected Behaviour:**  
O front-end deve bloquear o envio e exibir: `"CPF deve estar no formato 000.000.000-00"`.

**Actual Behaviour:**  
O formulário é enviado com CPF inválido e o erro retorna da CCAPI com mensagem técnica exposta ao usuário.

**Proposed Fix:**  
```typescript
const cpfRegex = /^\d{3}\.\d{3}\.\d{3}-\d{2}$/;
if (!cpfRegex.test(cpf)) {
  setError("CPF deve estar no formato 000.000.000-00");
  return;
}
```

---

### BUG-017 — Book Type não é obrigatório no formulário Create Book

- **Component:** Web
- **Endpoint / Page:** Página Books — Create New Book
- **Severity:** Medium

**Description:**  
O campo Book Type possui estado inicial `"— Select —"` sem valor definido, e o formulário pode ser submetido sem selecionar um tipo. A API rejeita a requisição, mas o front-end não valida este campo como obrigatório antes de enviar.

**Steps to Reproduce:**
1. Navegar até Books e clicar em "+ New Book"
2. Preencher Title e Author mas deixar Book Type em "— Select —"
3. Clicar em Create Book

**Expected Behaviour:**  
Exibir mensagem de validação: `"Book Type é obrigatório"` sem enviar a requisição.

**Actual Behaviour:**  
O formulário é enviado sem `bookType`, resultando em erro da API.

**Proposed Fix:**  
```typescript
if (!bookType && bookType !== 0) {
  setError("Book Type é obrigatório");
  return;
}
```

---

### BUG-018 — Mensagem de erro genérica ao criar livro com dados inválidos

- **Component:** Web
- **Endpoint / Page:** Página Books — Create New Book
- **Severity:** Medium

**Description:**  
Ao tentar criar um livro com dados inválidos, o front-end exibe apenas a mensagem genérica `"An error occurred. Please try again."`, sem informar o motivo específico. Além disso, os campos do formulário não são limpos após o erro.

**Steps to Reproduce:**
1. Navegar até Books e clicar em "+ New Book"
2. Preencher Title com `.` e Author com `.`
3. Clicar em Create Book

**Expected Behaviour:**  
Exibir a mensagem de erro específica retornada pela API.

**Actual Behaviour:**  
Exibe: `"An error occurred. Please try again."` com os campos mantendo os valores inválidos.

**Proposed Fix:**  
```typescript
} catch (err: any) {
  setError(err.response?.data?.error || "An error occurred. Please try again.");
}
```

---

### BUG-019 — Botões Prev/Next de paginação aparecem sem resultados

- **Component:** Web
- **Endpoint / Page:** Página Books — Search Books
- **Severity:** Low

**Description:**  
Os botões de navegação de paginação `← Prev` e `Next →` são exibidos mesmo quando a busca não retorna resultados ("No books found"). Botões de paginação não fazem sentido sem conteúdo para paginar.

**Steps to Reproduce:**
1. Navegar até a página Books
2. Buscar por um autor que retorne "No books found"
3. Observar os botões de paginação na parte inferior

**Expected Behaviour:**  
Os botões de paginação devem ser ocultados quando não há resultados.

**Actual Behaviour:**  
Os botões `← Prev` e `Next →` aparecem mesmo com "No books found".

**Proposed Fix:**  
```tsx
{books.length > 0 && (
  <div className="pagination">
    <button>← Prev</button>
    <span>Page {page}</span>
    <button>Next →</button>
  </div>
)}
```

---

### BUG-020 — Formulários empilhados na mesma tela sem navegação clara

- **Component:** Web
- **Endpoint / Page:** Página Books
- **Severity:** Low

**Description:**  
Ao clicar em "+ New Book" ou "Assign Tenant", os respectivos formulários são exibidos empilhados na mesma página junto com o formulário de busca, causando interface confusa. O usuário pode ter múltiplos formulários abertos simultaneamente com múltiplas mensagens de erro distintas.

**Steps to Reproduce:**
1. Navegar até a página Books
2. Clicar em "+ New Book" — formulário Create aparece acima de Search
3. Clicar em "Assign Tenant" — formulário Assign aparece também
4. Observar todos os formulários na mesma tela simultaneamente

**Expected Behaviour:**  
Cada ação deveria abrir um modal ou substituir o conteúdo atual, exibindo apenas um formulário por vez.

**Actual Behaviour:**  
Todos os formulários (Create Book, Assign Tenant, Search Books) aparecem empilhados na mesma tela.

**Proposed Fix:**  
```tsx
const [activeForm, setActiveForm] = useState<'search' | 'create' | 'assign'>('search');
```

---

## Observações Adicionais

- O campo `dateOfBirth` no cadastro de Person não é validado no front-end — datas futuras são aceitas sem feedback ao usuário.
- A tela de login exibe mensagem genérica `"invalid credentials"` tanto para usuário inexistente quanto para senha errada — comportamento aceitável por segurança (evita enumeração de usuários).
- Como o `POST /libraries` está quebrado (BUG-003), não foi possível testar o `GET /libraries/{name}/books` com uma biblioteca existente para validar o retorno completo desse endpoint.

---

*Relatório gerado em 04/04/2026*
