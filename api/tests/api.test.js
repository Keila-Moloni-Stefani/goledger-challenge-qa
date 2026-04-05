/**
 * GoLedger QA Challenge — Testes Automatizados da API
 *
 * Estes testes demonstram os bugs encontrados durante os testes manuais.
 * Eles verificam tanto os comportamentos corretos quanto os incorretos conhecidos.
 *
 * Requisitos: Node.js 18+
 *
 * Como executar:
 *   1. Certifique-se de que a API está rodando em http://localhost:8080
 *   2. Na raiz do projeto, execute:
 *      node api/tests/api.test.js
 */

const URL_BASE = "http://localhost:8080";

// ─── Auxiliares ─────────────────────────────────────────────────────────────

let aprovados = 0;
let reprovados = 0;
let token = "";

async function requisicao(metodo, caminho, corpo = null, tokenAuth = null) {
  const cabecalhos = { "Content-Type": "application/json" };
  if (tokenAuth) cabecalhos["Authorization"] = `Bearer ${tokenAuth}`;

  const opcoes = { method: metodo, headers: cabecalhos };
  if (corpo) opcoes.body = JSON.stringify(corpo);

  const res = await fetch(`${URL_BASE}${caminho}`, opcoes);
  let dados = null;
  try {
    dados = await res.json();
  } catch (_) {}
  return { status: res.status, dados };
}

function verificar(nome, condicao, real, esperado) {
  if (condicao) {
    console.log(`  ✅ ${nome}`);
    aprovados++;
  } else {
    console.log(`  ❌ ${nome}`);
    console.log(`     Esperado: ${esperado}`);
    console.log(`     Recebido: ${real}`);
    reprovados++;
  }
}

function secao(titulo) {
  console.log(`\n ${titulo}`);
  console.log("─".repeat(50));
}

// ─── Testes ─────────────────────────────────────────────────────────────────

async function testarAutenticacao() {
  secao("Autenticação");

  // ✅ Login com credenciais válidas
  const login = await requisicao("POST", "/auth/login", {
    username: "admin",
    password: "admin123",
  });
  verificar(
    "Login com credenciais válidas retorna 200",
    login.status === 200,
    login.status,
    200
  );
  verificar(
    "Resposta do login contém token JWT",
    login.dados && login.dados.token,
    JSON.stringify(login.dados),
    '{ "token": "<jwt>" }'
  );
  if (login.dados?.token) token = login.dados.token;

  // ✅ Login com senha errada retorna 401
  const loginErrado = await requisicao("POST", "/auth/login", {
    username: "admin",
    password: "senhaerrada",
  });
  verificar(
    "Login com senha errada retorna 401",
    loginErrado.status === 401,
    loginErrado.status,
    401
  );

  // ✅ Login com body vazio retorna 400
  const loginVazio = await requisicao("POST", "/auth/login", {});
  verificar(
    "Login com body vazio retorna 400",
    loginVazio.status === 400,
    loginVazio.status,
    400
  );

  // ✅ Cadastro de novo usuário retorna 201
  const novoUsuario = `usuario_teste_${Date.now()}`;
  const cadastro = await requisicao("POST", "/auth/register", {
    username: novoUsuario,
    password: "senha123",
  });
  verificar(
    "Cadastro de novo usuário retorna 201",
    cadastro.status === 201,
    cadastro.status,
    201
  );

  // ✅ Cadastro com usuário duplicado retorna 409
  const cadastroDuplicado = await requisicao("POST", "/auth/register", {
    username: novoUsuario,
    password: "senha123",
  });
  verificar(
    "Cadastro com usuário duplicado retorna 409",
    cadastroDuplicado.status === 409,
    cadastroDuplicado.status,
    409
  );

  // ─── BUG-002: GET /me expõe a senha ─────────────────────────────────────
  const perfil = await requisicao("GET", "/me", null, token);
  verificar(
    "GET /me autenticado retorna 200",
    perfil.status === 200,
    perfil.status,
    200
  );
  const temSenha = perfil.dados && perfil.dados.password !== undefined;
  verificar(
    "BUG-002: GET /me NÃO deve retornar o campo senha (falha de segurança)",
    !temSenha,
    temSenha
      ? `campo password="${perfil.dados.password}" está exposto na resposta`
      : "senha não exposta",
    "Resposta não deve conter o campo 'password'"
  );

  // ✅ GET /me sem token retorna 401
  const perfilSemToken = await requisicao("GET", "/me");
  verificar(
    "GET /me sem token retorna 401",
    perfilSemToken.status === 401,
    perfilSemToken.status,
    401
  );
}

async function testarLivros() {
  secao("Livros (Books)");

  // ✅ GET /books sem token retorna 401
  const listaSemToken = await requisicao(
    "GET",
    "/books?author=Alan%20Donovan"
  );
  verificar(
    "GET /books sem token retorna 401",
    listaSemToken.status === 401,
    listaSemToken.status,
    401
  );

  // ✅ POST /books sem token retorna 401
  const criarSemToken = await requisicao("POST", "/books", {
    title: "Livro Teste",
    author: "Autor Teste",
    genres: ["Tecnologia"],
    bookType: 0,
  });
  verificar(
    "POST /books sem token retorna 401",
    criarSemToken.status === 401,
    criarSemToken.status,
    401
  );

  // ─── BUG-001: DELETE /books sem token ────────────────────────────────────
  const deletarSemToken = await requisicao(
    "DELETE",
    "/books?title=The%20Go%20Programming%20Language&author=Alan%20Donovan"
  );
  verificar(
    "BUG-001: DELETE /books sem token deve retornar 401 (autenticação ausente)",
    deletarSemToken.status === 401,
    `Recebido ${deletarSemToken.status} — endpoint processa requisição sem autenticação`,
    401
  );

  // ─── BUG-004: GET /books com filtro de gênero retorna vazio ──────────────
  const livrosComGenero = await requisicao(
    "GET",
    "/books?author=Alan%20Donovan&genre=Technology&page=1&limit=10",
    null,
    token
  );
  const livrosSemGenero = await requisicao(
    "GET",
    "/books?author=Alan%20Donovan&page=1&limit=10",
    null,
    token
  );
  const filtroGeneroFunciona =
    livrosComGenero.dados &&
    Array.isArray(livrosComGenero.dados) &&
    livrosComGenero.dados.length > 0;
  verificar(
    "BUG-004: GET /books com filtro de gênero deve retornar resultados (filtro está quebrado)",
    filtroGeneroFunciona,
    `Com filtro de gênero: ${JSON.stringify(livrosComGenero.dados)} | Sem filtro: ${livrosSemGenero.dados?.length ?? 0} resultado(s)`,
    "Array com pelo menos 1 livro do gênero 'Technology'"
  );

  // ─── BUG-007: GET /books expõe campos internos da blockchain ─────────────
  const livros = await requisicao(
    "GET",
    "/books?author=Alan%20Donovan&page=1&limit=1",
    null,
    token
  );
  if (livros.dados && Array.isArray(livros.dados) && livros.dados.length > 0) {
    const livro = livros.dados[0];
    const temCamposInternos =
      livro["@key"] !== undefined ||
      livro["@lastTouchBy"] !== undefined ||
      livro["@lastTx"] !== undefined ||
      livro["@lastUpdated"] !== undefined;
    verificar(
      "BUG-007: GET /books NÃO deve expor campos internos da blockchain (@key, @lastTx, etc.)",
      !temCamposInternos,
      temCamposInternos
        ? `Campos internos encontrados: ${Object.keys(livro)
            .filter((k) => k.startsWith("@"))
            .join(", ")}`
        : "Nenhum campo interno encontrado",
      "Resposta não deve conter campos com prefixo '@'"
    );
  }

  // ✅ POST /books com bookType inválido retorna 400
  const bookTypeInvalido = await requisicao(
    "POST",
    "/books",
    {
      title: "Livro Inválido",
      author: "Autor Teste",
      genres: ["Tech"],
      bookType: 99,
    },
    token
  );
  verificar(
    "POST /books com bookType inválido (99) retorna 400",
    bookTypeInvalido.status === 400,
    bookTypeInvalido.status,
    400
  );
}

async function testarPessoas() {
  secao("Pessoas (Persons)");

  // ✅ POST /persons sem token retorna 401
  const semToken = await requisicao("POST", "/persons", {
    id: "111.444.777-35",
    name: "Teste",
    dateOfBirth: "1990-01-15T00:00:00Z",
    height: 1.7,
  });
  verificar(
    "POST /persons sem token retorna 401",
    semToken.status === 401,
    semToken.status,
    401
  );

  // ─── BUG-006: POST /persons retorna null no body ──────────────────────────
  const criarPessoa = await requisicao(
    "POST",
    "/persons",
    {
      id: "111.444.777-35",
      name: "Maria Silva",
      dateOfBirth: "1995-06-20T00:00:00Z",
      height: 1.65,
    },
    token
  );
  if (criarPessoa.status === 201) {
    verificar(
      "BUG-006: POST /persons (201) deve retornar os dados da pessoa criada, não null",
      criarPessoa.dados !== null,
      criarPessoa.dados,
      "Objeto com id, name, dateOfBirth, height"
    );
  } else {
    verificar(
      "POST /persons — pessoa já existe (409) ou foi criada (201)",
      criarPessoa.status === 201 || criarPessoa.status === 409,
      criarPessoa.status,
      "201 ou 409"
    );
  }
}

async function testarBibliotecas() {
  secao("Bibliotecas (Libraries)");

  // ✅ POST /libraries sem token retorna 401
  const semToken = await requisicao("POST", "/libraries", {
    name: "Biblioteca Teste",
  });
  verificar(
    "POST /libraries sem token retorna 401",
    semToken.status === 401,
    semToken.status,
    401
  );

  // ─── BUG-003: POST /libraries falha com payload correto ──────────────────
  const criarBiblioteca = await requisicao(
    "POST",
    "/libraries",
    { name: "Biblioteca Central" },
    token
  );
  verificar(
    "BUG-003: POST /libraries com payload válido deve retornar 201 (endpoint está quebrado)",
    criarBiblioteca.status === 201 || criarBiblioteca.status === 409,
    `Recebido ${criarBiblioteca.status} — erro: ${JSON.stringify(criarBiblioteca.dados)}`,
    "201 Criado ou 409 Conflito (se já existir)"
  );

  // ✅ GET /libraries/:name/books sem token retorna 401
  const semTokenGet = await requisicao(
    "GET",
    "/libraries/Biblioteca%20Central/books"
  );
  verificar(
    "GET /libraries/:name/books sem token retorna 401",
    semTokenGet.status === 401,
    semTokenGet.status,
    401
  );

  // ─── BUG-009: GET /libraries/:name/books retorna 400 em vez de 404 ───────
  const naoEncontrada = await requisicao(
    "GET",
    "/libraries/BibliotecaInexistente999/books",
    null,
    token
  );
  verificar(
    "BUG-009: GET /libraries/:name/books para biblioteca inexistente deve retornar 404 (retorna 400)",
    naoEncontrada.status === 404,
    `Recebido ${naoEncontrada.status}`,
    404
  );
}

// ─── Executor ────────────────────────────────────────────────────────────────

async function executar() {
  console.log("\n GoLedger QA Challenge — Testes Automatizados da API");
  console.log("=".repeat(50));
  console.log(`   URL Base: ${URL_BASE}`);
  console.log(`   Data:     ${new Date().toISOString()}`);

  try {
    await testarAutenticacao();
    await testarLivros();
    await testarPessoas();
    await testarBibliotecas();
  } catch (err) {
    console.error("\n💥 Erro inesperado:", err.message);
    console.error(
      "   Verifique se a API está rodando em http://localhost:8080\n"
    );
    process.exit(1);
  }

  const total = aprovados + reprovados;
  console.log("\n" + "=".repeat(50));
  console.log(
    ` Resultado: ${total} testes | ✅ ${aprovados} aprovados | ❌ ${reprovados} reprovados`
  );

  if (reprovados > 0) {
    console.log(
      "\n Testes reprovados indicam bugs conhecidos documentados em bug-report.md"
    );
  } else {
    console.log("\n🎉 Todos os testes passaram!");
  }
  console.log("");
}

executar();
