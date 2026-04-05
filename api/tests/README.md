# Testes Automatizados — GoLedger QA Challenge

Esta pasta contém testes automatizados que cobrem os principais endpoints da API e demonstram os bugs documentados no [bug-report.md](../../bug-report.md).

---

## Arquivos

| Arquivo | Descrição |
|---|---|
| `api.test.js` | Testes em Node.js (sem dependências externas) |
| `goledger-qa.postman_collection.json` | Collection do Postman (também roda via Newman) |

---

## Pré-requisitos

Antes de executar os testes, certifique-se de que a API está rodando:

```bash
cd api
docker-compose up --build
```

A API deve estar disponível em **http://localhost:8080**.

---

## Opção 1 — Node.js

Não requer instalação de dependências adicionais. Funciona com o Node.js 18+ já instalado.

### Como executar

Na raiz do projeto, execute:

```bash
node api/tests/api.test.js
```

### Exemplo de saída

```
 GoLedger QA Challenge — Testes Automatizados da API
==================================================
   URL Base: http://localhost:8080

 Autenticação
──────────────────────────────────────────────────
  ✅ Login com credenciais válidas retorna 200
  ✅ Resposta do login contém token JWT
  ✅ Login com senha errada retorna 401
  ✅ Login com body vazio retorna 400
  ✅ Cadastro de novo usuário retorna 201
  ✅ Cadastro com usuário duplicado retorna 409
  ✅ GET /me autenticado retorna 200
  ❌ BUG-002: GET /me NÃO deve retornar o campo senha (falha de segurança)
     Esperado: Resposta não deve conter o campo 'password'
     Recebido: campo password="admin123" está exposto na resposta
  ✅ GET /me sem token retorna 401

 Livros (Books)
──────────────────────────────────────────────────
  ✅ GET /books sem token retorna 401
  ✅ POST /books sem token retorna 401
  ❌ BUG-001: DELETE /books sem token deve retornar 401 (autenticação ausente)
     Esperado: 401
     Recebido: Recebido 404 — endpoint processa requisição sem autenticação
  ❌ BUG-004: GET /books com filtro de gênero deve retornar resultados (filtro está quebrado)
     Esperado: Array com pelo menos 1 livro do gênero 'Technology'
     Recebido: Com filtro de gênero: [] | Sem filtro: 0 resultado(s)
  ✅ POST /books com bookType inválido (99) retorna 400

 Pessoas (Persons)
──────────────────────────────────────────────────
  ✅ POST /persons sem token retorna 401
  ✅ POST /persons — pessoa já existe (409) ou foi criada (201)

 Bibliotecas (Libraries)
──────────────────────────────────────────────────
  ✅ POST /libraries sem token retorna 401
  ❌ BUG-003: POST /libraries com payload válido deve retornar 201 (endpoint está quebrado)
     Esperado: 201 Criado ou 409 Conflito (se já existir)
     Recebido: Recebido 400 — erro: {"error":"...missing argument 'name'..."}
  ✅ GET /libraries/:name/books sem token retorna 401
  ❌ BUG-009: GET /libraries/:name/books para biblioteca inexistente deve retornar 404
     Esperado: 404
     Recebido: Recebido 400

==================================================
 Resultado: 20 testes | ✅ 15 aprovados | ❌ 5 reprovados
 Testes reprovados indicam bugs conhecidos documentados em bug-report.md
```

---

## Opção 2 — Postman

### Via interface gráfica

1. Abra o Postman
2. Clique em **Import** (canto superior esquerdo)
3. Selecione o arquivo `api/tests/goledger-qa.postman_collection.json`
4. Na coleção importada, clique em **Run collection**
5. Clique em **Run GoLedger QA Challenge** para executar todos os testes

### Via Newman (linha de comando)

O Newman permite rodar a collection do Postman diretamente pelo terminal.

**Instalação:**

```bash
npm install -g newman
```

**Execução:**

```bash
newman run api/tests/goledger-qa.postman_collection.json
```

**Com relatório HTML (opcional):**

```bash
npm install -g newman-reporter-htmlextra
newman run api/tests/goledger-qa.postman_collection.json -r htmlextra
```

---

## Bugs cobertos pelos testes

| Bug | Descrição | Severidade |
|---|---|---|
| BUG-001 | DELETE /books não exige autenticação | Critical |
| BUG-002 | GET /me expõe senha do usuário em texto puro | Critical |
| BUG-003 | POST /libraries não cria biblioteca | Critical |
| BUG-004 | GET /books com filtro de gênero retorna vazio | High |
| BUG-006 | POST /persons retorna `null` no body | High |
| BUG-007 | GET /books expõe campos internos da blockchain | Medium |
| BUG-009 | GET /libraries/{name}/books retorna 400 em vez de 404 | Medium |

Para o relatório completo de todos os 20 bugs encontrados, consulte o arquivo [bug-report.md](../../bug-report.md).
