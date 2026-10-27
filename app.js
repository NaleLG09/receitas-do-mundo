import { initializeApp } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-app.js";
import {
  getFirestore, collection, addDoc, doc, updateDoc, deleteDoc,
  onSnapshot, query, orderBy, serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js";
import { firebaseConfig } from "./firebase-config.js";

/* ---------- Utilidades ---------- */
const $ = (seletor) => document.querySelector(seletor);
const API = "https://www.themealdb.com/api/json/v1/1";

// Cria elementos usando textContent (evita injeção de HTML vindo do banco ou da API)
function el(tag, { classe, texto, attrs } = {}, ...filhos) {
  const no = document.createElement(tag);
  if (classe) no.className = classe;
  if (texto !== undefined) no.textContent = texto;
  if (attrs) for (const [k, v] of Object.entries(attrs)) no.setAttribute(k, v);
  filhos.forEach((f) => f && no.append(f));
  return no;
}

function aviso(seletor, mensagem, erro = false) {
  const no = $(seletor);
  no.textContent = mensagem;
  no.classList.toggle("erro", erro);
}

function urlSegura(texto) {
  try {
    const u = new URL(texto);
    return u.protocol === "https:" || u.protocol === "http:" ? texto : "";
  } catch {
    return "";
  }
}

function imagemOuVazio(url, classe) {
  const segura = urlSegura(url || "");
  return segura
    ? el("img", { classe, attrs: { src: segura, alt: "", loading: "lazy" } })
    : el("div", { classe: `${classe} sem-foto`, texto: "Sem foto" });
}

/* ---------- Firebase / Firestore ---------- */
const configurado = firebaseConfig.apiKey && !firebaseConfig.apiKey.startsWith("COLE");
let colecao = null;

if (configurado) {
  const app = initializeApp(firebaseConfig);
  colecao = collection(getFirestore(app), "receitas");
} else {
  $("#avisoConfig").hidden = false;
}

let receitas = [];      // cópia local dos documentos
let editandoId = null;  // id do documento em edição (null = cadastro novo)
let pratoAberto = null; // prato da API exibido no diálogo

/* ---------- API TheMealDB ---------- */
async function api(caminho) {
  const resposta = await fetch(`${API}/${caminho}`);
  if (!resposta.ok) throw new Error(`A API respondeu com erro ${resposta.status}`);
  const dados = await resposta.json();
  return dados.meals || [];
}

function normalizar(m) {
  const ingredientes = [];
  for (let i = 1; i <= 20; i++) {
    const ing = (m[`strIngredient${i}`] || "").trim();
    const med = (m[`strMeasure${i}`] || "").trim();
    if (ing) ingredientes.push(`${med} ${ing}`.trim());
  }
  return {
    idApi: m.idMeal,
    nome: m.strMeal,
    pais: m.strArea || "",
    categoria: m.strCategory || "",
    imagem: m.strMealThumb || "",
    ingredientes,
    preparo: (m.strInstructions || "").trim()
  };
}

async function carregarPaises() {
  try {
    const lista = await api("list.php?a=list");
    const paises = lista.map((i) => i.strArea).filter((p) => p && p !== "Unknown").sort();
    for (const p of paises) {
      $("#selPais").append(new Option(p, p));
      $("#listaPaises").append(new Option(p, p));
    }
  } catch {
    aviso("#statusApi", "Não foi possível carregar a lista de países. Verifique sua conexão e recarregue a página.", true);
  }
}

function mostrarPratos(pratos) {
  const grade = $("#gridApi");
  grade.replaceChildren();
  if (!pratos.length) {
    aviso("#statusApi", "Nenhum prato encontrado. Tente outro país ou outro nome.");
    return;
  }
  aviso("#statusApi", `${pratos.length} prato(s) encontrado(s). Clique em um para ver os detalhes.`);
  for (const p of pratos) {
    const botao = el("button", { classe: "cartao-api", attrs: { type: "button" } },
      el("img", { attrs: { src: `${p.strMealThumb}/preview`, alt: "", loading: "lazy" } }),
      el("span", { texto: p.strMeal })
    );
    botao.addEventListener("click", () => abrirDetalhe(p.idMeal));
    grade.append(botao);
  }
}

async function buscarPorPais(pais) {
  if (!pais) return;
  aviso("#statusApi", "Buscando pratos...");
  try {
    mostrarPratos(await api(`filter.php?a=${encodeURIComponent(pais)}`));
  } catch (e) {
    aviso("#statusApi", `Erro ao consultar a API: ${e.message}`, true);
  }
}

async function buscarPorNome(nome) {
  if (!nome.trim()) {
    aviso("#statusApi", "Digite o nome de um prato para buscar.", true);
    return;
  }
  aviso("#statusApi", "Buscando pratos...");
  try {
    mostrarPratos(await api(`search.php?s=${encodeURIComponent(nome.trim())}`));
  } catch (e) {
    aviso("#statusApi", `Erro ao consultar a API: ${e.message}`, true);
  }
}

async function abrirDetalhe(id) {
  try {
    const [m] = await api(`lookup.php?i=${encodeURIComponent(id)}`);
    if (!m) throw new Error("prato não encontrado");
    pratoAberto = normalizar(m);

    const img = $("#detImg");
    img.src = pratoAberto.imagem;
    $("#detNome").textContent = pratoAberto.nome;
    $("#detMeta").textContent = [pratoAberto.pais, pratoAberto.categoria].filter(Boolean).join(" • ");
    const ul = $("#detIngredientes");
    ul.replaceChildren(...pratoAberto.ingredientes.map((i) => el("li", { texto: i })));
    $("#detPreparo").textContent = pratoAberto.preparo;
    atualizarBotaoSalvarApi();
    $("#dlgDetalhe").showModal();
  } catch (e) {
    aviso("#statusApi", `Não foi possível abrir o prato: ${e.message}`, true);
  }
}

function atualizarBotaoSalvarApi() {
  const botao = $("#btnSalvarApi");
  if (!pratoAberto) return;
  const jaSalvo = receitas.some((r) => r.idApi === pratoAberto.idApi);
  botao.disabled = jaSalvo || !configurado;
  botao.textContent = jaSalvo ? "Já está nos favoritos" : "Salvar nos favoritos";
}

/* ---------- CRUD: Create a partir da API ---------- */
async function salvarDaApi() {
  if (!pratoAberto || !colecao) return;
  const botao = $("#btnSalvarApi");
  botao.disabled = true;
  try {
    await addDoc(colecao, {
      idApi: pratoAberto.idApi,
      nome: pratoAberto.nome,
      pais: pratoAberto.pais,
      categoria: pratoAberto.categoria,
      imagem: pratoAberto.imagem,
      ingredientes: pratoAberto.ingredientes.join("\n"),
      preparo: pratoAberto.preparo,
      observacoes: "",
      criadoEm: serverTimestamp(),
      atualizadoEm: serverTimestamp()
    });
    $("#dlgDetalhe").close();
    aviso("#statusLista", `"${pratoAberto.nome}" foi salvo nos favoritos.`);
  } catch (e) {
    botao.disabled = false;
    aviso("#statusApi", `Não foi possível salvar: ${e.message}`, true);
  }
}

/* ---------- CRUD: Read (listagem em tempo real) ---------- */
function iniciarLeitura() {
  if (!colecao) return;
  const consulta = query(colecao, orderBy("criadoEm", "desc"));
  onSnapshot(
    consulta,
    (snap) => {
      receitas = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      renderReceitas();
      atualizarBotaoSalvarApi();
    },
    (erro) => aviso("#statusLista", `Erro ao ler o Firestore: ${erro.message}. Confira as regras de segurança.`, true)
  );
}

function renderReceitas() {
  const termo = $("#filtro").value.trim().toLowerCase();
  const lista = receitas.filter((r) =>
    !termo || [r.nome, r.pais, r.categoria].join(" ").toLowerCase().includes(termo)
  );
  const grade = $("#gridReceitas");
  grade.replaceChildren();
  $("#contagem").textContent = receitas.length ? `${lista.length} de ${receitas.length}` : "";

  if (!lista.length) {
    grade.append(el("p", {
      classe: "vazio",
      texto: receitas.length
        ? "Nenhuma receita corresponde ao filtro."
        : "Você ainda não salvou receitas. Escolha um prato em Descobrir pratos ou preencha o formulário."
    }));
    return;
  }

  for (const r of lista) {
    const detalhes = el("details", {},
      el("summary", { texto: "Ver ingredientes e preparo" }),
      el("ul", {}, ...(r.ingredientes || "").split("\n").filter(Boolean).map((i) => el("li", { texto: i }))),
      el("p", { classe: "texto-longo", texto: r.preparo || "" }),
      r.observacoes ? el("p", { classe: "obs", texto: `Observação: ${r.observacoes}` }) : null
    );

    const btnEditar = el("button", { classe: "btn", texto: "Editar", attrs: { type: "button" } });
    const btnExcluir = el("button", { classe: "btn btn-perigo", texto: "Excluir", attrs: { type: "button" } });
    btnEditar.addEventListener("click", () => iniciarEdicao(r));
    btnExcluir.addEventListener("click", () => excluir(r));

    grade.append(el("article", { classe: "receita" },
      imagemOuVazio(r.imagem, "receita-img"),
      el("div", { classe: "receita-corpo" },
        el("h3", { texto: r.nome }),
        el("p", { classe: "meta", texto: [r.pais, r.categoria].filter(Boolean).join(" • ") }),
        detalhes,
        el("div", { classe: "acoes-card" }, btnEditar, btnExcluir)
      )
    ));
  }
}

/* ---------- CRUD: Create (manual) e Update ---------- */
const form = $("#formReceita");

function lerFormulario() {
  const d = new FormData(form);
  const campo = (n) => (d.get(n) || "").toString().trim();
  return {
    nome: campo("nome"),
    pais: campo("pais"),
    categoria: campo("categoria"),
    imagem: campo("imagem"),
    ingredientes: campo("ingredientes"),
    preparo: campo("preparo"),
    observacoes: campo("observacoes")
  };
}

function iniciarEdicao(r) {
  editandoId = r.id;
  for (const nome of ["nome", "pais", "categoria", "imagem", "ingredientes", "preparo", "observacoes"]) {
    form.elements[nome].value = r[nome] || "";
  }
  $("#tituloForm").textContent = "Editar receita";
  $("#btnSalvar").textContent = "Salvar alterações";
  $("#btnCancelar").hidden = false;
  aviso("#statusForm", "");
  $("#formulario").scrollIntoView({ behavior: "smooth", block: "start" });
  form.elements.nome.focus();
}

function sairDaEdicao() {
  editandoId = null;
  form.reset();
  $("#tituloForm").textContent = "Cadastrar receita";
  $("#btnSalvar").textContent = "Salvar receita";
  $("#btnCancelar").hidden = true;
}

form.addEventListener("submit", async (evento) => {
  evento.preventDefault();
  if (!colecao) {
    aviso("#statusForm", "Configure o Firebase em firebase-config.js antes de salvar.", true);
    return;
  }
  const dados = lerFormulario();
  if (!dados.nome || !dados.pais || !dados.ingredientes || !dados.preparo) {
    aviso("#statusForm", "Preencha nome, país, ingredientes e modo de preparo.", true);
    return;
  }
  if (dados.imagem && !urlSegura(dados.imagem)) {
    aviso("#statusForm", "O endereço da foto deve começar com http:// ou https://.", true);
    return;
  }

  const botao = $("#btnSalvar");
  botao.disabled = true;
  try {
    if (editandoId) {
      await updateDoc(doc(colecao.firestore, "receitas", editandoId), { ...dados, atualizadoEm: serverTimestamp() });
      aviso("#statusForm", "Receita atualizada.");
    } else {
      await addDoc(colecao, { ...dados, criadoEm: serverTimestamp(), atualizadoEm: serverTimestamp() });
      aviso("#statusForm", "Receita cadastrada.");
    }
    sairDaEdicao();
  } catch (e) {
    aviso("#statusForm", `Não foi possível salvar: ${e.message}`, true);
  } finally {
    botao.disabled = false;
  }
});

$("#btnCancelar").addEventListener("click", () => {
  sairDaEdicao();
  aviso("#statusForm", "Edição cancelada.");
});

/* ---------- CRUD: Delete ---------- */
async function excluir(r) {
  if (!confirm(`Excluir a receita "${r.nome}"? Essa ação não pode ser desfeita.`)) return;
  try {
    await deleteDoc(doc(colecao.firestore, "receitas", r.id));
    if (editandoId === r.id) sairDaEdicao();
    aviso("#statusLista", `"${r.nome}" foi excluída.`);
  } catch (e) {
    aviso("#statusLista", `Não foi possível excluir: ${e.message}`, true);
  }
}

/* ---------- Eventos da interface ---------- */
$("#selPais").addEventListener("change", (e) => buscarPorPais(e.target.value));
$("#btnBuscar").addEventListener("click", () => buscarPorNome($("#inpBusca").value));
$("#inpBusca").addEventListener("keydown", (e) => { if (e.key === "Enter") buscarPorNome(e.target.value); });
$("#btnSorteio").addEventListener("click", async () => {
  try {
    const [m] = await api("random.php");
    if (m) abrirDetalhe(m.idMeal);
  } catch (e) {
    aviso("#statusApi", `Erro ao consultar a API: ${e.message}`, true);
  }
});
$("#filtro").addEventListener("input", renderReceitas);
$("#btnSalvarApi").addEventListener("click", salvarDaApi);
$("#btnFechar").addEventListener("click", () => $("#dlgDetalhe").close());

/* ---------- Início ---------- */
carregarPaises();
iniciarLeitura();
renderReceitas();
